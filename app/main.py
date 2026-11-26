from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
import os

from .database import engine, get_db
from . import models, schemas
from .services import ai_service, webhook_service

models.Base.metadata.create_all(bind=engine)
app = FastAPI(title="SmartSupport AI")
app.mount("/static", StaticFiles(directory="app/static"), name="static")

class WebhookTestRequest(BaseModel):
    webhook_url: str
@app.get("/")
def read_root():
    return FileResponse("app/static/index.html")


@app.get("/api/config")
def get_config():
    enabled = ai_service.is_real_ai_enabled()
    return {"real_ai": enabled, "ai_mode": "Gemini API連携モード" if enabled else "デモAI判定モード（APIキー不要）"}


@app.post("/api/webhook/test")
async def test_webhook(req: WebhookTestRequest):
    ok, msg = await webhook_service.send_test_webhook(custom_webhook_url=req.webhook_url)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    return {"status": "ok", "message": msg}
@app.get("/api/inquiries", response_model=List[schemas.InquiryResponse])
def get_inquiries(status: Optional[str] = None, priority: Optional[str] = None, q: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Inquiry)
    if status:
        query = query.filter(models.Inquiry.status == status)
    if priority:
        query = query.filter(models.Inquiry.priority == priority)
    if q:
        query = query.filter(models.Inquiry.customer_name.contains(q) | models.Inquiry.content.contains(q))
    return query.order_by(models.Inquiry.id.desc()).all()


@app.post("/api/inquiries", response_model=schemas.InquiryResponse)
async def create_inquiry(inquiry: schemas.InquiryCreate, webhook_url: Optional[str] = None, db: Session = Depends(get_db)):
    plain_text = inquiry.content.split("\n[[IMG_DATA]]")[0]
    ai_res = await ai_service.analyze_inquiry(inquiry.customer_name, plain_text)
    item = models.Inquiry(**inquiry.model_dump(), category=ai_res["category"], priority=ai_res["priority"], ai_reply_draft=ai_res["ai_reply_draft"], status="未対応")
    db.add(item)
    db.commit()
    db.refresh(item)
    if item.priority == "高" and webhook_url:
        await webhook_service.send_high_priority_alert(item.id, item.customer_name, item.category, plain_text, custom_webhook_url=webhook_url)
    return item
@app.patch("/api/inquiries/{inquiry_id}", response_model=schemas.InquiryResponse)
def update_inquiry(inquiry_id: int, req: schemas.InquiryUpdate, db: Session = Depends(get_db)):
    item = db.query(models.Inquiry).filter(models.Inquiry.id == inquiry_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="対象が見つかりません")
    for k, v in req.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item


@app.delete("/api/inquiries/{inquiry_id}")
def delete_inquiry(inquiry_id: int, db: Session = Depends(get_db)):
    item = db.query(models.Inquiry).filter(models.Inquiry.id == inquiry_id).first()
    if item:
        db.delete(item)
        db.commit()
    return {"status": "deleted"}


@app.post("/api/demo/reset")
def reset_demo(db: Session = Depends(get_db)):
    db.query(models.Inquiry).delete()
    samples = [
        models.Inquiry(customer_name="株式会社ネクストコマース 山本", email="yamamoto@next-commerce.example.jp", content="カート画面でWeb接客バナーが画面全体を覆ってしまい、購入ボタンが押せないというクレームが複数来ています。緊急で表示停止または修正をお願いします！", category="不具合報告", priority="高", status="未対応", ai_reply_draft="株式会社ネクストコマース 山本 様\n\nいつも弊社サービスをご利用いただき誠にありがとうございます。現在開発チームと連携し緊急で調査・復旧対応を進めております。"),
        models.Inquiry(customer_name="天神メディアワークス 高橋", email="takahashi@tenjin-media.example.jp", content="新規メンバー2名を管理画面に招待しましたが、招待メールが届かないようです。迷惑メールフォルダも確認済みです。再送手順をご教示ください。", category="その他", priority="中", status="対応中", ai_reply_draft="天神メディアワークス 高橋 様\n\nお問い合わせありがとうございます。招待メールの再送手順およびドメイン受信設定についてご案内いたします。"),
        models.Inquiry(customer_name="博多リテールデザイン 佐藤", email="sato@hakata-retail.example.jp", content="来月の更新タイミングで上位プランへ変更したいと考えています。日割り計算の有無とインボイス対応の請求書発行について教えてください。", category="料金・契約", priority="低", status="完了", ai_reply_draft="博多リテールデザイン 佐藤 様\n\n上位プランへのご検討ありがとうございます。プラン変更時の日割り計算および適格請求書（インボイス）の発行仕様についてご案内いたします。")
    ]
    db.add_all(samples)
    db.commit()
    return {"status": "reset"}

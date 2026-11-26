import os
import json
import httpx
from dotenv import load_dotenv

load_dotenv()

def is_real_ai_enabled() -> bool:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    return bool(api_key)

async def analyze_inquiry(customer_name: str, content: str) -> dict:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if api_key:
        try:
            return await _analyze_with_gemini(api_key, customer_name, content)
        except Exception as e:
            print(f"[AI Fallback] Gemini APIエラーのためデモモードへ切替: {e}")
    return _analyze_with_mock(customer_name, content)

async def _analyze_with_gemini(api_key: str, customer_name: str, content: str) -> dict:
    url = f"https://googleapis.com{api_key}"
    prompt = f"""あなたはWeb接客SaaS企業の優秀なカスタマーサポート担当です。
以下の顧客からのお問い合わせを分析し、必ずJSON形式のみで出力してください。

顧客名: {customer_name}
問い合わせ内容:
{content}

出力JSONフォーマット:
{{
  "category": "不具合報告" または "料金・契約" または "機能要望" または "その他",
  "priority": "高" または "中" または "低",
  "ai_reply_draft": "顧客への丁寧で的確な一次回答メール文面（署名なし）"
}}
"""
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json"}
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.post(url, json=payload)
        res.raise_for_status()
        data = res.json()
        text = data["candidates"]["content"]["parts"]["text"]
        parsed = json.loads(text)
        return {
            "category": parsed.get("category", "その他"),
            "priority": parsed.get("priority", "中"),
            "ai_reply_draft": parsed.get("ai_reply_draft", "")
        }

def _analyze_with_mock(customer_name: str, content: str) -> dict:
    text = content.lower()
    if any(k in text for k in ["エラー", "動かない", "表示されない", "不具合", "バグ", "落ちる", "ログインできない", "緊急"]):
        category = "不具合報告"
        priority = "高"
        reply = (
            f"{customer_name} 様\n\n"
            "いつも弊社サービスをご利用いただき誠にありがとうございます。カスタマーサポート担当でございます。\n"
            "この度はシステムの不具合により多大なるご迷惑をおかけしており、深くお詫び申し上げます。\n\n"
            "いただいた事象につきまして、現在開発チームと連携し緊急で調査・復旧対応を進めております。\n"
            "進捗があり次第、改めて早急にご報告いたしますので、今しばらくお待ちいただけますでしょうか。\n\n"
            "何卒よろしくお願い申し上げます。"
        )
    elif any(k in text for k in ["請求", "料金", "プラン", "解約", "支払い", "見積", "契約", "インボイス"]):
        category = "料金・契約"
        priority = "中"
        reply = (
            f"{customer_name} 様\n\n"
            "いつも弊社サービスをご利用いただき誠にありがとうございます。カスタマーサポート担当でございます。\n"
            "ご契約・料金に関するお問い合わせをいただき、ありがとうございます。\n\n"
            "ご登録状況および請求内容を確認のうえ、担当窓口より詳細をご案内いたします。\n"
            "通常1営業日以内に回答をお送りいたしますので、恐れ入りますが少々お待ちください。\n\n"
            "引き続きよろしくお願いいたします。"
        )
    elif any(k in text for k in ["機能", "要望", "追加", "ほしい", "改善", "連携", "csv", "api"]):
        category = "機能要望"
        priority = "低"
        reply = (
            f"{customer_name} 様\n\n"
            "いつも弊社サービスをご利用いただき誠にありがとうございます。カスタマーサポート担当でございます。\n"
            "貴重なご意見・機能改善のご要望をお寄せいただき、心より感謝申し上げます。\n\n"
            "いただいたご要望はプロダクト開発チームへ共有し、今後の機能アップデートの参考とさせていただきます。\n"
            "また何かお気づきの点がございましたら、いつでもお気軽にお知らせください。\n\n"
            "今後ともよろしくお願いいたします。"
        )
    else:
        category = "その他"
        priority = "低"
        reply = (
            f"{customer_name} 様\n\n"
            "いつも弊社サービスをご利用いただき誠にありがとうございます。カスタマーサポート担当でございます。\n"
            "お問い合わせいただき、誠にありがとうございます。\n\n"
            "内容を確認のうえ、担当者より順次ご案内を差し上げます。\n"
            "回答まで今しばらくお待ちいただけますと幸いです。\n\n"
            "よろしくお願いいたします。"
        )
    return {
        "category": category,
        "priority": priority,
        "ai_reply_draft": reply
    }

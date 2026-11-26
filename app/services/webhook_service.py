import os
from typing import Optional
import httpx
from dotenv import load_dotenv

load_dotenv()

async def send_high_priority_alert(
    inquiry_id: int,
    customer_name: str,
    category: str,
    content: str,
    custom_webhook_url: Optional[str] = None
):
    webhook_url = (custom_webhook_url or os.getenv("WEBHOOK_URL", "")).strip()
    if not webhook_url:
        return False

    message = (
        f"🚨 **【緊急度：高】新規お問い合わせ検知 (ID: #{inquiry_id})**\n"
        f"**顧客名:** {customer_name}\n"
        f"**AI分類:** {category}\n"
        f"**内容:** {content[:120]}{'...' if len(content) > 120 else ''}"
    )
    return await _post_webhook(webhook_url, message)

async def send_test_webhook(custom_webhook_url: Optional[str] = None) -> tuple[bool, str]:
    webhook_url = (custom_webhook_url or os.getenv("WEBHOOK_URL", "")).strip()
    if not webhook_url:
        return False, "Webhook URLが入力されていません。"

    message = (
        "✅ **【SmartSupport AI】Webhook連携テスト成功！**\n"
        "このチャンネルへ緊急度「高」のお問い合わせ通知がリアルタイムで届きます。"
    )
    ok = await _post_webhook(webhook_url, message)
    if ok:
        return True, "テスト通知を送信しました！Discord / Slack を確認してください。"
    return False, "送信に失敗しました。Webhook URLが正しいか確認してください。"

async def _post_webhook(webhook_url: str, message: str) -> bool:
    payload = {"content": message} if "discord" in webhook_url.lower() else {"text": message}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(webhook_url, json=payload)
            return res.status_code in (200, 204)
    except Exception as e:
        print(f"[Webhook Error] {e}")
        return False

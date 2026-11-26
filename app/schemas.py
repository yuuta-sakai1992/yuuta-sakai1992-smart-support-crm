from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class InquiryCreate(BaseModel):
    customer_name: str
    email: str
    content: str

class InquiryUpdate(BaseModel):
    status: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    ai_reply_draft: Optional[str] = None
    content: Optional[str] = None

class InquiryResponse(BaseModel):
    id: int
    customer_name: str
    email: str
    content: str
    category: str
    priority: str
    ai_reply_draft: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

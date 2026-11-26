from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime
from .database import Base

class Inquiry(Base):
    __tablename__ = "inquiries"

    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String(100), nullable=False)
    email = Column(String(150), nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(50), default="その他")
    priority = Column(String(20), default="中")
    ai_reply_draft = Column(Text, default="")
    status = Column(String(20), default="未対応")
    created_at = Column(DateTime, default=datetime.now)

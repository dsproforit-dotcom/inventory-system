from sqlalchemy import Column, String, Integer, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from ..core.database import Base

class History(Base):
    __tablename__ = "history"

    # პირადობის მაიდენტიფიცირებელი
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id = Column(String(50), nullable=False, index=True)
    item_name = Column(String(200), nullable=False)
    
    # ოპერაციის ტიპი: ADD, TRANSFER, ISSUE, RESTOCK, WRITE-OFF, UPDATE, DELETE
    action = Column(String(20), nullable=False)
    from_location = Column(String(100), nullable=True)
    to_location = Column(String(100), nullable=True)
    quantity = Column(Integer, default=0)
    responsible = Column(String(100), nullable=True)
    comment = Column(Text, nullable=True)
    
    # თარიღი
    created_at = Column(DateTime(timezone=True), server_default=func.now())
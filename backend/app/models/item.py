from sqlalchemy import Column, String, Integer, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from ..core.database import Base

class Item(Base):
    __tablename__ = "items"

    # პირადობის მაიდენტიფიცირებელი
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id = Column(String(50), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    category = Column(String(100), nullable=False)
    quantity = Column(Integer, default=0)
    location = Column(String(100), nullable=False)
    picture_url = Column(String(500), nullable=True)
    notes = Column(Text, nullable=True)
    
    # თარიღები
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
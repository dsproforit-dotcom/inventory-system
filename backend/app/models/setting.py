from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from ..core.database import Base

class Setting(Base):
    __tablename__ = "settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # ტიპი: "category" ან "location"
    type = Column(String(20), nullable=False)
    value = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
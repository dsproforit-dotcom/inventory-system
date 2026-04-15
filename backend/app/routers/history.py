from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from ..core.database import get_db
from ..models.history import History
from ..models.user import User
from .auth import get_current_user

router = APIRouter(prefix="/history", tags=["History"])

@router.get("/")
async def get_history(
    item_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    responsible: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """ისტორიის სია ფილტრაციით"""
    query = select(History).order_by(History.created_at.desc())

    if item_id:
        query = query.where(History.item_id.ilike(f"%{item_id}%"))
    if action:
        query = query.where(History.action == action.upper())
    if responsible:
        query = query.where(History.responsible.ilike(f"%{responsible}%"))

    query = query.limit(limit)
    result = await db.execute(query)
    records = result.scalars().all()

    return {
        "total": len(records),
        "history": [
            {
                "id": str(r.id),
                "item_id": r.item_id,
                "item_name": r.item_name,
                "action": r.action,
                "from_location": r.from_location,
                "to_location": r.to_location,
                "quantity": r.quantity,
                "responsible": r.responsible,
                "comment": r.comment,
                "created_at": r.created_at
            }
            for r in records
        ]
    }
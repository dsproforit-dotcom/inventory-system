from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..core.database import get_db
from ..models.item import Item
from ..models.history import History
from ..models.user import User
from .auth import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Dashboard სტატისტიკა"""
    # სულ ნივთები და რაოდენობა
    items_result = await db.execute(select(Item))
    items = items_result.scalars().all()

    total_items = len(items)
    total_qty = sum(item.quantity for item in items)

    # low stock — Consumables კატეგორია
    low_stock_it = [
        i for i in items
        if i.category == 'Consumables'
        and i.location == 'IT Warehouse'
        and i.quantity <= 3
    ]
    low_stock_floor = [
        i for i in items
        if i.category == 'Consumables'
        and i.location == "Floor's Cabinet"
        and i.quantity <= 1
    ]

    # ბოლო 10 ოპერაცია
    history_result = await db.execute(
        select(History)
        .order_by(History.created_at.desc())
        .limit(10)
    )
    recent = history_result.scalars().all()

    return {
        "total_items": total_items,
        "total_qty": total_qty,
        "low_stock_it": len(low_stock_it),
        "low_stock_floor": len(low_stock_floor),
        "recent_history": [
            {
                "item_id": r.item_id,
                "item_name": r.item_name,
                "action": r.action,
                "from_location": r.from_location,
                "to_location": r.to_location,
                "quantity": r.quantity,
                "responsible": r.responsible,
                "created_at": r.created_at
            }
            for r in recent
        ]
    }
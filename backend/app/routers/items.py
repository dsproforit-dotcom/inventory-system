from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid
from ..core.database import get_db
from ..models.item import Item
from ..models.history import History
from ..models.user import User
from .auth import get_current_user, require_manager
from .telegram import send_telegram_message

router = APIRouter(prefix="/items", tags=["Items"])

# --- Schemas ---
class ItemCreate(BaseModel):
    item_id: Optional[str] = None
    name: str
    category: str
    quantity: int
    location: str
    picture_url: Optional[str] = None
    notes: Optional[str] = None

class ItemUpdate(BaseModel):
    name: str
    category: str
    quantity: int
    location: str
    picture_url: Optional[str] = None
    notes: Optional[str] = None

class ItemResponse(BaseModel):
    id: str
    item_id: str
    name: str
    category: str
    quantity: int
    location: str
    picture_url: Optional[str]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

# --- Routes ---
@router.get("/")
async def get_items(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """ნივთების სია ფილტრაციით"""
    query = select(Item)

    # ძებნა სახელით ან ID-ით
    if search:
        query = query.where(
            or_(
                Item.name.ilike(f"%{search}%"),
                Item.item_id.ilike(f"%{search}%"),
                Item.notes.ilike(f"%{search}%")
            )
        )
    if category:
        query = query.where(Item.category == category)
    if location:
        query = query.where(Item.location == location)

    query = query.order_by(Item.created_at.desc())
    result = await db.execute(query)
    items = result.scalars().all()

    return {
        "total": len(items),
        "items": [
            {
                "id": str(item.id),
                "item_id": item.item_id,
                "name": item.name,
                "category": item.category,
                "quantity": item.quantity,
                "location": item.location,
                "picture_url": item.picture_url,
                "notes": item.notes,
                "created_at": item.created_at
            }
            for item in items
        ]
    }

@router.post("/", status_code=201)
async def create_item(
    data: ItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    """ახალი ნივთის დამატება"""
    # ID-ის გენერირება თუ არ არის მითითებული
    item_id = data.item_id or f"ITM-{str(uuid.uuid4()).split('-')[0].upper()}"

    # შევამოწმოთ ID უნიკალურია
    result = await db.execute(select(Item).where(Item.item_id == item_id))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Item ID '{item_id}' already exists")

    item = Item(
        item_id=item_id,
        name=data.name,
        category=data.category,
        quantity=data.quantity,
        location=data.location,
        picture_url=data.picture_url,
        notes=data.notes
    )
    db.add(item)

    # ისტორიაში ჩაწერა
    history = History(
        item_id=item_id,
        item_name=data.name,
        action="ADD",
        from_location="N/A",
        to_location=data.location,
        quantity=data.quantity,
        responsible=current_user.full_name,
        comment=data.notes or ""
    )
    db.add(history)
    await db.commit()
    
    await send_telegram_message(
        f"➕ <b>NEW ITEM ADDED</b>\n"
        f"📦 <b>{data.name}</b> [{item_id}]\n"
        f"📍 Location: {data.location}\n"
        f"🔢 Quantity: {data.quantity}\n"
        f"👤 By: {current_user.full_name}"
    )

    return {"message": f"Item '{data.name}' created successfully", "item_id": item_id}

@router.get("/{item_id}")
async def get_item(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """ნივთის დეტალები ID-ით"""
    result = await db.execute(select(Item).where(Item.item_id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    return {
        "id": str(item.id),
        "item_id": item.item_id,
        "name": item.name,
        "category": item.category,
        "quantity": item.quantity,
        "location": item.location,
        "picture_url": item.picture_url,
        "notes": item.notes,
        "created_at": item.created_at
    }

@router.put("/{item_id}")
async def update_item(
    item_id: str,
    data: ItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    """ნივთის განახლება"""
    result = await db.execute(select(Item).where(Item.item_id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    old_location = item.location

    item.name = data.name
    item.category = data.category
    item.quantity = data.quantity
    item.location = data.location
    item.picture_url = data.picture_url
    item.notes = data.notes

    # ისტორიაში ჩაწერა
    history = History(
        item_id=item_id,
        item_name=data.name,
        action="UPDATE",
        from_location=old_location,
        to_location=data.location,
        quantity=data.quantity,
        responsible=current_user.full_name,
        comment="Updated via API"
    )
    db.add(history)
    await db.commit()

    from .telegram import send_telegram_message
    await send_telegram_message(
        f"✏️ <b>ITEM EDITED</b>\n"
        f"📦 <b>{data.name}</b> [{item_id}]\n"
        f"📍 Location: {data.location}\n"
        f"🔢 Quantity: {data.quantity}\n"
        f"👤 By: {current_user.full_name}"
    )
    return {"message": f"Item '{item_id}' updated successfully"}

@router.delete("/{item_id}")
async def delete_item(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    """ნივთის წაშლა"""
    result = await db.execute(select(Item).where(Item.item_id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # ისტორიაში ჩაწერა წაშლამდე
    history = History(
        item_id=item_id,
        item_name=item.name,
        action="DELETE",
        from_location=item.location,
        to_location="DELETED",
        quantity=item.quantity,
        responsible=current_user.full_name,
        comment="Deleted via API"
    )
    db.add(history)
    await db.delete(item)
    await db.commit()

    from .telegram import send_telegram_message
    await send_telegram_message(
        f"🗑️ <b>ITEM DELETED</b>\n"
        f"📦 <b>{item.name}</b> [{item_id}]\n"
        f"📍 Was at: {item.location}\n"
        f"👤 By: {current_user.full_name}"
    )
    return {"message": f"Item '{item_id}' deleted successfully"}
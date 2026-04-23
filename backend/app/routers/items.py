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
    notes: Optional[str] = None

class ItemUpdate(BaseModel):
    name: str
    category: str
    quantity: int
    location: str
    notes: Optional[str] = None

class ItemResponse(BaseModel):
    id: str
    item_id: str
    name: str
    category: str
    quantity: int
    location: str
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
    item_id = data.item_id or str(uuid.uuid4()).split('-')[0].upper()

    # შევამოწმოთ ID უნიკალურია+ლოკაცია ერთად
    result = await db.execute(
        select(Item).where(Item.item_id == item_id, Item.location == data.location)
    )
    if result.scalar_one_or_none():
        history = History(
            item_id=item_id,
            item_name=data.name,
            action="ERROR",
            from_location="N/A",
            to_location=data.location,
            quantity=data.quantity,
            responsible=current_user.full_name,
            comment=f"Already exists at '{data.location}'"
        )
        db.add(history)
        await db.commit()
        raise HTTPException(status_code=400, detail=f"Item ID '{item_id}' already exists at '{data.location}'")

    item = Item(
        item_id=item_id,
        name=data.name,
        category=data.category,
        quantity=data.quantity,
        location=data.location,
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
    """ნივთის დეტალები ID-ით (ყველა ლოკაცია)"""
    result = await db.execute(select(Item).where(Item.item_id == item_id))
    items = result.scalars().all()
    if not items:
        raise HTTPException(status_code=404, detail="Item not found")

    return {
        "item_id": item_id,
        "name": items[0].name,
        "category": items[0].category,
        "notes": items[0].notes,
        "locations": [
            {
                "id": str(item.id),
                "location": item.location,
                "quantity": item.quantity,
                "created_at": item.created_at
            }
            for item in items
        ]
    }

@router.put("/{item_id}")
async def update_item(
    item_id: str,
    data: ItemUpdate,
    location: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    """ნივთის განახლება (location query param-ით კონკრეტული ჩანაწერი)"""
    query = select(Item).where(Item.item_id == item_id)
    if location:
        query = query.where(Item.location == location)
    result = await db.execute(query)
    item = result.scalars().first()
    if not item:
        history = History(
            item_id=item_id,
            item_name="UNKNOWN",
            action="ERROR",
            from_location="N/A",
            to_location="N/A",
            quantity=0,
            responsible=current_user.full_name,
            comment=f"Update failed: Item '{item_id}' not found"
        )
        db.add(history)
        await db.commit()
        raise HTTPException(status_code=404, detail="Item not found")

    old_location = item.location

    item.name = data.name
    item.category = data.category
    item.quantity = data.quantity
    item.location = data.location
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
    location: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    if location:
        # კონკრეტული ლოკაციის ჩანაწერი წაიშლება
        result = await db.execute(
            select(Item).where(Item.item_id == item_id, Item.location == location)
        )
        items_to_delete = result.scalars().all()
    else:
        # ყველა ლოკაციის ჩანაწერი წაიშლება
        result = await db.execute(select(Item).where(Item.item_id == item_id))
        items_to_delete = result.scalars().all()

    if not items_to_delete:
        history = History(
            item_id=item_id,
            item_name="UNKNOWN",
            action="ERROR",
            from_location=location or "N/A",
            to_location="N/A",
            quantity=0,
            responsible=current_user.full_name,
            comment=f"Delete failed: Item '{item_id}' not found at '{location}'"
        )
        db.add(history)
        await db.commit()
        raise HTTPException(status_code=404, detail="Item not found")

    for item in items_to_delete:
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

    await send_telegram_message(
        f"🗑️ <b>ITEM DELETED</b>\n"
        f"📦 <b>{items_to_delete[0].name}</b> [{item_id}]\n"
        f"📍 Location: {location or 'ALL'}\n"
        f"👤 By: {current_user.full_name}"
    )
    return {"message": f"Item '{item_id}' deleted successfully"}
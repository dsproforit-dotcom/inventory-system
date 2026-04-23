from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from ..core.database import get_db
from ..models.item import Item
from ..models.history import History
from ..models.user import User
from .auth import get_current_user, require_manager
from .telegram import send_telegram_message

router = APIRouter(prefix="/transfers", tags=["Transfers"])

class TransferRequest(BaseModel):
    item_id: str
    action: str  # TRANSFER, ISSUE, RESTOCK, WRITE-OFF
    quantity: int
    from_location: str
    to_location: Optional[str] = None
    notes: Optional[str] = None

@router.post("/")
async def execute_transfer(
    data: TransferRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    """ოპერაციის შესრულება"""
    action = data.action.upper()

    # ნივთის მოძებნა
    result = await db.execute(
        select(Item).where(
            Item.item_id == data.item_id,
            Item.location == data.from_location
        )
    )
    item = result.scalar_one_or_none()

    if not item:
        history = History(
            item_id=data.item_id,
            item_name="UNKNOWN",
            action="ERROR",
            from_location=data.from_location,
            to_location="N/A",
            quantity=data.quantity,
            responsible=current_user.full_name,
            comment=f"Item not found at '{data.from_location}'"
        )
        db.add(history)
        await db.commit()
        raise HTTPException(
            status_code=404,
            detail=f"Item '{data.item_id}' not found at '{data.from_location}'"
        )

    # RESTOCK — მარაგის შევსება
    if action == "RESTOCK":
        item.quantity += data.quantity
        history = History(
            item_id=item.item_id,
            item_name=item.name,
            action="RESTOCK",
            from_location="SUPPLIER",
            to_location=data.from_location,
            quantity=data.quantity,
            responsible=current_user.full_name,
            comment=data.notes or ""
        )
        db.add(history)
        await db.commit()
        await send_telegram_message(
            f"📥 <b>RESTOCK</b>\n"
            f"📦 <b>{item.name}</b> [{item.item_id}]\n"
            f"📍 Location: {data.from_location}\n"
            f"🔢 Added: {data.quantity}\n"
            f"👤 By: {current_user.full_name}"
        )
        return {"message": f"Restocked {data.quantity} units. New quantity: {item.quantity}"}

    # დანარჩენი ოპერაციები — მარაგის შემოწმება
    if data.quantity > item.quantity:
        history = History(
            item_id=item.item_id,
            item_name=item.name,
            action="ERROR",
            from_location=data.from_location,
            to_location="N/A",
            quantity=data.quantity,
            responsible=current_user.full_name,
            comment=f"Insufficient stock. Available: {item.quantity}, Requested: {data.quantity}"
        )
        db.add(history)
        await db.commit()
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock. Available: {item.quantity}"
        )

    if action == "TRANSFER":
        if not data.to_location:
            history = History(
                item_id=item.item_id,
                item_name=item.name,
                action="ERROR",
                from_location=data.from_location,
                to_location="N/A",
                quantity=data.quantity,
                responsible=current_user.full_name,
                comment="TRANSFER failed: to_location not specified"
            )
            db.add(history)
            await db.commit()
            raise HTTPException(status_code=400, detail="to_location required for TRANSFER")
        if data.from_location == data.to_location:
            history = History(
                item_id=item.item_id,
                item_name=item.name,
                action="ERROR",
                from_location=data.from_location,
                to_location=data.to_location,
                quantity=data.quantity,
                responsible=current_user.full_name,
                comment="TRANSFER failed: same location"
            )
            db.add(history)
            await db.commit()
            raise HTTPException(status_code=400, detail="Locations cannot be the same")

        # მიმღებ ლოკაციაზე ნივთის მოძებნა
        target_result = await db.execute(
            select(Item).where(
                Item.item_id == data.item_id,
                Item.location == data.to_location
            )
        )
        target = target_result.scalar_one_or_none()

        if target:
            target.quantity += data.quantity
        else:
            new_item = Item(
                item_id=item.item_id,
                name=item.name,
                category=item.category,
                quantity=data.quantity,
                location=data.to_location,
                notes=item.notes
            )
            db.add(new_item)

        item.quantity -= data.quantity
        to_loc = data.to_location

    elif action in ["ISSUE", "WRITE-OFF"]:
        item.quantity -= data.quantity
        to_loc = "REMOVED/CONSUMED"

    else:
        history = History(
            item_id=item.item_id,
            item_name=item.name,
            action="ERROR",
            from_location=data.from_location,
            to_location="N/A",
            quantity=data.quantity,
            responsible=current_user.full_name,
            comment=f"Unknown action: {action}"
        )
        db.add(history)
        await db.commit()
        raise HTTPException(status_code=400, detail=f"Unknown action: {action}")

    # ისტორიაში ჩაწერა
    history = History(
        item_id=item.item_id,
        item_name=item.name,
        action=action,
        from_location=data.from_location,
        to_location=to_loc,
        quantity=data.quantity,
        responsible=current_user.full_name,
        comment=data.notes or ""
    )
    db.add(history)
    await db.commit()

    emoji = {"TRANSFER": "🔄", "ISSUE": "📤", "WRITE-OFF": "🗑️"}
    await send_telegram_message(
        f"{emoji.get(action, '📋')} <b>{action}</b>\n"
        f"📦 <b>{item.name}</b> [{item.item_id}]\n"
        f"📍 {data.from_location}{f' ➔ {to_loc}' if action == 'TRANSFER' else ''}\n"
        f"🔢 Quantity: {data.quantity}\n"
        f"👤 By: {current_user.full_name}"
    )
    return {"message": f"Action '{action}' completed successfully"}
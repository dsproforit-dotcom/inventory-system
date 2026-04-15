from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from ..core.database import get_db
from ..models.setting import Setting
from ..models.user import User
from .auth import get_current_user, require_admin

router = APIRouter(prefix="/settings", tags=["Settings"])

class SettingCreate(BaseModel):
    type: str  # "category" ან "location"
    value: str

@router.get("/")
async def get_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """კატეგორიებისა და ლოკაციების სია"""
    result = await db.execute(select(Setting).order_by(Setting.type, Setting.value))
    settings = result.scalars().all()

    categories = [s.value for s in settings if s.type == "category"]
    locations = [s.value for s in settings if s.type == "location"]

    return {"categories": categories, "locations": locations}

@router.post("/", status_code=201)
async def add_setting(
    data: SettingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """კატეგორიის ან ლოკაციის დამატება"""
    if data.type not in ["category", "location"]:
        raise HTTPException(status_code=400, detail="Type must be 'category' or 'location'")

    # შევამოწმოთ უკვე ხომ არ არსებობს
    result = await db.execute(
        select(Setting).where(
            Setting.type == data.type,
            Setting.value == data.value
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"'{data.value}' already exists")

    setting = Setting(type=data.type, value=data.value)
    db.add(setting)
    await db.commit()

    return {"message": f"'{data.value}' added to {data.type}s"}

@router.delete("/{setting_id}")
async def delete_setting(
    setting_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """კატეგორიის ან ლოკაციის წაშლა"""
    result = await db.execute(select(Setting).where(Setting.id == setting_id))
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")

    await db.delete(setting)
    await db.commit()

    return {"message": f"'{setting.value}' deleted"}
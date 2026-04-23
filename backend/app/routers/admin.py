from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from ..core.database import get_db
from ..models.user import User
from .auth import require_admin
from ..core.security import hash_password

router = APIRouter(prefix="/admin", tags=["Admin"])

class RoleUpdate(BaseModel):
    role: str

@router.get("/users")
async def get_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """ყველა მომხმარებლის სია"""
    result = await db.execute(select(User).order_by(User.created_at))
    users = result.scalars().all()
    return [
        {
            "username": u.username,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at
        }
        for u in users
    ]

@router.put("/users/{username}/role")
async def update_role(
    username: str,
    data: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """როლის შეცვლა"""
    if data.role not in ["viewer", "manager", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role")

    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.role = data.role
    await db.commit()
    return {"message": f"Role updated to {data.role}"}

@router.put("/users/{username}/toggle")
async def toggle_user(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """მომხმარებლის გააქტიურება/დეაქტივაცია"""
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = not user.is_active
    await db.commit()
    return {"message": f"User {'enabled' if user.is_active else 'disabled'}"}

@router.delete("/users/{username}")
async def delete_user(
    username: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """მომხმარებლის წაშლა"""
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if username == current_user.username:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    await db.delete(user)
    await db.commit()
    return {"message": f"User {username} deleted"}



class PasswordReset(BaseModel):
    new_password: str

@router.put("/users/{username}/reset-password")
async def reset_password(
    username: str,
    data: PasswordReset,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """მომხმარებლის პაროლის reset"""
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = hash_password(data.new_password)
    await db.commit()
    return {"message": f"Password reset for {username}"}    
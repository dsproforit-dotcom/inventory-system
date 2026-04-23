from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from ..core.database import get_db
from ..core.security import hash_password, verify_password, create_access_token, decode_token
from ..models.user import User

router = APIRouter(prefix="/auth", tags=["Authentication"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# --- Schemas ---
class UserRegister(BaseModel):
    username: str
    email: str
    password: str
    role: str = "viewer"

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

# --- Dependencies ---
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
):
    """მიმდინარე მომხმარებლის მიღება token-იდან"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token)
    if not payload:
        raise credentials_exception
    
    username = payload.get("sub")
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    
    if not user or not user.is_active:
        raise credentials_exception
    return user

async def require_admin(current_user: User = Depends(get_current_user)):
    """მხოლოდ admin-ისთვის"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

async def require_manager(current_user: User = Depends(get_current_user)):
    """manager და admin-ისთვის"""
    if current_user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Manager access required")
    return current_user

# --- Routes ---
@router.post("/register", status_code=201)
async def register(
    data: UserRegister,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """ახალი მომხმარებლის რეგისტრაცია (მხოლოდ admin)"""
    # შევამოწმოთ username უკვე ხომ არ არსებობს
    result = await db.execute(select(User).where(User.username == data.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already exists")

    # შევამოწმოთ email უკვე ხომ არ არსებობს
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already exists")

    if data.role not in ["viewer", "manager", "admin"]:
        raise HTTPException(status_code=400, detail="Invalid role")

    user = User(
        username=data.username,
        email=data.email,
        hashed_password=hash_password(data.password),
        role=data.role
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return {"message": f"User {user.username} created successfully", "role": user.role}

@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """login და token-ის მიღება"""
    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    token = create_access_token({"sub": user.username})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "username": user.username,
            "role": user.role
        }
    }

@router.get("/users")
async def get_usernames(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_manager)
):
    """იუზერების სია ჩამოსაშლელისთვის (manager+)"""
    result = await db.execute(select(User).where(User.is_active == True))
    users = result.scalars().all()
    return [{"username": u.username} for u in users]

@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """მიმდინარე მომხმარებლის ინფო"""
    return {
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role
    }



class PasswordChange(BaseModel):
    current_password: str
    new_password: str

@router.put("/change-password")
async def change_password(
    data: PasswordChange,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """პაროლის შეცვლა"""
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    current_user.hashed_password = hash_password(data.new_password)
    await db.commit()
    return {"message": "Password changed successfully"}    
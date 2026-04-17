from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .core.database import engine, Base
from .routers import auth, items, history, dashboard, transfers
from .routers import settings as settings_router
from .routers import telegram
from .routers import admin

# აპლიკაციის ინიციალიზაცია
app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="IT Inventory Management System API"
)

# CORS - frontend-ს მისცე წვდომა
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# აპლიკაციის გაშვებისას ცხრილების შექმნა
@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.get("/")
async def root():
    return {"message": f"{settings.APP_NAME} is running!"}

@app.get("/health")
async def health():
    return {"status": "ok"}

# routers
app.include_router(auth.router)
app.include_router(items.router)
app.include_router(history.router)
app.include_router(dashboard.router)
app.include_router(transfers.router)
app.include_router(settings_router.router)
app.include_router(telegram.router)
app.include_router(admin.router)
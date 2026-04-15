from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # მონაცემთა ბაზის კავშირი
    DATABASE_URL: str
    
    # უსაფრთხოება
    SECRET_KEY: str
    ALGORITHM: str = 'HS256'
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    
    # აპლიკაცია
    APP_NAME: str = 'IT Inventory System'
    DEBUG: bool = False
    
    # Telegram
    TELEGRAM_TOKEN: str = ''
    TELEGRAM_CHAT_ID: str = ''
    ALLOWED_CHAT_IDS: str = ''

    model_config = {'env_file': '.env'}

settings = Settings()
import logging
import secrets

from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./dev.db"
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720  # 12 hours
    MAX_FILE_SIZE_MB: int = 10
    PGPASSWORD: str = ""  # пароль PostgreSQL для pg_dump (бэкапы), см. .env

    class Config:
        env_file = ".env"


settings = Settings()

# Never run with a publicly-known default key: an attacker could forge JWTs
# (including director tokens). Generate a random per-process key instead and
# require an explicit SECRET_KEY in .env for sessions to survive restarts.
if not settings.SECRET_KEY or settings.SECRET_KEY == "change-me-in-production":
    settings.SECRET_KEY = secrets.token_urlsafe(48)
    logger.critical(
        "SECRET_KEY is missing or set to the insecure default — generated a random "
        "ephemeral key (all sessions will be invalidated on restart). "
        "Set SECRET_KEY in backend/.env to a long random value to fix this."
    )

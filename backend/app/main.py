import asyncio
import logging
from contextlib import asynccontextmanager

import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from app.database import Base, async_session, engine
from app.routers import auth, notifications, tasks, users, weekly_lists
from app.services.notification_service import check_overdue_tasks, check_upcoming_deadlines
from app.services.score_service import reset_monthly_scores
from app.services.backup_service import create_backup
from app.seed import auto_seed_director


WORKER_INTERVAL = 300  # 5 minutes
BACKUP_INTERVAL = 86400  # 24 hours


async def notification_worker():
    while True:
        await asyncio.sleep(WORKER_INTERVAL)
        async with async_session() as db:
            try:
                await check_upcoming_deadlines(db)
                await check_overdue_tasks(db)
                logger.info("Notification check completed")
            except Exception as e:
                logger.error("Notification worker error: %s", e, exc_info=True)


async def score_worker():
    while True:
        await asyncio.sleep(WORKER_INTERVAL)
        async with async_session() as db:
            try:
                await reset_monthly_scores(db)
                logger.info("Score reset check completed")
            except Exception as e:
                logger.error("Score worker error: %s", e, exc_info=True)


async def backup_worker():
    await asyncio.sleep(BACKUP_INTERVAL)  # first backup after 24h
    while True:
        try:
            await create_backup()
            logger.info("Daily backup completed")
        except Exception as e:
            logger.error("Backup worker error: %s", e, exc_info=True)
        await asyncio.sleep(BACKUP_INTERVAL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await auto_seed_director()
    task1 = asyncio.create_task(notification_worker())
    task2 = asyncio.create_task(score_worker())
    task3 = asyncio.create_task(backup_worker())
    yield
    task1.cancel()
    task2.cancel()
    task3.cancel()


app = FastAPI(title="AutoService Task Manager", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "http://192.168.0.245:5173",
        "https://texturetasks.ru",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(weekly_lists.router)
app.include_router(tasks.router)
app.include_router(notifications.router)

# Security headers
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    # Limit request body size to 11MB (10MB file + overhead)
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > 11 * 1024 * 1024:
                return JSONResponse(status_code=413, content={"detail": "Request too large"})
        except ValueError:
            # Malformed header — let the request through; uvicorn rejects garbage bodies anyway
            pass
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "0"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


@app.get("/health")
async def health():
    return {"status": "ok"}

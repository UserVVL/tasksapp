import logging
import time
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.auth import LoginRequest, Token
from app.schemas.user import UserCreate, UserOut
from app.services.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Simple in-memory rate limiter (per client IP)
_login_attempts: dict[str, list[float]] = defaultdict(list)
LOGIN_WINDOW = 300  # 5 minutes
LOGIN_MAX_ATTEMPTS = 10
MAX_TRACKED_IPS = 5000


def _client_ip(request: Request) -> str:
    # X-Real-IP is set by nginx ($remote_addr) and overwrites any client-supplied value
    xri = request.headers.get("x-real-ip")
    if xri:
        return xri.strip()
    # Fallback: last entry of X-Forwarded-For (appended by the trusted proxy)
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[-1].strip()
    return request.client.host if request.client else "unknown"


def _prune(now: float) -> None:
    if len(_login_attempts) <= MAX_TRACKED_IPS:
        return
    for ip in list(_login_attempts):
        _login_attempts[ip] = [t for t in _login_attempts[ip] if now - t < LOGIN_WINDOW]
        if not _login_attempts[ip]:
            del _login_attempts[ip]


def _check_rate_limit(ip: str):
    now = time.time()
    _prune(now)
    _login_attempts[ip] = [t for t in _login_attempts[ip] if now - t < LOGIN_WINDOW]
    if len(_login_attempts[ip]) >= LOGIN_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many login attempts. Try again later.")


@router.post("/register", response_model=UserOut, status_code=201)
async def register(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.director, UserRole.manager):
        raise HTTPException(status_code=403, detail="Only director/manager can register users")
    if current_user.role != UserRole.director and data.role == UserRole.director:
        raise HTTPException(status_code=403, detail="Only director can create a director account")
    result = await db.execute(select(User).where(User.username == data.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Registration failed")
    user = User(
        username=data.username,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        role=data.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    logger.info("User registered: id=%s role=%s by=%s", user.id, user.role.value, current_user.id)
    return user


@router.post("/login", response_model=Token)
async def login(data: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    ip = _client_ip(request)
    _check_rate_limit(ip)

    result = await db.execute(select(User).where(User.username == data.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.hashed_password):
        _login_attempts[ip].append(time.time())
        logger.warning("Failed login attempt: username=%s ip=%s", data.username, ip)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    _login_attempts.pop(ip, None)
    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    logger.info("Login success: user_id=%s role=%s ip=%s", user.id, user.role.value, ip)
    return Token(access_token=token)


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user

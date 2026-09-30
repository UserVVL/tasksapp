import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.models.task import Task, TaskStatus
from app.models.task_assignees import task_assignees
from app.schemas.user import UserCreate, UserOut, UserUpdate, MonthlyScoresOut, MonthlyScoreItem
from app.services.auth import get_current_user, hash_password

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(User).order_by(User.full_name)
    # Non-directors see only active users
    if current_user.role != UserRole.director:
        query = query.where(User.is_active == True)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/monthly-scores", response_model=list[MonthlyScoresOut])
async def get_monthly_scores(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.director, UserRole.manager):
        raise HTTPException(status_code=403, detail="Only director/manager can view scores")

    # Portable query (works on PostgreSQL and SQLite): date part extracted in Python
    rows = await db.execute(
        text("""
            SELECT
                u.id AS user_id,
                u.full_name,
                u.is_active,
                t.completed_at,
                t.rating
            FROM users u
            LEFT JOIN task_assignees ta ON ta.user_id = u.id
            LEFT JOIN tasks t ON t.id = ta.task_id
                AND t.status = 'done' AND t.completed_at IS NOT NULL
            WHERE u.role IN ('painter', 'admin')
            ORDER BY u.full_name, t.completed_at DESC
        """)
    )
    raw = rows.fetchall()

    grouped: dict[int, dict] = {}
    month_sums: dict[int, dict[tuple[int, int], int]] = {}
    for user_id, full_name, is_active, completed_at, rating in raw:
        if user_id not in grouped:
            grouped[user_id] = {"user_id": user_id, "full_name": full_name, "is_active": is_active}
            month_sums[user_id] = {}
        if completed_at is None or rating is None:
            continue
        if isinstance(completed_at, str):
            year, month = int(completed_at[0:4]), int(completed_at[5:7])
        else:
            year, month = completed_at.year, completed_at.month
        key = (year, month)
        month_sums[user_id][key] = month_sums[user_id].get(key, 0) + int(rating)

    return [
        MonthlyScoresOut(
            **info,
            months=[
                MonthlyScoreItem(year=year, month=month, score=score)
                for (year, month), score in sorted(
                    month_sums[user_id].items(), key=lambda kv: (-kv[0][0], -kv[0][1])
                )
            ],
        )
        for user_id, info in grouped.items()
    ]


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Manager cannot view director profiles
    if current_user.role == UserRole.manager:
        result = await db.execute(select(User.role).where(User.id == user_id))
        user_role_row = result.scalar_one_or_none()
        if user_role_row == UserRole.director:
            raise HTTPException(status_code=403, detail="Manager cannot view director profile")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.director, UserRole.manager):
        raise HTTPException(status_code=403, detail="Only director/manager can update users")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if current_user.role == UserRole.manager and user.role == UserRole.director:
        raise HTTPException(status_code=403, detail="Manager cannot edit director")
    if (current_user.role == UserRole.manager and user.role == UserRole.manager
            and user.id != current_user.id):
        raise HTTPException(status_code=403, detail="Manager cannot edit another manager")

    if not user.is_active and not data.is_active:
        raise HTTPException(status_code=400, detail="Cannot edit a fired employee")

    if data.is_active is not None:
        user.is_active = data.is_active
        await db.commit()
        await db.refresh(user)
        return user

    if data.full_name is not None:
        user.full_name = data.full_name
    if data.role is not None:
        if current_user.role == UserRole.manager and data.role == UserRole.director:
            raise HTTPException(status_code=403, detail="Manager cannot promote to director")
        user.role = data.role
    if data.password is not None:
        user.hashed_password = hash_password(data.password)
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.director, UserRole.manager):
        raise HTTPException(status_code=403, detail="Only director/manager can delete users")
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if current_user.role == UserRole.manager and user.role == UserRole.director:
        raise HTTPException(status_code=403, detail="Manager cannot delete director")
    if current_user.role == UserRole.manager and user.role == UserRole.manager:
        raise HTTPException(status_code=403, detail="Manager cannot delete another manager")
    user.is_active = False
    await db.commit()
    logger.info("User deactivated: id=%s by=%s", user_id, current_user.id)

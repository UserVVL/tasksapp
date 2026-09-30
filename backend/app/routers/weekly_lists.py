from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.models.weekly_list import WeeklyList
from app.models.task import Task, TaskStatus
from app.schemas.weekly_list import WeeklyListCreate, WeeklyListOut
from app.services.auth import get_current_user

router = APIRouter(prefix="/api/weekly-lists", tags=["weekly-lists"])


ARCHIVED_STATUSES = [TaskStatus.done, TaskStatus.overdue, TaskStatus.cancelled]


@router.get("/", response_model=list[WeeklyListOut])
async def list_weekly_lists(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(WeeklyList)
        .options(selectinload(WeeklyList.tasks).selectinload(Task.assignees))
        .order_by(WeeklyList.week_start.desc())
    )
    lists = result.scalars().all()
    for wl in lists:
        wl.tasks = [t for t in wl.tasks if t.status not in ARCHIVED_STATUSES]
    return lists


@router.post("/", response_model=WeeklyListOut, status_code=201)
async def create_weekly_list(
    data: WeeklyListCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.director, UserRole.manager):
        raise HTTPException(status_code=403, detail="Only director/manager can create weekly lists")
    wl = WeeklyList(
        title=data.title,
        week_start=data.week_start,
        week_end=data.week_end,
        created_by=current_user.id,
    )
    db.add(wl)
    await db.commit()
    await db.refresh(wl)
    result = await db.execute(
        select(WeeklyList)
        .options(selectinload(WeeklyList.tasks).selectinload(Task.assignees))
        .where(WeeklyList.id == wl.id)
    )
    return result.scalar_one()


@router.get("/{wl_id}", response_model=WeeklyListOut)
async def get_weekly_list(
    wl_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(WeeklyList)
        .options(selectinload(WeeklyList.tasks).selectinload(Task.assignees))
        .where(WeeklyList.id == wl_id)
    )
    wl = result.scalar_one_or_none()
    if not wl:
        raise HTTPException(status_code=404, detail="Weekly list not found")
    wl.tasks = [t for t in wl.tasks if t.status not in ARCHIVED_STATUSES]
    return wl


@router.delete("/{wl_id}", status_code=204)
async def delete_weekly_list(
    wl_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.director:
        raise HTTPException(status_code=403, detail="Only director can delete weekly lists")
    result = await db.execute(select(WeeklyList).where(WeeklyList.id == wl_id))
    wl = result.scalar_one_or_none()
    if not wl:
        raise HTTPException(status_code=404, detail="Weekly list not found")
    await db.delete(wl)
    await db.commit()

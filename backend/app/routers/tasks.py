import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone

import magic
from fastapi import APIRouter, Body, Depends, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.task import Task, TaskStatus

from app.models.task_history import TaskHistory
from app.models.task_image import TaskImage
from app.models.user import User, UserRole
from app.models.notification import Notification, NotificationType
from app.schemas.task import TaskCreate, TaskOut, TaskUpdate
from app.services.auth import get_current_user

logger = logging.getLogger(__name__)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
MAX_IMAGES = 10
MAX_FILE_SIZE = settings.MAX_FILE_SIZE_MB * 1024 * 1024

def _write_file(path: str, content: bytes) -> None:
    with open(path, "wb") as f:
        f.write(content)


router = APIRouter(prefix="/api/tasks", tags=["tasks"])

MANAGER_ROLES = (UserRole.director, UserRole.manager)
ARCHIVED_STATUSES = [TaskStatus.done, TaskStatus.overdue, TaskStatus.cancelled]
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif"}
# Extension is derived from the detected content type — never from the client filename
MIME_TO_EXT = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "image/heif": ".heif",
}
EXT_TO_MEDIA = {ext: mime for mime, ext in MIME_TO_EXT.items()}


async def _load_task(task_id: int, db: AsyncSession) -> Task:
    result = await db.execute(
        select(Task).options(selectinload(Task.assignees), selectinload(Task.images)).where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


def _ensure_assignee(task: Task, user: User) -> None:
    """Workers (painter/admin) may only act on tasks assigned to them."""
    if user.role in MANAGER_ROLES:
        return
    if user.id not in {a.id for a in task.assignees}:
        raise HTTPException(status_code=403, detail="You are not assigned to this task")


async def _notify(db: AsyncSession, user_id: int, task_id: int, ntype: NotificationType, message: str):
    db.add(Notification(user_id=user_id, task_id=task_id, type=ntype, message=message))


@router.get("/", response_model=list[TaskOut])
async def list_tasks(
    weekly_list_id: int | None = None,
    assignee_id: int | None = None,
    status: TaskStatus | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Task).options(selectinload(Task.assignees))
    # Non-managers see only their own tasks
    if current_user.role not in MANAGER_ROLES:
        query = query.where(Task.assignees.any(User.id == current_user.id))
    if weekly_list_id is not None:
        query = query.where(Task.weekly_list_id == weekly_list_id)
    if assignee_id is not None:
        query = query.where(Task.assignees.any(User.id == assignee_id))
    if status is not None:
        query = query.where(Task.status == status)
    else:
        query = query.where(Task.status.notin_(ARCHIVED_STATUSES))
    query = query.order_by(Task.deadline.asc().nulls_last(), Task.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=TaskOut, status_code=201)
async def create_task(
    weekly_list_id: int,
    data: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Only director/manager can create tasks")

    # Resolve assignees (active only)
    assignees = []
    if data.assignee_ids:
        result = await db.execute(
            select(User).where(User.id.in_(data.assignee_ids), User.is_active == True)
        )
        assignees = list(result.scalars().all())

    task = Task(
        weekly_list_id=weekly_list_id,
        created_by=current_user.id,
        title=data.title,
        description=data.description,
        room=data.room,
        status=TaskStatus.pool,
        deadline=data.deadline,
    )
    task.assignees = assignees
    db.add(task)
    await db.commit()
    await db.refresh(task)

    # Notify assignees
    for a in assignees:
        await _notify(db, a.id, task.id, NotificationType.task_assigned, f"Новая задача: {task.title}")
    await db.commit()
    logger.info("Task created: id=%s by=%s", task.id, current_user.id)

    result = await db.execute(
        select(Task).options(selectinload(Task.assignees)).where(Task.id == task.id)
    )
    return result.scalar_one()


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: int,
    data: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Only director/manager can edit tasks")

    task = await _load_task(task_id, db)

    changes = []
    update_data = data.model_dump(exclude_unset=True)

    # Handle assignee changes (active users only)
    if "assignee_ids" in update_data:
        result = await db.execute(
            select(User).where(User.id.in_(update_data["assignee_ids"]), User.is_active == True)
        )
        task.assignees = list(result.scalars().all())
        del update_data["assignee_ids"]

    for field, value in update_data.items():
        old = getattr(task, field)
        if old != value:
            changes.append(TaskHistory(
                task_id=task.id,
                changed_by=current_user.id,
                field=field,
                old_value=str(old) if old is not None else None,
                new_value=str(value) if value is not None else None,
            ))
            setattr(task, field, value)

    for ch in changes:
        db.add(ch)
    await db.commit()
    await db.refresh(task)
    logger.info("Task updated: id=%s by=%s changes=%s", task.id, current_user.id, list(update_data.keys()))
    return task


@router.post("/{task_id}/start", response_model=TaskOut)
async def start_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = await _load_task(task_id, db)
    if current_user.role not in (UserRole.admin, UserRole.painter):
        raise HTTPException(status_code=403, detail="Only painters can start tasks")
    _ensure_assignee(task, current_user)
    if task.status != TaskStatus.pool:
        raise HTTPException(status_code=400, detail="Task is not in pool")

    task.status = TaskStatus.in_progress
    db.add(TaskHistory(task_id=task.id, changed_by=current_user.id, field="status",
                        old_value=TaskStatus.pool.value, new_value=TaskStatus.in_progress.value))
    await db.commit()
    await db.refresh(task)
    logger.info("Task started: id=%s by=%s", task.id, current_user.id)
    return task


@router.post("/{task_id}/complete", response_model=TaskOut)
async def complete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = await _load_task(task_id, db)
    if current_user.role not in (UserRole.admin, UserRole.painter):
        raise HTTPException(status_code=403, detail="Only painters can complete tasks")
    _ensure_assignee(task, current_user)
    if task.status != TaskStatus.in_progress:
        raise HTTPException(status_code=400, detail="Task is not in progress")

    task.status = TaskStatus.review
    db.add(TaskHistory(task_id=task.id, changed_by=current_user.id, field="status",
                        old_value=TaskStatus.in_progress.value, new_value=TaskStatus.review.value))

    # Notify all managers
    result = await db.execute(select(User).where(User.role.in_([UserRole.director, UserRole.manager])))
    managers = result.scalars().all()
    for m in managers:
        await _notify(db, m.id, task.id, NotificationType.status_changed,
                       f"Задача '{task.title}' поступила на проверку")

    await db.commit()
    await db.refresh(task)
    logger.info("Task completed: id=%s by=%s", task.id, current_user.id)
    return task


@router.post("/{task_id}/cancel", response_model=TaskOut)
async def cancel_task(
    task_id: int,
    comment: str = Body(default="", embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = await _load_task(task_id, db)
    if current_user.role not in (UserRole.admin, UserRole.painter):
        raise HTTPException(status_code=403, detail="Only painters can cancel tasks")
    _ensure_assignee(task, current_user)
    if task.status != TaskStatus.in_progress:
        raise HTTPException(status_code=400, detail="Task is not in progress")

    task.status = TaskStatus.review
    task.review_comment = comment
    db.add(TaskHistory(task_id=task.id, changed_by=current_user.id, field="status",
                        old_value=TaskStatus.in_progress.value, new_value=TaskStatus.review.value))

    result = await db.execute(select(User).where(User.role.in_([UserRole.director, UserRole.manager])))
    managers = result.scalars().all()
    for m in managers:
        await _notify(db, m.id, task.id, NotificationType.review_ready,
                       f"Задача '{task.title}' не выполнена: {comment or 'без комментария'}. Требуется проверка.")

    await db.commit()
    await db.refresh(task)
    logger.info("Task cancelled: id=%s by=%s", task.id, current_user.id)
    return task


@router.post("/{task_id}/review", response_model=TaskOut)
async def review_task(
    task_id: int,
    rating: int = Body(default=5, embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Only director/manager can review")
    if rating < -5 or rating > 5 or rating == 0:
        raise HTTPException(status_code=400, detail="Rating must be -5 to -1 or 1 to 5")

    task = await _load_task(task_id, db)
    if task.status != TaskStatus.review:
        raise HTTPException(status_code=400, detail="Task is not under review")

    if task.review_comment:
        # Task was cancelled by worker — approve cancellation, no points
        task.status = TaskStatus.cancelled
        task.completed_at = datetime.now(timezone.utc)
        db.add(TaskHistory(task_id=task.id, changed_by=current_user.id, field="status",
                            old_value=TaskStatus.review.value, new_value=TaskStatus.cancelled.value))
    else:
        # Normal completion — award or deduct points
        task.status = TaskStatus.done
        task.rating = rating
        task.completed_at = datetime.now(timezone.utc)
        for a in task.assignees:
            a.score += rating
        db.add(TaskHistory(task_id=task.id, changed_by=current_user.id, field="status",
                            old_value=TaskStatus.review.value, new_value=TaskStatus.done.value))

    # Mark all review_ready and status_changed notifications for this task as read
    notif_result = await db.execute(
        select(Notification).where(
            Notification.task_id == task.id,
            Notification.type.in_([NotificationType.review_ready, NotificationType.status_changed]),
            Notification.is_read == False,
        )
    )
    for n in notif_result.scalars().all():
        n.is_read = True
    await db.commit()
    await db.refresh(task)
    logger.info("Task reviewed: id=%s by=%s rating=%s", task.id, current_user.id, rating)
    return task


@router.get("/archive", response_model=list[TaskOut])
async def get_archive(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Task).options(selectinload(Task.assignees)).where(
        Task.status.in_([TaskStatus.done, TaskStatus.overdue, TaskStatus.cancelled])
    )
    query = query.order_by(Task.completed_at.desc().nullslast(), Task.updated_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{task_id}/images")
async def get_task_images(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TaskImage).where(TaskImage.task_id == task_id).order_by(TaskImage.uploaded_at)
    )
    images = result.scalars().all()
    return [
        {"id": img.id, "filename": img.filename, "original_name": img.original_name,
         "uploaded_at": img.uploaded_at.isoformat(), "uploaded_by": img.uploaded_by,
         "url": f"/tasks/{task_id}/images/{img.filename}"}
        for img in images
    ]


@router.post("/{task_id}/images")
async def upload_task_image(
    task_id: int,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = await _load_task(task_id, db)
    if current_user.role not in (UserRole.director, UserRole.manager, UserRole.admin, UserRole.painter):
        raise HTTPException(status_code=403, detail="Not allowed")

    # Non-managers must be assigned to the task (any status)
    _ensure_assignee(task, current_user)

    # Check image count
    result = await db.execute(
        select(TaskImage).where(TaskImage.task_id == task_id)
    )
    existing = result.scalars().all()
    if len(existing) >= MAX_IMAGES:
        raise HTTPException(status_code=400, detail=f"Max {MAX_IMAGES} images per task")

    # Read content
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"File exceeds max size of {settings.MAX_FILE_SIZE_MB}MB")

    # Validate file type via magic bytes and derive extension from it
    mime = magic.from_buffer(content[:2048], mime=True)
    if mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid image type: {mime}")

    # Save file
    ext = MIME_TO_EXT[mime]
    unique_name = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)
    await asyncio.to_thread(_write_file, file_path, content)

    img = TaskImage(
        task_id=task_id,
        filename=unique_name,
        original_name=file.filename or "image.jpg",
        uploaded_by=current_user.id,
    )
    db.add(img)
    await db.commit()
    await db.refresh(img)

    logger.info("Image uploaded: task=%s file=%s by=%s", task_id, unique_name, current_user.id)
    return {"id": img.id, "filename": img.filename, "original_name": img.original_name,
            "uploaded_at": img.uploaded_at.isoformat(), "uploaded_by": img.uploaded_by,
            "url": f"/tasks/{task_id}/images/{img.filename}"}


# Authenticated image serving (replaces unprotected StaticFiles mount)
# Accepts token either via Authorization header or ?token= (for <img> tags)
@router.get("/{task_id}/images/{filename}")
async def serve_task_image(
    task_id: int,
    filename: str,
    request: Request,
    token: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    from jose import JWTError, jwt
    from app.config import settings

    auth_header = request.headers.get("Authorization")
    access_token = token or (auth_header[7:] if auth_header and auth_header.startswith("Bearer ") else None)
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(access_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid token")

    result_user = await db.execute(select(User).where(User.id == user_id))
    user = result_user.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    result = await db.execute(
        select(TaskImage).where(TaskImage.task_id == task_id, TaskImage.filename == filename)
    )
    img = result.scalar_one_or_none()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    file_path = os.path.join(UPLOAD_DIR, img.filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    # Explicit media type from the whitelisted extension stored at upload time
    media_type = EXT_TO_MEDIA.get(os.path.splitext(img.filename)[1].lower(), "application/octet-stream")
    return FileResponse(file_path, media_type=media_type)


@router.delete("/{task_id}/images/{image_id}", status_code=204)
async def delete_task_image(
    task_id: int,
    image_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TaskImage).where(TaskImage.id == image_id, TaskImage.task_id == task_id)
    )
    img = result.scalar_one_or_none()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")
    # Only the uploader or managers can delete
    if current_user.id != img.uploaded_by and current_user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Not allowed")
    # Delete file from disk
    file_path = os.path.join(UPLOAD_DIR, img.filename)
    if os.path.exists(file_path):
        os.remove(file_path)
    await db.delete(img)
    await db.commit()
    logger.info("Image deleted: task=%s image=%s by=%s", task_id, image_id, current_user.id)


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Only director/manager can delete tasks")
    task = await _load_task(task_id, db)
    # Delete associated image files
    for img in task.images:
        file_path = os.path.join(UPLOAD_DIR, img.filename)
        if os.path.exists(file_path):
            os.remove(file_path)
    await db.delete(task)
    await db.commit()
    logger.info("Task deleted: id=%s by=%s", task_id, current_user.id)

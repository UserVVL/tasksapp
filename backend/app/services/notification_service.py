from datetime import timedelta, timezone, datetime

from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification, NotificationType
from app.models.task import Task, TaskStatus
from app.models.user import User, UserRole


async def _notif_exists(db: AsyncSession, user_id: int, task_id: int, ntype: NotificationType) -> bool:
    result = await db.execute(
        select(Notification).where(
            and_(
                Notification.user_id == user_id,
                Notification.task_id == task_id,
                Notification.type == ntype,
            )
        ).limit(1)
    )
    return result.scalar_one_or_none() is not None


async def check_upcoming_deadlines(db: AsyncSession):
    now = datetime.now(timezone.utc)
    soon = now + timedelta(hours=24)

    result = await db.execute(
        select(Task)
        .options(selectinload(Task.assignees))
        .where(
            Task.status.in_([TaskStatus.pool, TaskStatus.in_progress]),
            Task.deadline.isnot(None),
            Task.deadline <= soon,
            Task.deadline >= now,
        )
    )
    tasks = result.scalars().all()

    for task in tasks:
        for a in task.assignees:
            if await _notif_exists(db, a.id, task.id, NotificationType.deadline_soon):
                continue
            notif = Notification(
                user_id=a.id,
                task_id=task.id,
                type=NotificationType.deadline_soon,
                message=f"У задачи '{task.title}' скоро дедлайн: {task.deadline.strftime('%d.%m.%Y %H:%M')}",
            )
            db.add(notif)
    await db.commit()


async def check_overdue_tasks(db: AsyncSession):
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(Task)
        .options(selectinload(Task.assignees))
        .where(
            Task.status.in_([TaskStatus.pool, TaskStatus.in_progress]),
            Task.deadline.isnot(None),
            Task.deadline < now,
        )
    )
    overdue_tasks = result.scalars().all()

    for task in overdue_tasks:
        old_status = task.status.value
        task.status = TaskStatus.overdue
        task.completed_at = datetime.now(timezone.utc)

        # Add history entry (use the creator as the actor)
        from app.models.task_history import TaskHistory
        db.add(TaskHistory(
            task_id=task.id,
            changed_by=task.created_by,
            field="status",
            old_value=old_status,
            new_value=TaskStatus.overdue.value,
        ))

        for a in task.assignees:
            if await _notif_exists(db, a.id, task.id, NotificationType.overdue):
                continue
            db.add(Notification(
                user_id=a.id,
                task_id=task.id,
                type=NotificationType.overdue,
                message=f"Задача '{task.title}' просрочена! Дедлайн был: {task.deadline.strftime('%d.%m.%Y %H:%M')}",
            ))

        # Notify managers too
        mgr_result = await db.execute(
            select(User).where(User.role.in_([UserRole.director, UserRole.manager]))
        )
        for m in mgr_result.scalars().all():
            if await _notif_exists(db, m.id, task.id, NotificationType.overdue):
                continue
            db.add(Notification(
                user_id=m.id,
                task_id=task.id,
                type=NotificationType.overdue,
                message=f"Задача '{task.title}' просрочена! Дедлайн был: {task.deadline.strftime('%d.%m.%Y %H:%M')}",
            ))

    await db.commit()

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TaskStatus(str, enum.Enum):
    pool = "pool"
    in_progress = "in_progress"
    review = "review"
    done = "done"
    overdue = "overdue"
    cancelled = "cancelled"


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    weekly_list_id: Mapped[int] = mapped_column(Integer, ForeignKey("weekly_lists.id"))
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    room: Mapped[str] = mapped_column(String(50), default="прочие задачи")
    status: Mapped[TaskStatus] = mapped_column(Enum(TaskStatus, native_enum=False), default=TaskStatus.pool)
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    review_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    weekly_list: Mapped["WeeklyList"] = relationship(back_populates="tasks")
    creator: Mapped["User"] = relationship(foreign_keys=[created_by])
    assignees: Mapped[list["User"]] = relationship(secondary="task_assignees", back_populates="assigned_tasks")
    history: Mapped[list["TaskHistory"]] = relationship(back_populates="task", cascade="all, delete-orphan")
    images: Mapped[list["TaskImage"]] = relationship(back_populates="task", cascade="all, delete-orphan")

from datetime import datetime, timezone, timedelta

from pydantic import BaseModel, ConfigDict, model_validator

from app.models.task import TaskStatus
from app.schemas.user import UserOut


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    weekly_list_id: int
    created_by: int
    title: str
    description: str
    room: str
    status: TaskStatus
    rating: int | None
    review_comment: str | None
    completed_at: datetime | None
    deadline: datetime | None
    created_at: datetime
    updated_at: datetime
    assignees: list[UserOut] = []


class TaskCreate(BaseModel):
    title: str
    description: str = ""
    room: str = "прочие задачи"
    deadline: datetime
    assignee_ids: list[int] = []

    @model_validator(mode="after")
    def validate_deadline(self) -> "TaskCreate":
        now = datetime.now(timezone(timedelta(hours=3)))
        deadline = self.deadline if self.deadline.tzinfo else self.deadline.replace(tzinfo=timezone(timedelta(hours=3)))
        if deadline < now:
            raise ValueError("deadline must be now or later")
        return self


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    room: str | None = None
    status: TaskStatus | None = None
    assignee_ids: list[int] | None = None
    deadline: datetime | None = None
    review_comment: str | None = None
    rating: int | None = None

    @model_validator(mode="after")
    def validate_deadline(self) -> "TaskUpdate":
        if self.deadline is not None:
            now = datetime.now(timezone(timedelta(hours=3)))
            deadline = self.deadline if self.deadline.tzinfo else self.deadline.replace(tzinfo=timezone(timedelta(hours=3)))
            if deadline < now:
                raise ValueError("deadline must be now or later")
        return self

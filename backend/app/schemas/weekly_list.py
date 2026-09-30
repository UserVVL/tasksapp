from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.task import TaskOut


class WeeklyListOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    week_start: date
    week_end: date
    created_by: int
    created_at: datetime
    tasks: list[TaskOut] = []


class WeeklyListCreate(BaseModel):
    title: str
    week_start: date
    week_end: date

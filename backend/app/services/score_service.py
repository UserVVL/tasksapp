from datetime import datetime, timezone

from sqlalchemy import select, update

from app.database import AsyncSession
from app.models.user import User


async def reset_monthly_scores(db: AsyncSession) -> None:
    now = datetime.now(timezone.utc)
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    result = await db.execute(
        select(User.id).where(
            User.score > 0,
            (User.score_reset_at == None) | (User.score_reset_at < start_of_month),
        )
    )
    user_ids = [row[0] for row in result.fetchall()]
    if not user_ids:
        return

    await db.execute(
        update(User)
        .where(User.id.in_(user_ids))
        .values(score=0, score_reset_at=now)
    )
    await db.commit()

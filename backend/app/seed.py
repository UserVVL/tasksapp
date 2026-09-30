import asyncio
import logging
import secrets
import string
import sys

from sqlalchemy import select
from app.database import async_session, engine, Base
from app.models.user import User, UserRole
from app.services.auth import hash_password

logger = logging.getLogger(__name__)


def _generate_password(length: int = 16) -> str:
    chars = string.ascii_letters + string.digits + "!@#$%^&*()-_=+"
    return "".join(secrets.choice(chars) for _ in range(length))


async def auto_seed_director():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        existing = await db.execute(select(User).where(User.username == "director"))
        if existing.scalar_one_or_none():
            return

        password = _generate_password()

        director = User(
            username="director",
            hashed_password=hash_password(password),
            full_name="Директор",
            role=UserRole.director,
        )
        db.add(director)
        await db.commit()

        logger.info("=" * 50)
        logger.info("  Director account created!")
        logger.info("=" * 50)
        logger.info(f"  Username: director")
        # password goes to interactive stdout only, never to the application log
        print(f"  Password: {password}")
        logger.info("=" * 50)
        logger.warning("  SAVE THIS PASSWORD and change it after first login!")
        logger.info("=" * 50)


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        existing = await db.execute(select(User).where(User.username == "director"))
        if existing.scalar_one_or_none():
            print("Director already exists. Seed skipped.")
            return

        password = sys.argv[1] if len(sys.argv) > 1 else _generate_password()

        director = User(
            username="director",
            hashed_password=hash_password(password),
            full_name="Директор",
            role=UserRole.director,
        )
        db.add(director)
        await db.commit()

        print("=" * 50)
        print("  Production seed completed!")
        print("=" * 50)
        print(f"  Username: director")
        print(f"  Password: {password}")
        print("=" * 50)
        print("  IMPORTANT: Save this password and delete the terminal history!")
        print("=" * 50)


if __name__ == "__main__":
    asyncio.run(seed())

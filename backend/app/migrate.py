import asyncio
from sqlalchemy import text
from app.database import async_session


async def migrate():
    async with async_session() as db:
        result = await db.execute(text("SELECT COUNT(*) FROM users WHERE role = 'worker'"))
        count = result.scalar()

        if count:
            await db.execute(text("UPDATE users SET role = 'painter' WHERE role = 'worker'"))
            print(f"Migrated {count} users: worker -> painter")
        else:
            print("No 'worker' roles found — skipping")

        await db.execute(text(
            "UPDATE users SET full_name = 'Анна Смирнова' WHERE username = 'director'"
        ))
        await db.execute(text(
            "UPDATE users SET full_name = 'Иван Кузнецов' WHERE username = 'manager'"
        ))
        await db.execute(text(
            "UPDATE users SET full_name = 'Мария Попова' WHERE username = 'admin'"
        ))
        await db.execute(text(
            "UPDATE users SET full_name = 'Пётр Иванов' WHERE username = 'painter1'"
        ))
        await db.execute(text(
            "UPDATE users SET full_name = 'Саша Петров' WHERE username = 'painter2'"
        ))
        print("Updated full_names")

        # Migrate deadline from Date to DateTime format
        await db.execute(text("""
            UPDATE tasks
            SET deadline = deadline || 'T23:59:00+00:00'
            WHERE deadline IS NOT NULL
              AND deadline NOT LIKE '%T%'
        """))
        print("Migrated deadlines to datetime")

        await db.commit()
        print("Migration complete")


if __name__ == "__main__":
    asyncio.run(migrate())

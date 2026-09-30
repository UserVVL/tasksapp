import asyncio
import os
import shutil
import subprocess
import glob
import logging
from datetime import datetime

from app.config import settings

logger = logging.getLogger(__name__)

BACKUP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "backups")
UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
MAX_BACKUPS = 7

PG_HOST = os.environ.get("PG_HOST", "localhost")
PG_PORT = os.environ.get("PG_PORT", "5432")
PG_DB = os.environ.get("PG_DB", "texturetasks")
PG_USER = os.environ.get("PG_USER", "texturetasks")


def _get_backups():
    return sorted(glob.glob(os.path.join(BACKUP_DIR, "backup-*.sql")))


def _rotate():
    backups = _get_backups()
    while len(backups) > MAX_BACKUPS:
        oldest = backups.pop(0)
        old_name = os.path.splitext(os.path.basename(oldest))[0]
        old_uploads = os.path.join(BACKUP_DIR, old_name + "-uploads")
        if os.path.exists(old_uploads):
            shutil.rmtree(old_uploads)
            logger.info("Removed old uploads backup: %s", old_uploads)
        os.remove(oldest)
        logger.info("Removed old backup: %s", oldest)


def _do_backup():
    os.makedirs(BACKUP_DIR, exist_ok=True)
    try:
        os.chmod(BACKUP_DIR, 0o700)
    except OSError:
        pass
    timestamp = datetime.now().strftime("%Y-%m-%d-%H%M%S")
    backup_name = f"backup-{timestamp}"
    backup_db = os.path.join(BACKUP_DIR, f"{backup_name}.sql")
    backup_uploads = os.path.join(BACKUP_DIR, f"{backup_name}-uploads")

    env = os.environ.copy()
    env["PGPASSWORD"] = settings.PGPASSWORD
    result = subprocess.run(
        ["pg_dump", "-h", PG_HOST, "-p", PG_PORT, "-U", PG_USER, "-d", PG_DB, "-f", backup_db],
        env=env,
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        logger.info("Backup created: %s", backup_db)
        try:
            os.chmod(backup_db, 0o600)
        except OSError:
            pass
    else:
        logger.error("pg_dump failed: %s", result.stderr)
        return

    if os.path.exists(UPLOADS_DIR):
        shutil.copytree(UPLOADS_DIR, backup_uploads, dirs_exist_ok=True)
        logger.info("Uploads backup created: %s", backup_uploads)
        try:
            os.chmod(backup_uploads, 0o700)
            for root, dirs, files in os.walk(backup_uploads):
                for f in files:
                    os.chmod(os.path.join(root, f), 0o600)
        except OSError:
            pass
    else:
        logger.warning("Uploads directory not found: %s", UPLOADS_DIR)

    _rotate()


async def create_backup():
    try:
        await asyncio.to_thread(_do_backup)
    except Exception as e:
        logger.error("Backup failed: %s", e, exc_info=True)

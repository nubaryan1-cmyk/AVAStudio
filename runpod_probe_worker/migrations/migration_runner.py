"""
AVA MIGRATION RUNNER

================================================================================
Runs database migrations at startup (idempotently).
================================================================================

Usage:
    python migration_runner.py
    
    Or called automatically at API server startup.
"""

import os
import sys
import glob
from pathlib import Path
from typing import List, Set

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.config import get_config
from services.observability import get_logger

logger = get_logger()


def get_migrations_dir() -> Path:
    """Get migrations directory path."""
    return Path(__file__).parent


def get_migration_files() -> List[Path]:
    """Get sorted list of migration files."""
    migrations_dir = get_migrations_dir()
    files = sorted(migrations_dir.glob("*.sql"))
    return files


def get_applied_migrations_sqlite(conn) -> Set[str]:
    """Get set of applied migration versions (SQLite)."""
    try:
        cur = conn.execute("SELECT version FROM schema_migrations")
        return {row[0] for row in cur.fetchall()}
    except:
        # Table doesn't exist yet
        return set()


def run_migrations_sqlite() -> None:
    """
    Run migrations for SQLite (STAGING/LOCAL).
    
    Note: SQLite doesn't support all Postgres features,
    so we use a simplified schema.
    """
    from services.db import get_db
    
    db = get_db()
    db.init_schema()  # This creates SQLite tables
    
    logger.info("migrations_sqlite_complete", message="SQLite schema initialized")


def run_migrations_postgres(database_url: str) -> None:
    """
    Run migrations for Postgres (PROD).
    """
    try:
        import psycopg2
    except ImportError:
        logger.error("migrations_error", message="psycopg2 not installed")
        return
    
    conn = psycopg2.connect(database_url)
    conn.autocommit = True
    cur = conn.cursor()
    
    # Get applied migrations
    try:
        cur.execute("SELECT version FROM schema_migrations")
        applied = {row[0] for row in cur.fetchall()}
    except:
        applied = set()
    
    # Run pending migrations
    migration_files = get_migration_files()
    
    for migration_file in migration_files:
        version = migration_file.stem  # e.g., "001_init"
        
        if version in applied:
            logger.info("migration_skipped", version=version, reason="already applied")
            continue
        
        logger.info("migration_running", version=version)
        
        try:
            sql = migration_file.read_text(encoding="utf-8")
            cur.execute(sql)
            logger.info("migration_applied", version=version)
        except Exception as e:
            logger.error("migration_failed", version=version, error=str(e))
            raise
    
    cur.close()
    conn.close()
    
    logger.info("migrations_postgres_complete")


def run_migrations() -> None:
    """
    Run database migrations based on environment.
    """
    config = get_config()
    
    if config.is_prod and config.database_url:
        logger.info("migrations_starting", env="PROD", db_type="postgres")
        run_migrations_postgres(config.database_url)
    else:
        logger.info("migrations_starting", env="STAGING", db_type="sqlite")
        run_migrations_sqlite()


if __name__ == "__main__":
    run_migrations()

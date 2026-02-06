import os
import sqlite3
import time

# Default path, can be overridden by AVA_DB_PATH env var for testing
DEFAULT_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ava_production.db")

class Database:
    def __init__(self):
        # Allow runtime override for QA isolation
        self._path = os.getenv("AVA_DB_PATH", DEFAULT_DB_PATH)

    def get_connection(self):
        conn = sqlite3.connect(self._path, timeout=10)
        conn.row_factory = sqlite3.Row
        return conn

    def init_schema(self):
        """
        Standard Schema (SSOT Compliant).
        """
        with self.get_connection() as conn:
            conn.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                job_id TEXT PRIMARY KEY, 
                user_id TEXT, 
                job_type TEXT NOT NULL, 
                state TEXT NOT NULL,
                ssot_version TEXT DEFAULT '1.1', 
                correlation_id TEXT, 
                idempotency_key TEXT,
                payload_json TEXT NOT NULL, 
                result_json TEXT, 
                retry_count INTEGER DEFAULT 0,
                updated_at REAL, 
                created_at REAL NOT NULL, 
                started_at REAL, 
                finished_at REAL,
                claimed_by TEXT
            );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_jobs_state ON jobs(state);")
            conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_idempotency ON jobs(idempotency_key) WHERE idempotency_key IS NOT NULL;")
            conn.commit()

_db = None
def get_db():
    global _db
    if _db is None: _db = Database()
    return _db

import sqlite3
import os
import time
import statistics

DB_PATH = os.getenv(
    "AVA_QUEUE_DB",
    os.path.join(os.getenv("AVA_STORAGE_ROOT", "/tmp/ava_storage"), "queue.db")
)

def _conn():
    return sqlite3.connect(DB_PATH)

def collect_metrics():
    con = _conn()

    # counts by state
    cur = con.execute("SELECT state, COUNT(*) FROM jobs GROUP BY state")
    counts = {row[0]: row[1] for row in cur.fetchall()}

    # completed runtimes
    cur = con.execute(
        "SELECT finished_at - started_at "
        "FROM jobs WHERE state='COMPLETED' "
        "AND started_at IS NOT NULL AND finished_at IS NOT NULL"
    )
    runtimes = [row[0] for row in cur.fetchall() if row[0] is not None]

    con.close()

    result = {
        "counts": counts,
        "completed": {
            "samples": len(runtimes)
        }
    }

    if runtimes:
        result["completed"]["avg"] = round(sum(runtimes) / len(runtimes), 4)
        if len(runtimes) >= 2:
            result["completed"]["p95"] = round(statistics.quantiles(runtimes, n=20)[-1], 4)
        else:
            result["completed"]["p95"] = result["completed"]["avg"]

    return result

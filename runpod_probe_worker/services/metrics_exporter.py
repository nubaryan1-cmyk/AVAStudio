"""
AVA METRICS EXPORTER
Dumps critical stats: Queue Depth, Error Rate, Est. Cost.
"""
import time
import json
from services.db import get_db

def get_snapshot():
    db = get_db()
    stats = {
        "ts": time.time(),
        "queue_depth": 0,
        "running": 0,
        "failed_24h": 0,
        "completed_24h": 0,
        "est_cost_24h": 0.0
    }
    
    try:
        with db.get_connection() as conn:
            # 1. Real-time states
            rows = conn.execute("SELECT state, COUNT(*) as cnt FROM jobs GROUP BY state").fetchall()
            for r in rows:
                if r["state"] in ["IN_QUEUE", "SCHEDULED"]: stats["queue_depth"] += r["cnt"]
                if r["state"] == "RUNNING": stats["running"] += r["cnt"]
            
            # 2. History (24h)
            since = time.time() - 86400
            rows = conn.execute("SELECT state, COUNT(*) as cnt FROM jobs WHERE created_at > ? GROUP BY state", (since,)).fetchall()
            for r in rows:
                if r["state"] == "FAILED": stats["failed_24h"] += r["cnt"]
                if r["state"] == "COMPLETED": stats["completed_24h"] += r["cnt"]
                
            # 3. Cost Est (Avg $0.02 per job)
            stats["est_cost_24h"] = (stats["completed_24h"] + stats["failed_24h"]) * 0.02
            
    except Exception as e:
        print(f"[METRICS] Error collection: {e}")
        
    return stats

def print_health_report():
    s = get_snapshot()
    status = "HEALTHY"
    if s["failed_24h"] > 10 and (s["failed_24h"] / (s["completed_24h"]+1) > 0.1):
        status = "DEGRADED (High Error Rate)"
    if s["queue_depth"] > 100:
        status = "OVERLOADED"
        
    print(f"\n=== SYSTEM HEALTH: {status} ===")
    print(f"Queue: {s['queue_depth']} | Running: {s['running']}")
    print(f"24h: {s['completed_24h']} OK | {s['failed_24h']} ERR")
    print(f"Est. Cost: ${s['est_cost_24h']:.2f}")
    print("==============================\n")

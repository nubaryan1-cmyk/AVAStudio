import asyncio
from services.ws_manager import ws_manager

def set_progress(job_id: str, percent: int, stage: str):
    payload = {
        "job_id": job_id,
        "progress": percent,
        "stage": stage
    }
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(ws_manager.broadcast(payload))
    except:
        pass

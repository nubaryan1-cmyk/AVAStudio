"""
AVA VIDEO EXECUTOR (REAL MUSCLE)
"""
import os
from .base_executor import BaseExecutor
from services.providers import get_provider_for_task
from services.job_core import get_job_core

class GenerateVideoExecutor(BaseExecutor):
    def run(self) -> dict:
        job_core = get_job_core()
        job_id = self.payload.get("job_id")
        
        provider = get_provider_for_task("video")
        job_core.update_progress(job_id, 15, f"Uploading request to {provider.name}...")
        
        result = provider.execute("generate_video", self.payload)
        
        if result["success"]:
            job_core.update_progress(job_id, 100, "Video is ready")
            return {
                "artifacts": result["data"].get("output", []),
                "metrics": {"provider": provider.name}
            }
        else:
            return {
                "error": {"class": "infra", "code": "INFRA_GPU_TIMEOUT", "message": result["error"]},
                "artifacts": []
            }
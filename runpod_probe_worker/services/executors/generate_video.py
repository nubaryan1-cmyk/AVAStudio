"""
AVA VIDEO EXECUTOR (REAL MUSCLE)
"""
from .base_executor import BaseExecutor
from services.job_core import get_job_core
from services.router_policy import execute_with_fallback

class GenerateVideoExecutor(BaseExecutor):
    def run(self) -> dict:
        job_core = get_job_core()
        job_id = self.payload.get("job_id")

        result = execute_with_fallback("video", "generate_video", self.payload)
        job_core.update_progress(
            job_id,
            15,
            f"Uploading request to {result.get('provider', 'provider')}...",
        )

        if result.get("success"):
            job_core.update_progress(job_id, 100, "Video is ready")
            return {
                "artifacts": result.get("data", {}).get("output", []),
                "metrics": {
                    "provider": result.get("provider"),
                    "status": result.get("status", "completed"),
                    "fallback_used": result.get("fallback_used", False),
                },
            }
        return {
            "error": {
                "class": "infra",
                "code": "INFRA_GPU_FALLBACK_FAILED",
                "message": result.get("error", "GPU execution failed"),
            },
            "artifacts": [],
            "metrics": {
                "provider": result.get("provider"),
                "status": result.get("status", "failed"),
                "fallback_used": result.get("fallback_used", False),
            },
        }

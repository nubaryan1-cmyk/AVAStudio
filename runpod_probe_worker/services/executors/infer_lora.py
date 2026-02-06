"""
AVA LORA INFERENCE EXECUTOR (REAL MUSCLE)
"""
from .base_executor import BaseExecutor
from services.providers import get_provider_for_task
from services.job_core import get_job_core

class InferLoraExecutor(BaseExecutor):
    def run(self) -> dict:
        job_core = get_job_core()
        job_id = self.payload.get("job_id")
        
        provider = get_provider_for_task("lora_infer")
        job_core.update_progress(job_id, 15, "Applying LoRA weights and generating...")
        
        result = provider.execute("infer", self.payload)
        
        if result["success"]:
            job_core.update_progress(job_id, 100, "LoRA generation complete")
            return {
                "artifacts": result["data"].get("output", []),
                "metrics": {"provider": provider.name}
            }
        else:
            return {
                "error": {"class": "infra", "code": "LORA_INFER_ERROR", "message": result["error"]},
                "artifacts": []
            }
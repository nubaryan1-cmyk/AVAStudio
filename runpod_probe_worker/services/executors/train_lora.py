"""
AVA LORA TRAINING EXECUTOR (REAL MUSCLE)
"""
from .base_executor import BaseExecutor
from services.providers import get_provider_for_task
from services.job_core import get_job_core

class TrainLoraExecutor(BaseExecutor):
    def run(self) -> dict:
        job_core = get_job_core()
        job_id = self.payload.get("job_id")
        
        provider = get_provider_for_task("lora_train")
        job_core.update_progress(job_id, 5, "Starting LoRA training on GPU...")
        
        result = provider.execute("train", self.payload)
        
        if result["success"]:
            job_core.update_progress(job_id, 100, "LoRA training complete")
            return {
                "artifacts": result["data"].get("output", []),
                "metrics": {"provider": provider.name, "type": "training"}
            }
        else:
            return {
                "error": {"class": "model", "code": "TRAINING_FAILED", "message": result["error"]},
                "artifacts": []
            }
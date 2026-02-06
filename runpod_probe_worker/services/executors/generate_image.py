from .base_executor import BaseExecutor
from services.router_policy import execute_with_fallback

class GenerateImageExecutor(BaseExecutor):
    def run(self):
        result = execute_with_fallback("photo", "gen", self.payload)
        if result.get("success"):
            return {
                "artifacts": result.get("data", {}).get("output", []),
                "status": result.get("status", "completed"),
                "fallback_used": result.get("fallback_used", False),
                "metrics": {"provider": result.get("provider")},
            }
        return {
            "artifacts": [],
            "status": "failed",
            "fallback_used": result.get("fallback_used", False),
            "error": {
                "class": "infra",
                "code": "INFRA_GPU_FALLBACK_FAILED",
                "message": result.get("error", "GPU execution failed"),
            },
        }

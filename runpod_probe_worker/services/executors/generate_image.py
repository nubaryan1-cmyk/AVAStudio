from .base_executor import BaseExecutor
from services.providers import get_provider_for_task

class GenerateImageExecutor(BaseExecutor):
    def run(self):
        provider = get_provider_for_task("photo")
        result = provider.execute("gen", self.payload)
        return {
            "artifacts": result.get("data", {}).get("output", []),
            "is_fallback": result.get("is_fallback", False) # КРИТИЧЕСКАЯ МЕТКА ДЛЯ ПРУФА
        }
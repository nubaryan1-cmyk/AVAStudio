"""
AVA PROVIDERS LAYER
Adapters for External AI Services (GPU & SaaS).
"""
import os
import time
import requests
import json
from abc import ABC, abstractmethod
from typing import Dict, Any

class AIProvider(ABC):
    def __init__(self, name: str, base_url: str, api_key: str):
        self.name = name
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.is_mock = os.getenv("AVA_MOCK_MODE") == "1"

    @abstractmethod
    def execute(self, action: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        pass

class RunPodProvider(AIProvider):
    def execute(self, action: str, payload: dict) -> dict:
        url = f"{self.base_url}/runsync"
        headers = {"Authorization": f"Bearer {self.api_key}"}
        
        if self.is_mock:
            return {"success": True, "data": {"output": ["s3://mock-gpu-output.png"]}}

        try:
            response = requests.post(url, json={"input": payload}, headers=headers, timeout=120)
            response.raise_for_status()
            return {"success": True, "data": response.json()}
        except Exception as e:
            return {"success": False, "error": str(e), "class": "infra"}

class FluxSaaSProvider(AIProvider):
    def execute(self, action: str, payload: dict) -> dict:
        if self.is_mock:
            return {"success": True, "data": {"output": ["s3://mock-flux-saas.png"]}}
        
        flux_payload = {
            "prompt": payload.get("prompt"),
            "width": payload.get("width", 1024),
            "height": payload.get("height", 1024)
        }
        try:
            resp = requests.post(self.base_url, json=flux_payload, headers={"X-Key": self.api_key}, timeout=60)
            resp.raise_for_status()
            return {"success": True, "data": resp.json()}
        except Exception as e:
            return {"success": False, "error": str(e), "class": "infra"}

class ReplicateProvider(AIProvider):
    def execute(self, action: str, payload: dict) -> dict:
        if self.is_mock:
            return {"success": True, "data": {"output": ["s3://mock-replicate-video.mp4"]}}
        return {"success": False, "error": "Async polling not implemented in sync adapter"}

# Factory
def get_provider_instance(name: str, url: str, key: str) -> AIProvider:
    if "runpod" in name.lower():
        return RunPodProvider(name, url, key)
    elif "flux" in name.lower():
        return FluxSaaSProvider(name, url, key)
    elif "replicate" in name.lower() or "kling" in name.lower():
        return ReplicateProvider(name, url, key)
    else:
        return RunPodProvider(name, url, key)

# FIX: Restore Compatibility for Executors
def get_provider_for_task(task_name: str) -> AIProvider:
    """
    Legacy wrapper: resolves provider via Router Policy.
    Uses runtime import to avoid circular dependency.
    """
    from services.router_policy import route_job
    route_result = route_job(task_name)
    return route_result.provider_instance

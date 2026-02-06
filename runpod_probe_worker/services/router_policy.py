"""
AVA ROUTER POLICY (CIRCUIT BREAKER + FALLBACK)
"""
import os
import time
from dataclasses import dataclass
from services.providers import get_provider_instance, AIProvider

class EndpointType:
    PHOTO_GPU = "PHOTO-GPU"
    VIDEO_GPU = "VIDEO-GPU"
    LORA_TRAIN = "LORA-TRAIN"

@dataclass
class RouteResult:
    provider_instance: AIProvider
    is_fallback: bool
    endpoint_type: str

class CircuitBreaker:
    """
    Monitors failures. 
    If > FAILURE_THRESHOLD errors occur within WINDOW, opens circuit for TIMEOUT seconds.
    """
    def __init__(self, threshold=3, timeout=60):
        self.threshold = threshold
        self.timeout = timeout
        self._failures = {} # {url: count}
        self._open_until = {} # {url: timestamp}

    def record_failure(self, url: str):
        self._failures[url] = self._failures.get(url, 0) + 1
        if self._failures[url] >= self.threshold:
            self._open_until[url] = time.time() + self.timeout
            print(f"[CIRCUIT] OPENED for {url}. Switching to fallback.")

    def record_success(self, url: str):
        self._failures[url] = 0
        self._open_until.pop(url, None)

    def is_healthy(self, url: str) -> bool:
        if not url: return False
        if time.time() < self._open_until.get(url, 0):
            return False # Circuit Open
        return True

class Router:
    def __init__(self):
        self.cb = CircuitBreaker()

    def _get_primary_url(self, family: str) -> str:
        version = os.getenv(f"AVA_VERSION_{family}", "v1")
        return os.getenv(f"GPU_{family}_URL_{version.upper()}") or ""

    def _get_fallback_provider(self, family: str) -> AIProvider:
        """Configures SaaS provider based on family."""
        if family == "PHOTO":
            return get_provider_instance("Flux-SaaS", "https://api.bfl.ml", "saas-key")
        elif family == "VIDEO":
            return get_provider_instance("Replicate-Kling", "https://api.replicate.com", "saas-key")
        else:
            # No fallback for LoRA training (requires specific GPU)
            return None

    def route_job(self, job_type: str) -> RouteResult:
        if "video" in job_type: family = "VIDEO"; ep = EndpointType.VIDEO_GPU
        elif "train" in job_type: family = "LORA"; ep = EndpointType.LORA_TRAIN
        else: family = "PHOTO"; ep = EndpointType.PHOTO_GPU

        primary_url = self._get_primary_url(family)
        
        # 1. Check Circuit Breaker & Existence
        if primary_url and self.cb.is_healthy(primary_url):
            # Healthy Primary
            provider = get_provider_instance(f"RunPod-{family}", primary_url, "gpu-key")
            return RouteResult(provider, False, ep)
        
        # 2. Fallback Logic
        fallback = self._get_fallback_provider(family)
        if fallback:
            print(f"[ROUTER] Using Fallback: {fallback.name}")
            return RouteResult(fallback, True, ep)
            
        # 3. No Fallback Available (Fail)
        raise RuntimeError(f"No healthy endpoints for {job_type}. Primary down, no fallback.")

    def report_result(self, url: str, success: bool):
        """Feedback loop for Circuit Breaker."""
        if success: self.cb.record_success(url)
        else: self.cb.record_failure(url)

_router = Router()
def route_job(t): return _router.route_job(t)
def get_router(): return _router

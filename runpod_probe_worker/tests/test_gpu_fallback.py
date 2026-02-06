import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import router_policy


class _StubProvider:
    def __init__(self, name, success, payload=None):
        self.name = name
        self._success = success
        self._payload = payload or {"output": ["s3://fallback-result.png"]}

    def execute(self, action, payload):
        if self._success:
            return {"success": True, "data": self._payload}
        return {"success": False, "error": "primary failed", "class": "infra"}


def test_execute_with_fallback_uses_saas_on_failure(monkeypatch):
    router = router_policy.Router()

    monkeypatch.setattr(router, "_get_primary_url", lambda family: "https://gpu.local")
    monkeypatch.setattr(router, "cb", router_policy.CircuitBreaker())
    monkeypatch.setattr(router, "_get_fallback_provider", lambda family: _StubProvider("SaaS", True))
    monkeypatch.setattr(
        router_policy,
        "get_provider_instance",
        lambda name, url, key: _StubProvider("Primary", False),
    )

    result = router.execute_with_fallback("photo.generate", "gen", {"prompt": "test"})

    assert result["success"] is True
    assert result["fallback_used"] is True
    assert result["status"] == "fallback_used"

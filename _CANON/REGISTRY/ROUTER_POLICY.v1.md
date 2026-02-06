# AVA — ROUTER POLICY (CANON)

**Version:** 1.0  
**Status:** CANON (OWNER APPROVED)  
**Authority:** _CANON/REGISTRY/ROUTER_POLICY.v1.md  
**Scope:** ENDPOINT ROUTING & FALLBACK RULES

---

## 1. ENDPOINT TYPES (CANONICAL)

```
PHOTO-GPU   — Photo/image generation (GPU required)
VIDEO-GPU   — Video generation (GPU required)
LORA-TRAIN  — LoRA model training (GPU required, long-running)
```

---

## 2. ROUTING PRIORITY

### Primary: Self-Hosted GPU Endpoints

| Endpoint Type | Primary Target | Health Check |
|--------------|----------------|---------------|
| PHOTO-GPU | `{GPU_PHOTO_URL}/generate` | `/health` |
| VIDEO-GPU | `{GPU_VIDEO_URL}/generate` | `/health` |
| LORA-TRAIN | `{GPU_LORA_URL}/train` | `/health` |

### Fallback: SaaS API Providers

| Endpoint Type | Fallback Provider | Condition |
|--------------|-------------------|------------|
| PHOTO-GPU | Flux API / Z-Image | GPU unavailable OR >30s timeout |
| VIDEO-GPU | Kling API / Veo | GPU unavailable OR >60s timeout |
| LORA-TRAIN | NO FALLBACK | Must wait for GPU |

---

## 3. ENDPOINT VERSIONING

### Version Format

```
{endpoint-type}-v{MAJOR}

Examples:
- photo-gpu-v1
- lora-train-v2
```

### Version Switching Rules

1. **R-001:** New version endpoints deployed alongside old
2. **R-002:** Router can switch versions via feature flag
3. **R-003:** Old versions remain available for 30 days
4. **R-004:** No client-side changes required during switch

---

## 4. FALLBACK DECISION TREE

```
1. Check GPU endpoint health
   |-- HEALTHY → Route to GPU
   |-- UNHEALTHY or TIMEOUT:
       |-- Check fallback_enabled flag
           |-- DISABLED → Return INFRA_GPU_UNAVAILABLE error
           |-- ENABLED → Check SaaS provider availability
               |-- AVAILABLE → Route to SaaS
               |-- UNAVAILABLE → Return INFRA_UPSTREAM_UNAVAILABLE error
```

---

## 5. CIRCUIT BREAKER

| Parameter | Value | Description |
|-----------|-------|-------------|
| failure_threshold | 5 | Consecutive failures before open |
| success_threshold | 3 | Successes to close circuit |
| timeout_seconds | 30 | Time in open state before half-open |

---

## 6. ENVIRONMENT-BASED CONFIG

### PROD Environment

- Primary: Self-hosted GPU cluster
- Fallback: Production SaaS APIs
- Circuit breaker: ENABLED

### STAGING Environment

- Primary: Mock GPU endpoint
- Fallback: Mock SaaS endpoint
- Circuit breaker: DISABLED (for testing)

---

## 7. API VERSIONING ALIGNMENT

| API Version | Endpoint Version | Router Policy |
|-------------|-----------------|---------------|
| /api/v1/* | *-v1 | Current stable |
| /api/v2/* | *-v2 | Future (when ready) |

---

**END OF ROUTER POLICY CANON**

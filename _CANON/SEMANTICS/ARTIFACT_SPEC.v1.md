# AVA — ARTIFACT SPEC (CANON)

**Version:** 1.0  
**Status:** CANON (OWNER APPROVED)  
**Authority:** _CANON/SEMANTICS/ARTIFACT_SPEC.v1.md  
**Scope:** ARTIFACT STRUCTURE & STORAGE

---

## 1. ARTIFACT OBJECT STRUCTURE

```json
{
  "type": "image | video | lora | checkpoint | log",
  "uri": "s3://bucket/path/to/artifact.ext",
  "size": 12345678,
  "sha256": "abc123...",
  "meta": {
    "format": "png | mp4 | safetensors | json",
    "width": 1024,
    "height": 1024,
    "duration_seconds": 5.0
  }
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| type | string | Artifact type (enum) |
| uri | string | Final storage URI (S3/MinIO) |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| size | integer | File size in bytes |
| sha256 | string | SHA-256 hash for integrity |
| meta | object | Type-specific metadata |

---

## 2. ARTIFACT TYPES

| Type | Description | Formats |
|------|-------------|----------|
| image | Generated image | png, jpg, webp |
| video | Generated video | mp4, webm |
| lora | Trained LoRA weights | safetensors |
| checkpoint | Training checkpoint | safetensors |
| log | Training/generation log | json, txt |

---

## 3. S3 KEY SCHEME (CANONICAL)

```
s3://{bucket}/{env}/{user_id}/{job_type}/{job_id}/{artifact_type}/{filename}

Examples:
- s3://ava-artifacts/prod/user123/photo.generate/job456/image/output_001.png
- s3://ava-artifacts/prod/user123/lora.train/job789/lora/model.safetensors
- s3://ava-artifacts/staging/user123/video.generate/job012/video/output.mp4
```

### Path Components

| Component | Description |
|-----------|-------------|
| bucket | S3 bucket name (ava-artifacts) |
| env | Environment: prod, staging |
| user_id | Owner user identifier |
| job_type | Job type (photo.generate, etc.) |
| job_id | Unique job identifier |
| artifact_type | Type: image, video, lora, etc. |
| filename | Original or generated filename |

---

## 4. TEMP GPU VOLUME

### GPU Worker Flow

1. GPU writes to Network Volume: `/workspace/outputs/{job_id}/`
2. After completion: Upload to S3
3. Update job record with canonical artifact URIs
4. Cleanup temp files after successful upload

### Network Volume Paths

```
/workspace/
├── inputs/        # Downloaded input files
│   └── {job_id}/
├── outputs/       # Generated artifacts
│   └── {job_id}/
└── checkpoints/   # Training checkpoints
    └── {job_id}/
```

---

## 5. UPLOAD POLICY

| Condition | Action |
|-----------|--------|
| Job COMPLETED | Upload all artifacts to S3 |
| Job FAILED | Upload logs only (if available) |
| Job CANCELLED | No upload (cleanup temp) |
| Job TIMEOUT | Upload partial artifacts + logs |

---

## 6. ARTIFACT VALIDATION

### Required Checks

1. File exists at temp location
2. File size > 0
3. Format matches expected type
4. SHA-256 computed and stored

### On Validation Failure

```json
{
  "error": {
    "class": "infra",
    "code": "INFRA_STORAGE_FULL",
    "message": "Artifact validation failed: {reason}"
  }
}
```

---

**END OF ARTIFACT SPEC CANON**

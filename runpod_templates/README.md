# AVA Studio - RunPod GPU Endpoint Templates

This directory contains configuration templates for setting up RunPod Serverless GPU endpoints.

## Endpoints

| Endpoint | File | GPU | VRAM | Use Case |
|----------|------|-----|------|----------|
| Photo Generation | `endpoint_photo.json` | A5000/A6000 | 24GB+ | SDXL/Flux image generation |
| Video Generation | `endpoint_video.json` | A6000/A100 | 48GB+ | WAN/Kling/SVD video generation |
| LoRA Training | `endpoint_lora_train.json` | A6000/A100 | 48GB+ | Custom model fine-tuning |
| LoRA Inference | `endpoint_lora_infer.json` | A5000/A6000 | 24GB+ | Generation with custom LoRAs |

## Quick Start

### 1. Create RunPod Account
- Go to https://www.runpod.io
- Add billing information
- Get API key from Settings

### 2. Create Serverless Endpoint

```bash
# In RunPod Console:
1. Go to Serverless → New Endpoint
2. Select GPU type (refer to template requirements)
3. Configure container image
4. Set environment variables (from template)
5. Configure scaling (staging vs production)
6. Deploy
```

### 3. Configure Backend

Add endpoint URLs to your `.env` file:

```bash
# .env.staging or .env.prod
GPU_PHOTO_URL=https://api.runpod.ai/v2/YOUR_PHOTO_ENDPOINT_ID/runsync
GPU_VIDEO_URL=https://api.runpod.ai/v2/YOUR_VIDEO_ENDPOINT_ID/runsync
GPU_LORA_URL=https://api.runpod.ai/v2/YOUR_LORA_ENDPOINT_ID/runsync
GPU_API_KEY=YOUR_RUNPOD_API_KEY
```

## Environment Variables

### Required for ALL Endpoints (set in RunPod Dashboard)

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `HF_TOKEN` | HuggingFace token | https://huggingface.co/settings/tokens |
| `AWS_ACCESS_KEY_ID` | S3 credentials | AWS IAM Console |
| `AWS_SECRET_ACCESS_KEY` | S3 credentials | AWS IAM Console |
| `AWS_S3_BUCKET` | Artifact bucket | Your AWS S3 bucket name |
| `AWS_REGION` | AWS region | e.g., `us-east-1` |

### Endpoint-Specific Variables

**Photo Endpoint:**
- `MODEL_NAME`: `flux-dev` or `sdxl-base-1.0`
- `CIVITAI_TOKEN`: (optional) For CivitAI models

**Video Endpoint:**
- `VIDEO_MODEL`: `wan-2.1`, `kling`, or `svd-xt`
- `MAX_DURATION_SECONDS`: Default 10

**LoRA Training:**
- `DEFAULT_BASE_MODEL`: `flux-dev` or `sdxl-base-1.0`
- `MAX_EPOCHS`: Maximum training epochs

## Scaling Guidelines

### Staging
```json
{
  "minWorkers": 0,
  "maxWorkers": 2,
  "idleTimeout": 300
}
```

### Production
```json
{
  "minWorkers": 1,
  "maxWorkers": 10,
  "idleTimeout": 600
}
```

## SaaS Fallback

When GPU endpoints fail or timeout, the backend automatically falls back to SaaS providers:

| Operation | Primary | Fallback |
|-----------|---------|----------|
| Photo | RunPod GPU | Flux API (bfl.ml) |
| Video | RunPod GPU | Replicate |
| LoRA Training | RunPod GPU | No fallback |
| LoRA Inference | RunPod GPU | Replicate |

Configure fallback credentials in backend `.env`:

```bash
FLUX_API_URL=https://api.bfl.ml/v1/flux-pro-1.1
FLUX_API_KEY=your-flux-key

REPLICATE_API_URL=https://api.replicate.com/v1/predictions
REPLICATE_API_KEY=your-replicate-key
```

## Testing Endpoints

### Health Check
```bash
curl https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/health \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Run Job
```bash
curl -X POST https://api.runpod.ai/v2/YOUR_ENDPOINT_ID/runsync \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "prompt": "A beautiful sunset",
      "width": 1024,
      "height": 1024
    }
  }'
```

## Security Notes

⚠️ **NEVER commit API keys to these template files or git!**

- All secrets must be set via RunPod Dashboard or backend ENV
- Templates contain only structure and defaults
- Rotate API keys periodically
- Use separate credentials for staging/production

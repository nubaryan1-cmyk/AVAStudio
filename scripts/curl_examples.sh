#!/bin/bash
# =============================================================================
# AVA STUDIO - SMOKE TEST CURL EXAMPLES
# =============================================================================
# Usage: ./scripts/curl_examples.sh [base_url]
# Default: http://localhost:8000
# =============================================================================

set -e

BASE_URL="${1:-http://localhost:8000}"
TOKEN="dev_token"

echo "============================================="
echo "AVA STUDIO - SMOKE TESTS"
echo "Base URL: $BASE_URL"
echo "============================================="

# Health check
echo ""
echo "[1] Health Check"
curl -s "$BASE_URL/health" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Status: {d.get(\"status\")} Version: {d.get(\"version\")}')"

# Get version
echo ""
echo "[2] API Version"
curl -s "$BASE_URL/api/v1/version" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin), indent=2))"

# Auth check
echo ""
echo "[3] Auth Check (dev token)"
curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/v1/auth/me" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'User: {d.get(\"user_id\")} Plan: {d.get(\"plan\")}')"

# Create photo job
echo ""
echo "[4] Create Photo Job"
PHOTO_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/photo/generate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "a beautiful sunset over mountains"}')
PHOTO_JOB_ID=$(echo "$PHOTO_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('job_id', 'ERROR'))")
echo "Photo Job ID: $PHOTO_JOB_ID"

# Get photo job status
echo ""
echo "[5] Get Photo Job Status"
curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/v1/photo/jobs/$PHOTO_JOB_ID" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'State: {d.get(\"state\")} Progress: {d.get(\"progress\", {}).get(\"percent\", 0)}%')"

# Create LoRA train job (requires PRO - may fail for FREE users)
echo ""
echo "[6] Create LoRA Train Job"
LORA_TRAIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/lora/train" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "dataset": {"num_images": 20},
    "training": {"epochs": 10, "base_model": "flux-dev"},
    "output": {"lora_name": "smoke-test-lora"}
  }')
LORA_TRAIN_JOB_ID=$(echo "$LORA_TRAIN_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('job_id', d.get('detail', {}).get('code', 'ERROR')))")
echo "LoRA Train Job ID/Status: $LORA_TRAIN_JOB_ID"

# Create LoRA infer job
echo ""
echo "[7] Create LoRA Infer Job"
LORA_INFER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/lora/infer" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "a photo in the style of TOK",
    "lora_id": "test-lora-123",
    "width": 1024,
    "height": 1024
  }')
LORA_INFER_JOB_ID=$(echo "$LORA_INFER_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('job_id', 'ERROR'))")
echo "LoRA Infer Job ID: $LORA_INFER_JOB_ID"

# Get LoRA job status
echo ""
echo "[8] Get LoRA Job Status"
curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/v1/lora/jobs/$LORA_INFER_JOB_ID" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Type: {d.get(\"job_type\")} State: {d.get(\"state\")}')"

# Feature flags
echo ""
echo "[9] Feature Flags"
curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/api/v1/flags" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Flags count: {len(d)}')"

# Metrics endpoint
echo ""
echo "[10] Metrics"
METRICS_COUNT=$(curl -s "$BASE_URL/metrics" | wc -l)
echo "Metrics lines: $METRICS_COUNT"

# Test idempotency
echo ""
echo "[11] Idempotency Test"
IDEM_KEY="smoke-test-$(date +%s)"
R1=$(curl -s -X POST "$BASE_URL/api/v1/photo/generate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEM_KEY" \
  -d '{"prompt": "idempotency test"}')
JOB1=$(echo "$R1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('job_id'))")

R2=$(curl -s -X POST "$BASE_URL/api/v1/photo/generate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEM_KEY" \
  -d '{"prompt": "idempotency test"}')
JOB2=$(echo "$R2" | python3 -c "import sys,json; print(json.load(sys.stdin).get('job_id'))")
IS_NEW=$(echo "$R2" | python3 -c "import sys,json; print(json.load(sys.stdin).get('is_new'))")

if [ "$JOB1" = "$JOB2" ] && [ "$IS_NEW" = "False" ]; then
  echo "Idempotency: PASS (same job_id returned)"
else
  echo "Idempotency: FAIL (job1=$JOB1 job2=$JOB2 is_new=$IS_NEW)"
fi

echo ""
echo "============================================="
echo "SMOKE TESTS COMPLETE"
echo "============================================="

#!/bin/bash
# =============================================================================
# AVA STUDIO - HEALTH CHECK SCRIPT
# =============================================================================
# Usage: ./scripts/health_check.sh [url] [--full]
# =============================================================================

BASE_URL="${1:-http://localhost:8000}"
FULL_CHECK="${2:-}"

echo "============================================="
echo "AVA STUDIO - HEALTH CHECK"
echo "URL: $BASE_URL"
echo "============================================="

ERRORS=0

# -----------------------------------------------------------------------------
# [1] Basic Health
# -----------------------------------------------------------------------------
echo ""
echo "[1/4] Basic Health Check..."
HEALTH=$(curl -sf -w "%{http_code}" -o /tmp/health_response.json "$BASE_URL/health" 2>/dev/null)
if [ "$HEALTH" = "200" ]; then
    STATUS=$(cat /tmp/health_response.json | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    VERSION=$(cat /tmp/health_response.json | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
    echo "  ✓ Health: $STATUS (version: $VERSION)"
else
    echo "  ✗ Health check failed (HTTP $HEALTH)"
    ((ERRORS++))
fi

# -----------------------------------------------------------------------------
# [2] API Version
# -----------------------------------------------------------------------------
echo ""
echo "[2/4] API Version Check..."
VERSION_RESP=$(curl -sf "$BASE_URL/api/v1/version" 2>/dev/null)
if [ -n "$VERSION_RESP" ]; then
    echo "  ✓ Version endpoint responding"
    echo "    $VERSION_RESP" | head -c 100
    echo ""
else
    echo "  ✗ Version endpoint not responding"
    ((ERRORS++))
fi

# -----------------------------------------------------------------------------
# [3] Photo Endpoint
# -----------------------------------------------------------------------------
echo ""
echo "[3/4] Photo Endpoint Check..."
PHOTO_RESP=$(curl -sf -X POST "$BASE_URL/api/v1/photo/generate" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer health_check_token" \
    -H "Idempotency-Key: health-check-$(date +%s)" \
    -d '{"prompt": "health check test"}' 2>/dev/null)

if echo "$PHOTO_RESP" | grep -q "job_id"; then
    JOB_ID=$(echo "$PHOTO_RESP" | grep -o '"job_id":"[^"]*"' | cut -d'"' -f4)
    echo "  ✓ Photo endpoint working (job_id: $JOB_ID)"
elif echo "$PHOTO_RESP" | grep -qi "unauthorized\|auth"; then
    echo "  ✓ Photo endpoint responding (auth required - expected)"
else
    echo "  ? Photo endpoint response: $(echo "$PHOTO_RESP" | head -c 100)"
fi

# -----------------------------------------------------------------------------
# [4] Metrics Endpoint
# -----------------------------------------------------------------------------
echo ""
echo "[4/4] Metrics Endpoint Check..."
METRICS=$(curl -sf "$BASE_URL/metrics" 2>/dev/null | head -5)
if [ -n "$METRICS" ]; then
    echo "  ✓ Metrics endpoint responding"
    if [ "$FULL_CHECK" = "--full" ]; then
        echo "    Sample:"
        curl -sf "$BASE_URL/metrics" 2>/dev/null | head -10 | sed 's/^/    /'
    fi
else
    echo "  ✗ Metrics endpoint not responding"
    ((ERRORS++))
fi

# -----------------------------------------------------------------------------
# Full Check (optional)
# -----------------------------------------------------------------------------
if [ "$FULL_CHECK" = "--full" ]; then
    echo ""
    echo "============================================="
    echo "FULL CHECK - Additional Endpoints"
    echo "============================================="
    
    # Feature Flags
    echo ""
    echo "[5] Feature Flags..."
    FLAGS=$(curl -sf "$BASE_URL/api/v1/flags" -H "Authorization: Bearer test" 2>/dev/null)
    if [ -n "$FLAGS" ]; then
        echo "  ✓ Feature flags endpoint responding"
    else
        echo "  ? Feature flags endpoint: no response or auth required"
    fi
    
    # OpenAPI Docs
    echo ""
    echo "[6] OpenAPI Docs..."
    DOCS=$(curl -sf -w "%{http_code}" -o /dev/null "$BASE_URL/docs" 2>/dev/null)
    if [ "$DOCS" = "200" ]; then
        echo "  ✓ OpenAPI docs available at $BASE_URL/docs"
    else
        echo "  ? OpenAPI docs: HTTP $DOCS"
    fi
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo ""
echo "============================================="
if [ $ERRORS -eq 0 ]; then
    echo "HEALTH CHECK PASSED"
else
    echo "HEALTH CHECK FAILED ($ERRORS errors)"
fi
echo "============================================="

exit $ERRORS

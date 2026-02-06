#!/bin/bash
# =============================================================================
# AVA STUDIO - ENVIRONMENT VALIDATION
# =============================================================================
# CANON: Only STAGING and PROD. Same contour for both.
# Usage: ./scripts/check_env.sh [staging|prod] [--strict]
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

ENV_TYPE="${1:-staging}"
STRICT_MODE="${2:-}"

echo "============================================="
echo "AVA STUDIO - ENV VALIDATION: $ENV_TYPE"
echo "============================================="

case $ENV_TYPE in
    staging)
        ENV_FILE="$PROJECT_ROOT/.env.staging"
        [ ! -f "$ENV_FILE" ] && ENV_FILE="$PROJECT_ROOT/.env.local"
        EXPECTED_AVA_ENV="STAGING"
        ;;
    prod)
        ENV_FILE="$PROJECT_ROOT/.env.prod"
        EXPECTED_AVA_ENV="PROD"
        ;;
    *)
        echo "ERROR: Only 'staging' or 'prod' allowed."
        exit 1
        ;;
esac

[ ! -f "$ENV_FILE" ] && echo "ERROR: $ENV_FILE not found!" && exit 1

ERRORS=0
WARNINGS=0

get_val() {
    grep -E "^${1}=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" || echo ""
}

is_placeholder() {
    local val="$1"
    [ -z "$val" ] || [ "$val" = "xxx" ] || [[ "$val" == *_xxx ]] || [[ "$val" == eyJ_* ]] || [[ "$val" == your-* ]]
}

echo ""
echo "[1/4] AVA_ENV..."
AVA_ENV_VAL=$(get_val "AVA_ENV")
if [ "$AVA_ENV_VAL" = "LOCAL" ]; then
    echo "  ERROR: AVA_ENV=LOCAL forbidden"
    ((ERRORS++))
elif [ "$AVA_ENV_VAL" != "STAGING" ] && [ "$AVA_ENV_VAL" != "PROD" ]; then
    echo "  ERROR: AVA_ENV='$AVA_ENV_VAL' invalid"
    ((ERRORS++))
elif [ "$AVA_ENV_VAL" != "$EXPECTED_AVA_ENV" ]; then
    echo "  ERROR: AVA_ENV='$AVA_ENV_VAL' expected '$EXPECTED_AVA_ENV'"
    ((ERRORS++))
else
    echo "  OK: AVA_ENV=$AVA_ENV_VAL"
fi

echo ""
echo "[2/4] Isolation..."
DB_URL=$(get_val "DATABASE_URL")
S3_BUCKET=$(get_val "AWS_S3_BUCKET")
STRIPE_KEY=$(get_val "STRIPE_SECRET_KEY")
MOCK_MODE=$(get_val "AVA_MOCK_MODE")

if [ "$ENV_TYPE" = "prod" ]; then
    echo "$DB_URL" | grep -qi 'staging' && echo "  ERROR: DATABASE_URL has 'staging'" && ((ERRORS++))
    echo "$S3_BUCKET" | grep -qi 'staging' && echo "  ERROR: S3_BUCKET has 'staging'" && ((ERRORS++))
    echo "$STRIPE_KEY" | grep -q 'sk_test_' && echo "  ERROR: Stripe is test key" && ((ERRORS++))
    [ "$MOCK_MODE" = "1" ] && echo "  ERROR: MOCK_MODE=1 in PROD" && ((ERRORS++))
fi

if [ "$ENV_TYPE" = "staging" ]; then
    echo "$S3_BUCKET" | grep -qiE '^ava-artifacts-prod$' && echo "  ERROR: S3 is prod bucket" && ((ERRORS++))
    echo "$STRIPE_KEY" | grep -q 'sk_live_' && echo "  ERROR: Stripe is live key in STAGING" && ((ERRORS++))
fi

[ $ERRORS -eq 0 ] && echo "  OK"

echo ""
echo "[3/4] Required keys (same contour STAGING/PROD)..."

REQUIRED_KEYS=(
    "AVA_ENV"
    "DATABASE_URL"
    "AWS_S3_BUCKET"
    "AWS_ACCESS_KEY_ID"
    "AWS_SECRET_ACCESS_KEY"
    "AWS_REGION"
    "SUPABASE_URL"
    "SUPABASE_ANON_KEY"
    "SUPABASE_JWT_SECRET"
    "STRIPE_SECRET_KEY"
    "STRIPE_WEBHOOK_SECRET"
    "GPU_PHOTO_URL"
    "GPU_VIDEO_URL"
    "GPU_LORA_URL"
    "GPU_API_KEY"
)

for KEY in "${REQUIRED_KEYS[@]}"; do
    VAL=$(get_val "$KEY")
    if is_placeholder "$VAL"; then
        echo "  WARN: $KEY missing/placeholder"
        ((WARNINGS++))
    else
        echo "  OK: $KEY"
    fi
done

echo ""
echo "[4/4] Summary"
echo "============================================="
echo "Errors: $ERRORS | Warnings: $WARNINGS"

[ $ERRORS -gt 0 ] && echo "FAILED" && exit 1
[ "$STRICT_MODE" = "--strict" ] && [ $WARNINGS -gt 0 ] && echo "FAILED (strict)" && exit 1

echo "PASSED"

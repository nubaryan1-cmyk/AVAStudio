#!/bin/bash
# =============================================================================
# AVA STUDIO - STAGING
# =============================================================================
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "============================================="
echo "AVA STUDIO STAGING"
echo "============================================="

[ ! -f ".env.staging" ] && echo "ERROR: .env.staging not found" && exit 1

bash "$SCRIPT_DIR/check_env.sh" staging || exit 1

docker-compose -f docker-compose.staging.yml build
docker-compose -f docker-compose.staging.yml down 2>/dev/null || true
docker-compose -f docker-compose.staging.yml up -d

sleep 5
until curl -sf http://localhost:8000/health > /dev/null 2>&1; do sleep 3; done

echo "STAGING READY: http://localhost:8000"

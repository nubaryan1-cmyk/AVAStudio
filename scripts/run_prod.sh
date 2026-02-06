#!/bin/bash
# =============================================================================
# AVA STUDIO - PRODUCTION
# =============================================================================
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "============================================="
echo "AVA STUDIO PRODUCTION"
echo "============================================="

[ ! -f ".env.prod" ] && echo "ERROR: .env.prod not found" && exit 1

bash "$SCRIPT_DIR/check_env.sh" prod --strict || exit 1

read -p "Deploy to PRODUCTION? (yes/no): " CONFIRM
[ "$CONFIRM" != "yes" ] && exit 0

docker-compose -f docker-compose.prod.yml build

BACKUP="backup-$(date +%Y%m%d-%H%M%S)"
docker tag ava_backend:latest ava_backend:$BACKUP 2>/dev/null || true

docker-compose -f docker-compose.prod.yml down --timeout 30 2>/dev/null || true
docker-compose -f docker-compose.prod.yml up -d

sleep 10
until curl -sf http://localhost:8000/health > /dev/null 2>&1; do sleep 3; done

echo "PROD READY: http://localhost:8000"
echo "Rollback: docker tag ava_backend:$BACKUP ava_backend:latest"

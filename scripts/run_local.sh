#!/bin/bash
# =============================================================================
# AVA STUDIO - LOCAL (STAGING + local resources)
# =============================================================================
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "============================================="
echo "AVA STUDIO LOCAL (AVA_ENV=STAGING)"
echo "============================================="

[ ! -f ".env.local" ] && cp ".env.local.example" ".env.local"

docker-compose -f docker-compose.local.yml down 2>/dev/null || true
docker-compose -f docker-compose.local.yml build
docker-compose -f docker-compose.local.yml up -d postgres minio
sleep 5

until docker exec ava_postgres pg_isready -U ava -d ava_db > /dev/null 2>&1; do sleep 2; done
docker-compose -f docker-compose.local.yml up -d minio-init
sleep 3
docker-compose -f docker-compose.local.yml up -d backend worker

sleep 5
until curl -sf http://localhost:8000/health > /dev/null 2>&1; do sleep 2; done

echo ""
echo "READY: http://localhost:8000"
echo "MinIO: READY (Check .env for credentials)"
#!/bin/bash
# =============================================================================
# AVA STUDIO - DATABASE MIGRATION SCRIPT
# =============================================================================
# Usage: ./scripts/db_migrate.sh [local|staging|prod]
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

ENV_TYPE="${1:-local}"

echo "============================================="
echo "AVA STUDIO - DATABASE MIGRATION"
echo "Environment: $ENV_TYPE"
echo "============================================="

cd "$PROJECT_ROOT"

# Determine env file and compose file
case $ENV_TYPE in
    local)
        ENV_FILE=".env.local"
        COMPOSE_FILE="docker-compose.local.yml"
        CONTAINER="ava_backend"
        ;;
    staging)
        ENV_FILE=".env.staging"
        COMPOSE_FILE="docker-compose.staging.yml"
        CONTAINER="ava_backend_staging"
        ;;
    prod)
        ENV_FILE=".env.prod"
        COMPOSE_FILE="docker-compose.prod.yml"
        CONTAINER="ava_backend_prod"
        ;;
    *)
        echo "ERROR: Unknown environment: $ENV_TYPE"
        echo "Usage: $0 [local|staging|prod]"
        exit 1
        ;;
esac

# Check env file
if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: $ENV_FILE not found!"
    exit 1
fi

# Load DATABASE_URL
source "$ENV_FILE"
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL not set in $ENV_FILE"
    exit 1
fi

echo ""
echo "Database: ${DATABASE_URL%%@*}@***"
echo ""

# Check if running in Docker or direct
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo "Running migration in Docker container: $CONTAINER"
    echo ""
    docker exec "$CONTAINER" python -c "
from migrations.migration_runner import run_migrations
print('Starting migrations...')
run_migrations()
print('Migrations completed!')
"
else
    echo "Container not running. Running migration directly..."
    echo ""
    
    # Check if we have Python and dependencies
    if ! command -v python3 &> /dev/null; then
        echo "ERROR: Python3 not found"
        exit 1
    fi
    
    cd "$PROJECT_ROOT/runpod_probe_worker"
    
    # Export DATABASE_URL for the migration script
    export DATABASE_URL
    
    python3 -c "
import sys
sys.path.insert(0, '.')
from migrations.migration_runner import run_migrations
print('Starting migrations...')
run_migrations()
print('Migrations completed!')
"
fi

echo ""
echo "============================================="
echo "MIGRATION COMPLETE"
echo "============================================="

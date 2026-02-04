#!/bin/bash
#
# ULTRA-FAST SYNC RUNNER
# ======================
# Run this script to sync 75M+ records in ~30 minutes
# The website stays fully responsive because sync runs in a separate process
#
# Usage:
#   ./scripts/run-ultra-sync.sh                    # Sync default integration
#   ./scripts/run-ultra-sync.sh <integrationId>   # Sync specific integration
#
# Requirements:
#   - MongoDB Database Tools (mongoimport)
#   - Node.js
#
# Install MongoDB Tools:
#   macOS:   brew install mongodb-database-tools
#   Ubuntu:  apt install mongodb-database-tools
#

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "=============================================="
echo "🚀 ULTRA-FAST SYNC - Isolated Process Mode"
echo "=============================================="
echo ""

# Change to project directory
cd "$(dirname "$0")/.."

# Check for mongoimport
if ! command -v mongoimport &> /dev/null; then
    echo -e "${YELLOW}⚠️  mongoimport not found. Installing is recommended for best performance.${NC}"
    echo ""
    echo "Install MongoDB Database Tools:"
    echo "  macOS:  brew install mongodb-database-tools"
    echo "  Ubuntu: apt install mongodb-database-tools"
    echo ""
    echo "Falling back to Node.js import (still faster than normal sync)..."
    echo ""
fi

# Get integration ID if provided
INTEGRATION_ID=$1

# Run the sync script with high memory and GC exposed
echo -e "${GREEN}Starting sync in isolated process...${NC}"
echo "Your website will remain fully responsive during sync."
echo ""

# Run with:
# - 20GB heap limit
# - Garbage collection exposed
# - Low priority (nice on Unix for less CPU competition)
nice -n 10 node \
  --max-old-space-size=20480 \
  --expose-gc \
  scripts/ultraFastSync.js $INTEGRATION_ID

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Sync completed successfully!${NC}"
else
    echo ""
    echo -e "${RED}❌ Sync failed with exit code: $EXIT_CODE${NC}"
fi

exit $EXIT_CODE

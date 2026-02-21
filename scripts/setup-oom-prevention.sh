#!/bin/bash
#
# PARTSFORM OOM PREVENTION SETUP
# ===============================
# Configures MongoDB, PM2, and system watchdog for 100% uptime
# Prevents OOM killer from terminating services
#
# Run with: sudo ./setup-oom-prevention.sh
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Detect total system memory
TOTAL_MEM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
TOTAL_MEM_GB=$((TOTAL_MEM_KB / 1024 / 1024))

log "System Memory: ${TOTAL_MEM_GB}GB"

# Calculate memory limits based on total RAM
# MongoDB: ~25% of RAM (but max 32GB)
# Elasticsearch: ~25% of RAM (but max 32GB)
# Node.js PM2 apps: ~25% of RAM
# OS/Other: ~25% of RAM

MONGO_CACHE_GB=$((TOTAL_MEM_GB / 4))
if [ $MONGO_CACHE_GB -gt 32 ]; then
    MONGO_CACHE_GB=32
fi
if [ $MONGO_CACHE_GB -lt 1 ]; then
    MONGO_CACHE_GB=1
fi

ES_HEAP_GB=$((TOTAL_MEM_GB / 4))
if [ $ES_HEAP_GB -gt 31 ]; then
    ES_HEAP_GB=31
fi
if [ $ES_HEAP_GB -lt 1 ]; then
    ES_HEAP_GB=1
fi

log "Calculated limits:"
log "  - MongoDB WiredTiger Cache: ${MONGO_CACHE_GB}GB"
log "  - Elasticsearch Heap: ${ES_HEAP_GB}GB"

echo ""
echo "======================================"
echo "STEP 1: Configure MongoDB Memory Limit"
echo "======================================"

# MongoDB configuration
MONGOD_CONF="/etc/mongod.conf"
if [ -f "$MONGOD_CONF" ]; then
    # Check if wiredTigerCacheSizeGB is already set
    if grep -q "wiredTigerCacheSizeGB" "$MONGOD_CONF"; then
        log "MongoDB wiredTigerCacheSizeGB already configured"
    else
        log "Adding wiredTigerCacheSizeGB to mongod.conf..."
        
        # Backup original
        cp "$MONGOD_CONF" "${MONGOD_CONF}.backup.$(date +%Y%m%d_%H%M%S)"
        
        # Add storage engine configuration
        if grep -q "^storage:" "$MONGOD_CONF"; then
            # Add under existing storage section
            sed -i "/^storage:/a\\  wiredTiger:\\n    engineConfig:\\n      cacheSizeGB: ${MONGO_CACHE_GB}" "$MONGOD_CONF"
        else
            # Add storage section
            echo "" >> "$MONGOD_CONF"
            echo "storage:" >> "$MONGOD_CONF"
            echo "  wiredTiger:" >> "$MONGOD_CONF"
            echo "    engineConfig:" >> "$MONGOD_CONF"
            echo "      cacheSizeGB: ${MONGO_CACHE_GB}" >> "$MONGOD_CONF"
        fi
        
        log_success "MongoDB cache size set to ${MONGO_CACHE_GB}GB"
    fi
else
    log_warning "mongod.conf not found at $MONGOD_CONF"
fi

echo ""
echo "======================================"
echo "STEP 2: Configure MongoDB Auto-restart"
echo "======================================"

# Create systemd override for MongoDB
MONGOD_OVERRIDE_DIR="/etc/systemd/system/mongod.service.d"
mkdir -p "$MONGOD_OVERRIDE_DIR"

cat > "${MONGOD_OVERRIDE_DIR}/restart.conf" << EOF
[Service]
Restart=always
RestartSec=5
TimeoutStopSec=120
OOMScoreAdjust=-500
EOF

log_success "MongoDB auto-restart configured"

echo ""
echo "======================================"
echo "STEP 3: Configure Elasticsearch Memory"
echo "======================================"

# Elasticsearch JVM options
ES_JVM_OPTIONS="/etc/elasticsearch/jvm.options.d/memory.options"
if [ -d "/etc/elasticsearch/jvm.options.d" ]; then
    cat > "$ES_JVM_OPTIONS" << EOF
# Heap size - set to ${ES_HEAP_GB}g (25% of system RAM, max 31GB)
-Xms${ES_HEAP_GB}g
-Xmx${ES_HEAP_GB}g

# Reduce memory pressure
-XX:+UseG1GC
-XX:G1HeapRegionSize=16m
-XX:InitiatingHeapOccupancyPercent=35

# Faster GC for transient allocations
-XX:+AlwaysPreTouch
-XX:-UseBiasedLocking
EOF
    log_success "Elasticsearch heap set to ${ES_HEAP_GB}GB"
else
    log_warning "Elasticsearch jvm.options.d not found"
fi

# Elasticsearch systemd override
ES_OVERRIDE_DIR="/etc/systemd/system/elasticsearch.service.d"
if [ -d "/etc/systemd/system" ]; then
    mkdir -p "$ES_OVERRIDE_DIR"
    cat > "${ES_OVERRIDE_DIR}/restart.conf" << EOF
[Service]
Restart=always
RestartSec=10
OOMScoreAdjust=-400
EOF
    log_success "Elasticsearch auto-restart configured"
fi

echo ""
echo "======================================"
echo "STEP 4: Configure System Swap"
echo "======================================"

# Check if swap exists
SWAP_SIZE=$(free -m | grep Swap | awk '{print $2}')
if [ "$SWAP_SIZE" -lt 4096 ]; then
    log_warning "Swap is ${SWAP_SIZE}MB - recommend at least 4GB for OOM prevention"
    echo "To add swap:"
    echo "  sudo fallocate -l 8G /swapfile"
    echo "  sudo chmod 600 /swapfile"
    echo "  sudo mkswap /swapfile"
    echo "  sudo swapon /swapfile"
    echo "  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab"
else
    log_success "Swap size: ${SWAP_SIZE}MB"
fi

# Set swappiness low (prefer RAM, but use swap before OOM)
CURRENT_SWAPPINESS=$(cat /proc/sys/vm/swappiness)
if [ "$CURRENT_SWAPPINESS" -gt 30 ]; then
    echo 10 > /proc/sys/vm/swappiness
    echo "vm.swappiness=10" >> /etc/sysctl.d/99-partsform.conf
    log_success "Swappiness set to 10 (was ${CURRENT_SWAPPINESS})"
else
    log_success "Swappiness: ${CURRENT_SWAPPINESS}"
fi

echo ""
echo "======================================"
echo "STEP 5: Install System Watchdog"
echo "======================================"

# Copy watchdog script
WATCHDOG_SCRIPT="/usr/local/bin/partsform-watchdog.sh"
SCRIPT_DIR="$(dirname "$0")"

if [ -f "${SCRIPT_DIR}/system-watchdog.sh" ]; then
    cp "${SCRIPT_DIR}/system-watchdog.sh" "$WATCHDOG_SCRIPT"
    chmod +x "$WATCHDOG_SCRIPT"
    log_success "Watchdog script installed to $WATCHDOG_SCRIPT"
else
    log_warning "system-watchdog.sh not found in $SCRIPT_DIR"
fi

# Add to crontab if not already present
if ! crontab -l 2>/dev/null | grep -q "partsform-watchdog"; then
    (crontab -l 2>/dev/null; echo "* * * * * $WATCHDOG_SCRIPT >> /var/log/partsform-watchdog.log 2>&1") | crontab -
    log_success "Watchdog added to crontab (runs every minute)"
else
    log_success "Watchdog already in crontab"
fi

# Create log rotation
cat > /etc/logrotate.d/partsform-watchdog << EOF
/var/log/partsform-watchdog.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
}
EOF
log_success "Log rotation configured"

echo ""
echo "======================================"
echo "STEP 6: Configure OOM Killer Protection"
echo "======================================"

# Protect MongoDB from OOM killer
if [ -f /proc/$(pgrep -x mongod 2>/dev/null)/oom_score_adj ] 2>/dev/null; then
    echo -500 > /proc/$(pgrep -x mongod)/oom_score_adj
    log_success "MongoDB OOM score adjusted (-500)"
fi

# Protect PM2 from OOM killer
PM2_PID=$(pgrep -x "PM2" 2>/dev/null || pgrep -f "pm2" | head -1)
if [ -n "$PM2_PID" ] && [ -f "/proc/${PM2_PID}/oom_score_adj" ]; then
    echo -300 > /proc/${PM2_PID}/oom_score_adj
    log_success "PM2 OOM score adjusted (-300)"
fi

echo ""
echo "======================================"
echo "STEP 7: Reload Services"
echo "======================================"

# Reload systemd
systemctl daemon-reload
log_success "Systemd reloaded"

# Note: Don't restart services automatically - let user do it
echo ""
log_warning "Services need restart to apply changes:"
echo "  sudo systemctl restart mongod"
echo "  sudo systemctl restart elasticsearch"
echo "  pm2 restart all"

echo ""
echo "======================================"
echo "SETUP COMPLETE"
echo "======================================"
echo ""
echo "Summary:"
echo "  ✓ MongoDB cache: ${MONGO_CACHE_GB}GB"
echo "  ✓ Elasticsearch heap: ${ES_HEAP_GB}GB"
echo "  ✓ Auto-restart: enabled for MongoDB and Elasticsearch"
echo "  ✓ Watchdog: runs every minute"
echo "  ✓ OOM protection: services have lower OOM scores"
echo ""
echo "Monitor with:"
echo "  tail -f /var/log/partsform-watchdog.log"
echo "  $WATCHDOG_SCRIPT  # Run manually"
echo ""

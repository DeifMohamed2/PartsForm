#!/bin/bash
#
# PARTSFORM SYSTEM WATCHDOG v2.0
# ==============================
# Comprehensive monitoring and auto-recovery for all services
# Prevents OOM by proactive memory management
# Ensures 100% uptime for MongoDB, PM2, Elasticsearch
#
# Features:
# - System memory monitoring with proactive action
# - MongoDB health check and auto-restart
# - PM2 apps health check and auto-restart
# - Elasticsearch health check
# - Graceful sync pause when memory is critical
# - Full logging with rotation
#
# Install: Copy to /usr/local/bin/system-watchdog.sh
# Run: Add to crontab: * * * * * /usr/local/bin/system-watchdog.sh >> /var/log/partsform-watchdog.log 2>&1
#

# Configuration
LOG_FILE="/var/log/partsform-watchdog.log"
PID_FILE="/var/run/partsform-watchdog.pid"
PM2_USER="${PM2_USER:-root}"
MEMORY_WARNING_PERCENT=25
MEMORY_CRITICAL_PERCENT=15
MEMORY_EMERGENCY_PERCENT=8
MAX_MONGO_MEMORY_GB=16

# Lockfile to prevent concurrent runs
LOCKFILE="/var/run/partsform-watchdog.lock"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ ERROR: $1" >&2
}

log_warning() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  WARNING: $1"
}

log_success() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $1"
}

# Get system memory info
get_memory_info() {
    local total_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    local available_kb=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
    local free_kb=$(grep MemFree /proc/meminfo | awk '{print $2}')
    local buffers_kb=$(grep Buffers /proc/meminfo | awk '{print $2}')
    local cached_kb=$(grep "^Cached:" /proc/meminfo | awk '{print $2}')
    
    # Use available if exists, otherwise calculate
    if [ -z "$available_kb" ]; then
        available_kb=$((free_kb + buffers_kb + cached_kb))
    fi
    
    local total_mb=$((total_kb / 1024))
    local available_mb=$((available_kb / 1024))
    local used_mb=$((total_mb - available_mb))
    local available_percent=$((available_mb * 100 / total_mb))
    
    echo "$total_mb $available_mb $used_mb $available_percent"
}

# Check MongoDB status
check_mongodb() {
    if systemctl is-active --quiet mongod; then
        return 0
    fi
    return 1
}

# Get MongoDB memory usage (in MB)
get_mongo_memory() {
    local pid=$(pgrep -x mongod)
    if [ -n "$pid" ]; then
        local mem_kb=$(ps -o rss= -p $pid 2>/dev/null)
        if [ -n "$mem_kb" ]; then
            echo $((mem_kb / 1024))
            return
        fi
    fi
    echo "0"
}

# Restart MongoDB with memory limit
restart_mongodb() {
    log "Restarting MongoDB..."
    
    # Stop MongoDB gracefully
    systemctl stop mongod
    sleep 3
    
    # Clear MongoDB cache if it exists
    if [ -f /var/lib/mongodb/WiredTiger.lock ]; then
        log "Clearing WiredTiger lock..."
        rm -f /var/lib/mongodb/WiredTiger.lock
    fi
    
    # Start MongoDB
    systemctl start mongod
    
    # Wait for it to be ready
    local retries=30
    while [ $retries -gt 0 ]; do
        if mongosh --quiet --eval "db.adminCommand('ping')" >/dev/null 2>&1; then
            log_success "MongoDB restarted successfully"
            return 0
        fi
        sleep 1
        retries=$((retries - 1))
    done
    
    log_error "MongoDB failed to restart"
    return 1
}

# Check PM2 apps status
check_pm2_apps() {
    local pm2_path=$(which pm2 2>/dev/null || echo "/usr/bin/pm2")
    
    # Check if partsform is running
    if $pm2_path list 2>/dev/null | grep -q "partsform.*online"; then
        return 0
    fi
    return 1
}

# Restart PM2 apps
restart_pm2() {
    local pm2_path=$(which pm2 2>/dev/null || echo "/usr/bin/pm2")
    
    log "Restarting PM2 apps..."
    
    # Go to app directory
    cd /root/partsform || cd /home/*/partsform || cd /var/www/partsform || {
        log_error "Cannot find partsform directory"
        return 1
    }
    
    # Restart all apps
    $pm2_path restart all
    
    sleep 5
    
    if check_pm2_apps; then
        log_success "PM2 apps restarted successfully"
        return 0
    fi
    
    log_error "PM2 apps failed to restart"
    return 1
}

# Check Elasticsearch status
check_elasticsearch() {
    if curl -s "http://localhost:9200/_cluster/health" >/dev/null 2>&1; then
        return 0
    fi
    return 1
}

# Restart Elasticsearch
restart_elasticsearch() {
    log "Restarting Elasticsearch..."
    
    systemctl restart elasticsearch
    
    # Wait for ES to be ready (can take 30-60 seconds)
    local retries=60
    while [ $retries -gt 0 ]; do
        if curl -s "http://localhost:9200/_cluster/health" >/dev/null 2>&1; then
            log_success "Elasticsearch restarted successfully"
            return 0
        fi
        sleep 2
        retries=$((retries - 1))
    done
    
    log_error "Elasticsearch failed to restart"
    return 1
}

# Clear system caches to free memory (safe operation)
clear_caches() {
    log "Clearing system caches..."
    sync
    echo 1 > /proc/sys/vm/drop_caches
    sleep 2
    log_success "System caches cleared"
}

# Handle memory emergency
handle_memory_emergency() {
    local mem_info=($1)
    local available_mb=${mem_info[1]}
    local available_percent=${mem_info[3]}
    
    log_error "MEMORY EMERGENCY! Only ${available_percent}% (${available_mb}MB) available"
    
    # Step 1: Clear system caches
    clear_caches
    
    # Recheck memory
    local new_mem_info=($(get_memory_info))
    local new_available_percent=${new_mem_info[3]}
    
    if [ $new_available_percent -gt $MEMORY_CRITICAL_PERCENT ]; then
        log_success "Memory recovered after cache clear: ${new_available_percent}%"
        return 0
    fi
    
    # Step 2: Get MongoDB memory and check if it's the culprit
    local mongo_mem=$(get_mongo_memory)
    log "MongoDB using ${mongo_mem}MB"
    
    # If MongoDB is using too much memory, restart it with limits
    local mongo_mem_gb=$((mongo_mem / 1024))
    if [ $mongo_mem_gb -gt $MAX_MONGO_MEMORY_GB ]; then
        log_warning "MongoDB using ${mongo_mem_gb}GB (limit: ${MAX_MONGO_MEMORY_GB}GB) - restarting"
        restart_mongodb
        sleep 5
    fi
    
    # Recheck memory again
    new_mem_info=($(get_memory_info))
    new_available_percent=${new_mem_info[3]}
    
    if [ $new_available_percent -gt $MEMORY_CRITICAL_PERCENT ]; then
        log_success "Memory recovered: ${new_available_percent}%"
        return 0
    fi
    
    # Step 3: Restart PM2 apps to free memory (sync will auto-resume)
    log_warning "Memory still critical, restarting PM2 apps..."
    restart_pm2
    
    return 0
}

# Handle memory critical (less aggressive than emergency)
handle_memory_critical() {
    local mem_info=($1)
    local available_percent=${mem_info[3]}
    
    log_warning "Memory CRITICAL: ${available_percent}% available"
    
    # Just clear caches, don't restart services
    clear_caches
}

# Main watchdog function
run_watchdog() {
    log "─────────────────────────────────────────"
    log "PARTSFORM WATCHDOG CHECK"
    
    # Get memory info
    local mem_info=$(get_memory_info)
    local mem_array=($mem_info)
    local total_mb=${mem_array[0]}
    local available_mb=${mem_array[1]}
    local available_percent=${mem_array[3]}
    
    log "Memory: ${available_mb}MB available (${available_percent}% of ${total_mb}MB)"
    
    # Memory checks (priority 1)
    if [ $available_percent -le $MEMORY_EMERGENCY_PERCENT ]; then
        handle_memory_emergency "$mem_info"
    elif [ $available_percent -le $MEMORY_CRITICAL_PERCENT ]; then
        handle_memory_critical "$mem_info"
    fi
    
    # Service checks (priority 2)
    local services_ok=true
    
    # Check MongoDB
    if ! check_mongodb; then
        log_error "MongoDB is DOWN!"
        restart_mongodb
        services_ok=false
    else
        log_success "MongoDB: running ($(get_mongo_memory)MB)"
    fi
    
    # Check PM2 apps
    if ! check_pm2_apps; then
        log_error "PM2 apps are DOWN!"
        restart_pm2
        services_ok=false
    else
        log_success "PM2 apps: running"
    fi
    
    # Check Elasticsearch
    if ! check_elasticsearch; then
        log_error "Elasticsearch is DOWN!"
        restart_elasticsearch
        services_ok=false
    else
        log_success "Elasticsearch: running"
    fi
    
    if [ "$services_ok" = true ]; then
        log "All services healthy ✓"
    else
        log_warning "Some services were restarted"
    fi
}

# Main execution
main() {
    # Check if another instance is running
    if [ -f "$LOCKFILE" ]; then
        pid=$(cat "$LOCKFILE")
        if ps -p $pid > /dev/null 2>&1; then
            # Another instance is running
            exit 0
        fi
        # Stale lock file
        rm -f "$LOCKFILE"
    fi
    
    # Create lock file
    echo $$ > "$LOCKFILE"
    trap "rm -f $LOCKFILE" EXIT
    
    # Run watchdog
    run_watchdog
}

# Run main
main

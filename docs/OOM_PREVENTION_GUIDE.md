# OOM (Out-Of-Memory) Prevention Guide

**System:** Ubuntu VPS, Node.js (PM2), MongoDB, Elasticsearch
**Updated:** February 2026 - Enhanced with System Memory Monitoring

---

## Overview

This codebase implements comprehensive defensive strategies to prevent and handle OOM errors:

1. **Circuit Breakers** - Fail fast when services are unavailable
2. **Log Throttling** - Prevent log spam during outages
3. **Memory Watchdog** - Stop work before memory exhaustion (ENHANCED: now monitors SYSTEM memory)
4. **System Memory Monitor** - Background monitoring with proactive action
5. **Exponential Backoff** - Smart retry with increasing delays
6. **PM2 Memory Limits** - Restart processes before system OOM
7. **MongoDB Cache Limits** - Prevent MongoDB from consuming all RAM
8. **System Watchdog Service** - Cron-based service health monitoring

---

## Quick Setup

Run the setup script to configure everything:

```bash
sudo ./scripts/setup-oom-prevention.sh
```

This will:
- Limit MongoDB's WiredTiger cache (25% of RAM)
- Configure Elasticsearch heap size (25% of RAM)
- Install the system watchdog cron job
- Set up auto-restart for all services
- Protect services from OOM killer

---

## Key Components

### 1. OOM Prevention Utilities (`utils/oomPrevention.js`)

Central module providing:

```javascript
const { 
  circuitBreakers,       // Pre-configured breakers for mongodb, elasticsearch, ftp
  logThrottle,           // Global log throttler
  memoryWatchdog,        // Memory monitoring (process + system)
  systemMemoryMonitor,   // Background system memory monitor
  memorySafeExecutor,    // Execute with memory checkpoints
  ExponentialBackoff,    // Retry with backoff
  JobLock,               // Prevent parallel heavy jobs
} = require('./utils/oomPrevention');
```

### 2. Memory Watchdog (ENHANCED)

Now monitors BOTH process AND system memory:

```javascript
// Check memory status
const { safe, level, usage, reason } = memoryWatchdog.checkMemory();

// usage now includes:
// - rss, heapTotal, heapUsed, external (process)
// - systemTotal, systemFree, systemUsed, systemFreePercent (system)

if (!safe) {
  console.log('Cannot start operation:', reason);
  // reason might be: "SYSTEM memory critical: only 8% free (7680MB of 96000MB)"
}
```

**Adaptive Thresholds:**
Thresholds automatically scale based on system RAM:
- 96GB server: warning=2GB, critical=3GB, max=4GB (process)
- 16GB server: warning=1GB, critical=1.5GB, max=2GB (process)
- System: warning=25%, critical=15%, max=8% free

### 3. System Memory Monitor

Background monitor that takes proactive action:

```javascript
// Start monitoring (done automatically in sync worker)
systemMemoryMonitor.start();

// Set custom handlers
systemMemoryMonitor.setHandlers({
  onWarning: (status) => console.log('Memory warning'),
  onCritical: async (status) => {
    // Pause heavy operations
    await pauseSync();
  },
  onEmergency: async (status) => {
    // Emergency GC, pause sync, clear caches
  },
  onRecovered: (status) => {
    // Resume operations
  },
});
```

### 4. Sync Pause/Resume

Sync automatically pauses when memory is critical:

```javascript
// Check if sync is paused
const { paused, reason } = memoryWatchdog.isSyncPaused();
if (paused) {
  console.log('Sync paused:', reason);
}

// Manually pause/resume
memoryWatchdog.pauseForMemory('Manual pause for maintenance');
memoryWatchdog.resumeSync();
```

---

## PM2 Configuration (`ecosystem.config.js`)

Memory limits and restart behavior:

```javascript
{
  name: 'partsform',
  max_memory_restart: '2G',                  // Restart before hitting limit
  node_args: '--max-old-space-size=2048 --expose-gc',  // V8 heap + GC control
  exp_backoff_restart_delay: 1000,           // Backoff on restarts
  max_restarts: 15,                          // Max restarts
  restart_delay: 5000,                       // Cooldown between restarts
}

{
  name: 'sync-worker',
  max_memory_restart: '8G',                  // 8GB limit for heavy sync
  node_args: '--max-old-space-size=8192 --expose-gc --gc-interval=100',
  kill_timeout: 120000,                      // 2 min for graceful shutdown
}
```

---

## MongoDB Memory Configuration

**CRITICAL**: Limit MongoDB's WiredTiger cache to prevent it from using all RAM.

In `/etc/mongod.conf`:

```yaml
storage:
  wiredTiger:
    engineConfig:
      cacheSizeGB: 16  # 25% of 96GB RAM
```

The setup script calculates this automatically based on system RAM.

---

## System Watchdog Service

The system watchdog runs every minute via cron and:

1. **Monitors system memory** - takes action before OOM killer
2. **Checks MongoDB** - auto-restarts if down
3. **Checks PM2 apps** - auto-restarts if down
4. **Checks Elasticsearch** - auto-restarts if down
5. **Clears caches** - when memory is critical
6. **Logs everything** - to `/var/log/partsform-watchdog.log`

Install with:
```bash
sudo ./scripts/setup-oom-prevention.sh
```

Monitor with:
```bash
tail -f /var/log/partsform-watchdog.log
```

---

## How Services Use OOM Prevention

### SyncWorker (`services/syncWorker.js`)

- **SystemMemoryMonitor** runs in background
- **Memory guard** before starting sync
- **Sync pause/resume** when memory is critical
- **Circuit breaker** for MongoDB connection
- **Exponential backoff** on failures

### SchedulerService (`services/schedulerService.js`)

- Circuit breaker check before health checks
- Log throttling for repeated errors
- Backoff on consecutive failures

### Database Connection (`config/database.js`)

- Log throttling for disconnect events
- Circuit breaker updates on connect/disconnect

---

## Decision Tree (For AI Agent)

```
IF system memory < 8% free
  → EMERGENCY: clear caches, pause sync, GC
  → wait for recovery
  → auto-resume when > 15% free

IF system memory < 15% free
  → CRITICAL: pause new syncs
  → trigger GC
  → clear system caches  

IF process memory > max threshold
  → stop job
  → mark failed
  → PM2 will restart

IF sync is paused
  → don't start new syncs
  → continue health checks
  → auto-resume when memory recovers

IF dependency unavailable (circuit open)
  → skip non-critical tasks
  → use longer poll interval
  → fail fast on critical tasks

IF job already running
  → do not start new one (JobLock)
```

---

## Monitoring

### Check System Memory

```javascript
const { systemMemoryMonitor } = require('./utils/oomPrevention');

console.log(systemMemoryMonitor.getStatus());
// { totalMB: 96000, freeMB: 48000, freePercent: 50, level: 'ok' }
```

### Check Memory Watchdog

```javascript
const { memoryWatchdog } = require('./utils/oomPrevention');

console.log(memoryWatchdog.getStatus());
// { 
//   rss: 256, heapUsed: 128, 
//   systemTotal: 96000, systemFree: 48000, systemFreePercent: 50,
//   level: 'ok', safe: true, syncPaused: false,
//   trend: 'stable'
// }
```

### Check Circuit Breakers

```javascript
const { circuitBreakers } = require('./utils/oomPrevention');

console.log(circuitBreakers.mongodb.getStatus());
// { name: 'mongodb', state: 'closed', failures: 0, isAvailable: true }
```

---

## Recovery After OOM

When OOM kills a process:

1. **System watchdog detects** within 1 minute
2. **MongoDB auto-restarts** via systemd (5s delay)
3. **PM2 auto-restarts** with `exp_backoff_restart_delay`
4. **Circuit breakers reset** after `resetTimeout` (30-60s)
5. **Syncs auto-resume** when memory recovers

**No manual intervention needed** - full automation.

---

## Memory Budget (96GB Server)

| Service | Memory | Notes |
|---------|--------|-------|
| MongoDB | ~16GB | WiredTiger cache limit |
| Elasticsearch | ~16GB | JVM heap |
| sync-worker | ~8GB | PM2 limit |
| partsform | ~2GB | PM2 limit |
| OS + buffers | ~54GB | Available for caching |

---

## Key Rules

1. **Never allow unlimited memory** - Always set `--max-old-space-size`
2. **Limit MongoDB cache** - Set `wiredTigerCacheSizeGB` in mongod.conf
3. **Limit ES heap** - Never exceed 31GB (compressed OOPs)
4. **Monitor system memory** - Not just process memory
5. **Auto-restart everything** - Via systemd and PM2
6. **Pause before crash** - Better to pause sync than crash server
2. **Never retry infinitely** - Use maxRetries with backoff
3. **Never spam logs** - Use logThrottle for repeated messages
4. **Never start parallel heavy jobs** - Use JobLock
5. **Always check circuit breakers** - Before hitting external services
6. **Stream, don't buffer** - Use streams for large files
7. **Clear arrays after batch** - `batch.length = 0`

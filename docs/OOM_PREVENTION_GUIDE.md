# OOM (Out-Of-Memory) Prevention Guide

**System:** Ubuntu VPS, Node.js (PM2), MongoDB, Elasticsearch

---

## Overview

This codebase implements defensive strategies to prevent and handle OOM errors:

1. **Circuit Breakers** - Fail fast when services are unavailable
2. **Log Throttling** - Prevent log spam during outages
3. **Memory Watchdog** - Stop work before memory exhaustion
4. **Exponential Backoff** - Smart retry with increasing delays
5. **PM2 Memory Limits** - Restart processes before system OOM

---

## Key Components

### 1. OOM Prevention Utilities (`utils/oomPrevention.js`)

Central module providing:

```javascript
const { 
  circuitBreakers,    // Pre-configured breakers for mongodb, elasticsearch, ftp
  logThrottle,        // Global log throttler
  memoryWatchdog,     // Memory monitoring
  ExponentialBackoff, // Retry with backoff
  JobLock,            // Prevent parallel heavy jobs
} = require('./utils/oomPrevention');
```

### 2. Circuit Breaker Pattern

Prevents retry storms when a service is down.

```javascript
// Check before making requests
if (!circuitBreakers.mongodb.isAvailable()) {
  // Skip operation - service is down
  return;
}

try {
  await mongoOperation();
  circuitBreakers.mongodb.recordSuccess();
} catch (error) {
  circuitBreakers.mongodb.recordFailure(error);
  throw error;
}
```

**States:**
- `closed` - Normal operation
- `open` - Service unavailable, skip requests
- `half-open` - Testing if service recovered

### 3. Log Throttling

Prevents log spam when errors repeat.

```javascript
// Instead of: console.error('Health check error:', error.message);
// Use:
logThrottle.error('healthcheck-error', `Health check error: ${error.message}`);
```

- Max 3 logs per minute per message type
- Shows summary after suppression
- Auto-cleanup of old entries

### 4. Memory Watchdog

Guards against OOM during heavy operations.

```javascript
// Check if safe to start heavy operation
const { safe, level, usage } = memoryWatchdog.checkMemory();
if (!safe) {
  throw new Error('Memory too high, cannot start operation');
}

// Or use guard (throws if unsafe)
memoryWatchdog.guard('sync-operation');
```

**Thresholds (configurable):**
- Warning: 1GB RSS
- Critical: 1.5GB RSS
- Max: 2GB RSS

### 5. Exponential Backoff

Smart retry for transient failures.

```javascript
const backoff = new ExponentialBackoff({
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  maxRetries: 5,
});

await backoff.execute(async (attempt) => {
  return await unreliableOperation();
}, {
  onRetry: (error, attempt, delay) => {
    console.log(`Retry ${attempt} in ${delay}ms`);
  },
  shouldRetry: (error) => isConnectionError(error),
});
```

---

## PM2 Configuration (`ecosystem.config.js`)

Memory limits and restart behavior:

```javascript
{
  name: 'partsform',
  max_memory_restart: '1500M',              // Restart before 2GB
  node_args: '--max-old-space-size=1536',   // V8 heap limit
  exp_backoff_restart_delay: 1000,          // Backoff on restarts
  max_restarts: 15,                         // Max restarts
  restart_delay: 5000,                      // Cooldown between restarts
}
```

---

## How Services Use OOM Prevention

### SchedulerService (`services/schedulerService.js`)

- Circuit breaker check before health checks
- Log throttling for repeated errors
- Backoff on consecutive failures

### SyncWorker (`services/syncWorker.js`)

- Circuit breaker for MongoDB connection
- Memory guard before starting sync
- Connection retry with exponential backoff
- Longer polling interval when services unavailable

### EmailInquiryScheduler (`services/emailInquiryScheduler.js`)

- Circuit breaker before retry queries
- Log throttling for connection errors

### Database Connection (`config/database.js`)

- Log throttling for disconnect events
- Circuit breaker updates on connect/disconnect

---

## Decision Tree (For AI Agent)

```
IF memory > threshold
  → stop job
  → mark failed
  → retry later

IF dependency unavailable (circuit open)
  → skip non-critical tasks
  → use longer poll interval
  → fail fast on critical tasks

IF job already running
  → do not start new one (JobLock)

IF repeated failures
  → exponential backoff
  → throttle logs
```

---

## Monitoring

### Check Circuit Breaker Status

```javascript
const { circuitBreakers } = require('./utils/oomPrevention');

console.log(circuitBreakers.mongodb.getStatus());
// { name: 'mongodb', state: 'closed', failures: 0, isAvailable: true }
```

### Check Memory Status

```javascript
const { memoryWatchdog } = require('./utils/oomPrevention');

console.log(memoryWatchdog.getStatus());
// { rss: 256, heapUsed: 128, level: 'ok', safe: true }
```

---

## Recovery After OOM

When OOM kills a process:

1. **PM2 auto-restarts** with `exp_backoff_restart_delay`
2. **Circuit breakers reset** after `resetTimeout` (30-60s)
3. **Stale jobs cleaned up** by health check
4. **Syncs resume** from scheduler's due-sync detection

No manual intervention needed in most cases.

---

## Key Rules

1. **Never allow unlimited memory** - Always set `--max-old-space-size`
2. **Never retry infinitely** - Use maxRetries with backoff
3. **Never spam logs** - Use logThrottle for repeated messages
4. **Never start parallel heavy jobs** - Use JobLock
5. **Always check circuit breakers** - Before hitting external services
6. **Stream, don't buffer** - Use streams for large files
7. **Clear arrays after batch** - `batch.length = 0`

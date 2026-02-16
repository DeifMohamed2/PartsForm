module.exports = {
  apps: [
    // ============================================
    // MAIN WEBSITE - Lightweight, always fast
    // ============================================
    // OOM Prevention:
    // - max_memory_restart ensures PM2 restarts before system OOM killer
    // - node_args --max-old-space-size limits V8 heap
    // - exp_backoff_restart_delay prevents restart storms
    {
      name: 'partsform',
      script: 'app.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1500M',   // Restart before hitting 2GB limit
      node_args: '--max-old-space-size=1536',  // V8 heap limit (slightly less than max_memory)
      env: {
        NODE_ENV: 'production',
        SYNC_USE_WORKER: 'true',  // Delegate sync to worker process
      },
      env_production: {
        NODE_ENV: 'production',
        SYNC_USE_WORKER: 'true',
      },
      // OOM Recovery settings
      exp_backoff_restart_delay: 1000,     // Start at 1s, increase on repeated restarts
      max_restarts: 15,                     // Max restarts within restart_delay window
      min_uptime: '10s',                    // Consider crashed if exits in <10s
      restart_delay: 5000,                  // Wait 5s between restarts (after exp_backoff exhausted)
      listen_timeout: 30000,                // Wait for app to be ready
      kill_timeout: 10000,                  // Time before SIGKILL (after SIGTERM)
    },
    
    // ============================================
    // TURBO SYNC WORKER - STREAMING MODE
    // ============================================
    // Target: 75M records in 30 minutes
    // Server: 96GB RAM, 18 cores, NVMe SSD
    // Uses streaming to minimize memory usage
    //
    // OOM Prevention:
    // - Lower memory limit than available to leave room for MongoDB + ES
    // - --expose-gc allows manual GC triggering
    // - Circuit breaker in code prevents retry storms
    // - Autorestart with backoff prevents crash loops
    {
      name: 'sync-worker',
      script: 'services/syncWorker.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '8G',   // 8GB limit - leaves room for MongoDB (4GB) + Elasticsearch (4GB) + OS
      node_args: '--max-old-space-size=8192 --expose-gc --gc-interval=100',
      autorestart: true,
      watch: false,
      kill_timeout: 60000,        // 60s to gracefully shutdown (let current batch complete)
      env: {
        NODE_ENV: 'production',
        SYNC_ENGINE: 'turbo',
        SYNC_PRIORITY: 'high',
        UV_THREADPOOL_SIZE: '32',
      },
      // OOM Recovery settings
      exp_backoff_restart_delay: 5000,     // Start at 5s for worker (slower restarts)
      max_restarts: 10,                     // Fewer restarts for worker
      min_uptime: '30s',                    // Worker needs longer to be considered stable
      restart_delay: 30000,                 // Wait 30s between restarts (heavy operation cooldown)
    }
  ]
};

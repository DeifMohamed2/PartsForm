module.exports = {
  apps: [
    // ============================================
    // MAIN WEBSITE - Lightweight, always fast
    // ============================================
    {
      name: 'partsform',
      script: 'app.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '4G',  // Website only - doesn't need much
      node_args: '--max-old-space-size=4096',
      env: {
        NODE_ENV: 'production',
        SYNC_USE_WORKER: 'true',  // Delegate sync to worker process
      },
      env_production: {
        NODE_ENV: 'production',
        SYNC_USE_WORKER: 'true',
      },
    },
    
    // ============================================
    // TURBO SYNC WORKER - MAXIMUM SPEED
    // ============================================
    // Target: 75M records in 30 minutes
    // Server: 96GB RAM, 18 cores, NVMe SSD
    // Uses mongoimport (Go) for 10-50x faster imports
    {
      name: 'sync-worker',
      script: 'services/syncWorker.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '24G',
      node_args: '--max-old-space-size=24576 --expose-gc',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        SYNC_ENGINE: 'turbo',       // Use TURBO engine (not 'legacy')
        SYNC_PRIORITY: 'high',
        UV_THREADPOOL_SIZE: '32',   // More threads for I/O
      },
    }
  ]
};

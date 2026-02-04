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
    // SYNC WORKER - MAXIMUM SPEED dedicated process
    // ============================================
    // Server: 96GB RAM, 18 cores, NVMe SSD
    // Has its own 20GB memory space
    // Runs at FULL POWER - no throttling!
    {
      name: 'sync-worker',
      script: 'services/syncWorker.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '18G',
      node_args: '--max-old-space-size=20480 --expose-gc',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        SYNC_PRIORITY: 'high',      // Maximum speed - no yielding
        SYNC_DEFER_ES: 'true',      // MongoDB first, ES after
        SYNC_PRODUCTION_MODE: 'true',
      },
    }
  ]
};

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
      max_memory_restart: '2G',   // Website only - doesn't need much
      node_args: '--max-old-space-size=2048',
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
    // TURBO SYNC WORKER - STREAMING MODE
    // ============================================
    // Target: 75M records in 30 minutes
    // Server: 96GB RAM, 18 cores, NVMe SSD
    // Uses streaming to minimize memory usage
    {
      name: 'sync-worker',
      script: 'services/syncWorker.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '16G',  // 16GB limit - leaves room for MongoDB (4GB) + Elasticsearch
      node_args: '--max-old-space-size=16384 --expose-gc --gc-interval=100',
      autorestart: true,
      watch: false,
      kill_timeout: 60000,        // 60s to gracefully shutdown
      env: {
        NODE_ENV: 'production',
        SYNC_ENGINE: 'turbo',
        SYNC_PRIORITY: 'high',
        UV_THREADPOOL_SIZE: '32',
      },
    }
  ]
};

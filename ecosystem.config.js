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
    // SYNC WORKER - Dedicated heavy-duty process
    // ============================================
    // Has its own 20GB memory space
    // Runs sync at MAXIMUM SPEED
    // Does NOT affect website performance AT ALL
    {
      name: 'sync-worker',
      script: 'services/syncWorker.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '16G',
      node_args: '--max-old-space-size=20480 --expose-gc',
      autorestart: true,  // Keep running, watching for sync requests
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    }
  ]
};

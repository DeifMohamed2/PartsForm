module.exports = {
  apps: [
    // Main Application - runs the website
    {
      name: 'partsform',
      script: 'app.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '8G', // Website only needs 8GB max
      node_args: '--max-old-space-size=8192',
      env: {
        NODE_ENV: 'production',
        SYNC_USE_ISOLATED: 'true', // All syncs run in separate process
      },
      env_production: {
        NODE_ENV: 'production',
        SYNC_USE_ISOLATED: 'true',
      },
    },
    
    // Ultra-Fast Sync Worker - runs in SEPARATE process
    // Does NOT affect website performance AT ALL
    // Start manually: pm2 start ecosystem.config.js --only sync-worker
    {
      name: 'sync-worker',
      script: 'scripts/ultraFastSync.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '16G',
      node_args: '--max-old-space-size=20480 --expose-gc',
      autorestart: false, // Don't auto-restart after sync completes
      watch: false,
      cron_restart: '0 3 * * *', // Run daily at 3 AM (optional)
      env: {
        NODE_ENV: 'production',
      },
    }
  ]
};

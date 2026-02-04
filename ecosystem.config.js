module.exports = {
  apps: [
    // Main Application - runs the website AND handles sync requests
    {
      name: 'partsform',
      script: 'app.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '14G',
      node_args: '--max-old-space-size=20480 --expose-gc',
      env: {
        NODE_ENV: 'production',
        SYNC_PRODUCTION_MODE: 'true',
        SYNC_PRIORITY: 'low',      // Website-friendly sync
        SYNC_DEFER_ES: 'true',     // Phase 1: MongoDB, Phase 2: ES reindex
      },
      env_production: {
        NODE_ENV: 'production',
        SYNC_PRODUCTION_MODE: 'true',
        SYNC_PRIORITY: 'low',
        SYNC_DEFER_ES: 'true',
      },
      // For maximum speed during off-peak hours:
      env_turbo: {
        NODE_ENV: 'production',
        SYNC_PRODUCTION_MODE: 'true',
        SYNC_PRIORITY: 'high',     // Max speed sync
        SYNC_DEFER_ES: 'true',
      },
    }
  ]
};

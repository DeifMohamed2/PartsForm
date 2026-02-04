module.exports = {
  apps: [{
    name: 'partsform',
    script: 'app.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '14G', // More headroom for ultra-fast sync
    node_args: '--max-old-space-size=20480 --expose-gc', // 20GB heap for massive parallel sync
    env: {
      NODE_ENV: 'production',
      SYNC_PRIORITY: 'low',      // 20 parallel files, yields for website
      SYNC_DEFER_ES: 'true'      // Phase 1: MongoDB only, Phase 2: ES reindex
    },
    env_production: {
      NODE_ENV: 'production',
      SYNC_PRIORITY: 'low',
      SYNC_DEFER_ES: 'true'
    },
    // For maximum speed during off-peak hours:
    env_turbo: {
      NODE_ENV: 'production',
      SYNC_PRIORITY: 'high',     // 30 parallel files, no yields
      SYNC_DEFER_ES: 'true'
    }
  }]
};

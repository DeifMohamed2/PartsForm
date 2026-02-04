module.exports = {
  apps: [{
    name: 'partsform',
    script: 'app.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '12G', // Restart if memory exceeds 12GB
    node_args: '--max-old-space-size=16384 --expose-gc', // 16GB heap + expose GC for manual cleanup
    env: {
      NODE_ENV: 'production',
      SYNC_PRIORITY: 'low' // Keep website responsive during sync
    },
    env_production: {
      NODE_ENV: 'production',
      SYNC_PRIORITY: 'low'
    }
  }]
};

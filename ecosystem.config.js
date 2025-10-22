// PM2 Process Manager Configuration
// For production deployment with clustering and monitoring

module.exports = {
  apps: [
    {
      name: 'nexus-backend',
      script: './src/app.js',
      instances: process.env.PM2_INSTANCES || 'max',
      exec_mode: 'cluster',

      // Environment
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },

      // Logging
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Monitoring
      max_memory_restart: '500M',
      min_uptime: '10s',
      max_restarts: 10,
      autorestart: true,

      // Performance
      node_args: '--max-old-space-size=4096',

      // Advanced
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'uploads', 'quarantine'],

      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,

      // Restart cron (daily at 3 AM)
      cron_restart: '0 3 * * *',

      // Metrics
      instance_var: 'INSTANCE_ID',
    },
  ],

  // Deployment configuration
  deploy: {
    production: {
      user: 'deploy',
      host: ['production.server.com'],
      ref: 'origin/main',
      repo: 'git@github.com:yourorg/nexus-ui-backend.git',
      path: '/var/www/nexus-backend',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-deploy-local': 'echo "Deploying to production..."',
      env: {
        NODE_ENV: 'production',
      },
    },
    staging: {
      user: 'deploy',
      host: ['staging.server.com'],
      ref: 'origin/develop',
      repo: 'git@github.com:yourorg/nexus-ui-backend.git',
      path: '/var/www/nexus-backend-staging',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env staging',
      env: {
        NODE_ENV: 'staging',
      },
    },
  },
};

module.exports = {
  apps: [
    {
      name: 'teleweb-backend-dev',
      cwd: './backend',
      script: 'npm',
      args: 'run start:dev',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      log_file: '../logs/backend.log',
      error_file: '../logs/backend-error.log',
      out_file: '../logs/backend-out.log',
      max_memory_restart: '1G',
      restart_delay: 4000,
      watch: false,
      ignore_watch: [
        'node_modules',
        'logs',
        'uploads'
      ]
    },
    {
      name: 'teleweb-frontend-dev',
      cwd: './frontend',
      script: 'npm',
      args: 'run dev',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development'
      },
      log_file: '../logs/frontend.log',
      error_file: '../logs/frontend-error.log',
      out_file: '../logs/frontend-out.log',
      max_memory_restart: '512M',
      restart_delay: 4000,
      watch: false
    },
    {
      name: 'teleweb-bot-dev',
      cwd: './bot',
      script: 'npm',
      args: 'run dev',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development'
      },
      log_file: '../logs/bot.log',
      error_file: '../logs/bot-error.log',
      out_file: '../logs/bot-out.log',
      max_memory_restart: '512M',
      restart_delay: 4000,
      watch: false
    }
  ]
}; 
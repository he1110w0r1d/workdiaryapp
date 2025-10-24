module.exports = {
  apps: [
    {
      name: 'workdiary-backend',
      script: 'server.js',
      cwd: './workdiaryapp/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        PORTAL_VERIFY_URL: 'http://127.0.0.1:3001/api/sso/verify',
        PORTAL_JWT_SECRET: 'portal_sso_dev_secret'
      }
    },
    {
      name: 'workdiary-frontend',
      script: './frontend/start-server.js',
      cwd: './workdiaryapp',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      restart_delay: 5000,
      max_restarts: 5,
      min_uptime: '10s',
      env: {
        PORT: 3000,
        BROWSER: 'none',
        REACT_APP_BROWSER: 'none',
        // 让前端按当前站点自动选择后端主机，避免cookie域名不一致
      }
    }
  ]
};
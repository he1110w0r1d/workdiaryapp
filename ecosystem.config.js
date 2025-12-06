module.exports = {
  apps: [
    {
      name: 'workdiary-backend',
      script: 'server.js',
      cwd: './backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        MONGODB_URI: 'mongodb://localhost:27017/workdiary',
        JWT_SECRET: 'your-secret-key-here',
        ENCRYPTION_KEY: 'your-encryption-key-32-chars!!',
        SESSION_SECRET: 'your-session-secret-key-here',
        CORS_ORIGIN: 'http://localhost:13000',
        LLM_TYPE: 'external',
        PORTAL_VERIFY_URL: 'http://127.0.0.1:3001/api/sso/verify',
        PORTAL_JWT_SECRET: 'portal_sso_dev_secret',
        // DIFY_* 环境改由 backend/.env 管理，避免与 PM2 环境冲突
      }
    },
    {
      name: 'workdiary-frontend',
      script: 'start-server.js',
      cwd: './frontend',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      restart_delay: 5000,
      max_restarts: 5,
      min_uptime: '10s',
      env: {
        PORT: 13000,
        BROWSER: 'none',
        REACT_APP_BROWSER: 'none',
        // 让前端按当前站点自动选择后端主机，避免cookie域名不一致
      }
    }
  ]
};
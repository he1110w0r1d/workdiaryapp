# 工作日记应用

一个基于 React + Node.js + MongoDB 的工作日记管理系统，支持日记记录、智能总结和数据分析。

## 功能特性

- 📝 **日记管理**: 创建、编辑、删除工作日记
- 🤖 **智能总结**: 基于 LLM 的日记内容总结（支持本地和外部LLM）
- 📊 **数据分析**: 工作效率和趋势分析
- 🔐 **用户认证**: 安全的用户登录和权限管理
- 📱 **响应式设计**: 支持桌面和移动设备
- 🎯 **工作配置**: 个性化工作信息设置
- 📈 **数据可视化**: 工作时间统计和趋势图表

## Ubuntu 系统完整部署指南

### 系统要求

- Ubuntu 18.04+ (推荐 20.04 或 22.04)
- 至少 2GB RAM
- 至少 10GB 可用磁盘空间
- 稳定的网络连接

### 方式一：Docker 部署（强烈推荐）

#### 1. 安装 Docker 和 Docker Compose

```bash
# 更新系统包
sudo apt update && sudo apt upgrade -y

# 安装必要的依赖
sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release

# 添加 Docker 官方 GPG 密钥
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# 添加 Docker 仓库
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 将当前用户添加到 docker 组
sudo usermod -aG docker $USER

# 重新登录或运行以下命令使组权限生效
newgrp docker

# 验证安装
docker --version
docker-compose --version
```

#### 2. 克隆项目并部署

```bash
# 克隆项目
git clone https://github.com/he1110w0r1d/workdiaryapp.git
cd workdiaryapp

# 给部署脚本执行权限
chmod +x deploy.sh

# 运行部署脚本
./deploy.sh
```

#### 3. 手动 Docker 部署（如果脚本失败）

```bash
# 构建并启动所有服务
docker-compose up --build -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 方式二：本地开发部署

#### 1. 安装 Node.js 18+

```bash
# 使用 NodeSource 仓库安装最新 Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

#### 2. 安装 MongoDB 6.0+

```bash
# 导入 MongoDB 公钥
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# 添加 MongoDB 仓库
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# 安装 MongoDB
sudo apt update
sudo apt install -y mongodb-org

# 启动 MongoDB 服务
sudo systemctl start mongod
sudo systemctl enable mongod

# 验证安装
sudo systemctl status mongod
mongo --version
```

#### 3. 配置 MongoDB

```bash
# 连接到 MongoDB
mongo

# 在 MongoDB shell 中创建数据库和用户
use workdiary
db.createUser({
  user: "workdiaryuser",
  pwd: "password123",
  roles: [{ role: "readWrite", db: "workdiary" }]
})
exit
```

#### 4. 部署后端服务

```bash
# 进入后端目录
cd backend

# 安装依赖
npm install

# 创建环境变量文件
cat > .env << EOF
PORT=5000
MONGODB_URI=mongodb://workdiaryuser:password123@localhost:27017/workdiary
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=development

# LLM 配置
LLM_TYPE=external
EXTERNAL_LLM_PROVIDER=custom
EXTERNAL_LLM_MODEL=deepseek-ai/DeepSeek-V3
EXTERNAL_LLM_TIMEOUT=600000
EXTERNAL_LLM_TEMPERATURE=0.7
EXTERNAL_LLM_MAX_TOKENS=2000
EOF

# 启动后端服务
npm start

# 或者使用开发模式（自动重启）
npm run dev
```

#### 5. 部署前端服务

```bash
# 新开一个终端，进入前端目录
cd frontend

# 安装依赖
npm install

# 创建环境变量文件
cat > .env << EOF
REACT_APP_API_URL=http://localhost:5000
EOF

# 启动前端服务
npm start
```

### 方式三：生产环境部署

#### 1. 使用 PM2 管理进程

```bash
# 全局安装 PM2
sudo npm install -g pm2

# 在后端目录创建 PM2 配置文件
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'work-diary-backend',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    }
  }]
};
EOF

# 启动后端服务
pm2 start ecosystem.config.js

# 构建前端
cd ../frontend
npm run build

# 使用 serve 提供静态文件服务
sudo npm install -g serve
pm2 start serve --name "work-diary-frontend" -- -s build -l 3000

# 保存 PM2 配置
pm2 save
pm2 startup
```

#### 2. 配置 Nginx 反向代理

```bash
# 安装 Nginx
sudo apt install -y nginx

# 创建站点配置
sudo cat > /etc/nginx/sites-available/workdiary << EOF
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名

    # 前端静态文件
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # 后端 API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# 启用站点
sudo ln -s /etc/nginx/sites-available/workdiary /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## 访问地址

- **前端应用**: http://localhost:3000
- **后端 API**: http://localhost:5000
- **API 文档**: http://localhost:5000/api-docs

## 环境配置详解

### 后端环境变量配置

在 `backend` 目录下创建 `.env` 文件：

```env
# 基础服务配置
PORT=5000
NODE_ENV=development

# 数据库配置
MONGODB_URI=mongodb://workdiaryuser:password123@localhost:27017/workdiary

# JWT 安全配置
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# LLM 配置
LLM_TYPE=external  # local 或 external

# 本地 LLM 配置（如果使用 Ollama）
LOCAL_LLM_MODEL=qwen2.5:7b
LOCAL_LLM_URL=http://localhost:11434
LOCAL_LLM_TIMEOUT=30000
LOCAL_LLM_TEMPERATURE=0.7
LOCAL_LLM_MAX_TOKENS=2000

# 外部 LLM 配置（推荐使用）
EXTERNAL_LLM_PROVIDER=custom
EXTERNAL_LLM_API_KEY=your-api-key-here
EXTERNAL_LLM_API_URL=https://api.siliconflow.cn/v1
EXTERNAL_LLM_MODEL=deepseek-ai/DeepSeek-V3
EXTERNAL_LLM_TIMEOUT=600000
EXTERNAL_LLM_TEMPERATURE=0.7
EXTERNAL_LLM_MAX_TOKENS=2000

# 邮件配置（可选）
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### 前端环境变量配置

在 `frontend` 目录下创建 `.env` 文件：

```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_VERSION=1.0.0
```

## 故障排除

### 常见问题及解决方案

#### 1. Docker 相关问题

**问题**: `docker: permission denied`
```bash
# 解决方案：将用户添加到 docker 组
sudo usermod -aG docker $USER
newgrp docker
```

**问题**: `docker-compose: command not found`
```bash
# 解决方案：重新安装 docker-compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### 2. MongoDB 连接问题

**问题**: `MongoNetworkError: failed to connect to server`
```bash
# 检查 MongoDB 服务状态
sudo systemctl status mongod

# 启动 MongoDB 服务
sudo systemctl start mongod

# 检查端口是否被占用
sudo netstat -tlnp | grep :27017
```

#### 3. Node.js 依赖问题

**问题**: `npm install` 失败
```bash
# 清理 npm 缓存
npm cache clean --force

# 删除 node_modules 重新安装
rm -rf node_modules package-lock.json
npm install

# 如果仍然失败，尝试使用 yarn
npm install -g yarn
yarn install
```

#### 4. 端口占用问题

**问题**: `EADDRINUSE: address already in use`
```bash
# 查找占用端口的进程
sudo lsof -i :3000  # 前端端口
sudo lsof -i :5000  # 后端端口

# 杀死占用端口的进程
sudo kill -9 <PID>

# 或者修改端口配置
# 在 .env 文件中修改 PORT 变量
```

#### 5. LLM 配置问题

**问题**: LLM 服务无法连接
- 检查 API 密钥是否正确
- 确认网络连接正常
- 验证 API URL 是否可访问
- 检查超时时间设置

### 查看日志

```bash
# Docker 部署日志
docker-compose logs -f

# 单个服务日志
docker-compose logs -f backend
docker-compose logs -f frontend

# PM2 部署日志
pm2 logs
pm2 logs work-diary-backend

# 系统服务日志
sudo journalctl -u mongod -f
sudo journalctl -u nginx -f
```

## 性能优化建议

### 生产环境优化

1. **启用 Gzip 压缩**
```nginx
# 在 Nginx 配置中添加
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
```

2. **配置缓存策略**
```nginx
# 静态资源缓存
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

3. **数据库索引优化**
```javascript
// 在 MongoDB 中创建必要的索引
db.diaries.createIndex({ userId: 1, date: -1 })
db.users.createIndex({ email: 1 }, { unique: true })
```

## 项目结构

```
workdiary-app/
├── backend/                 # 后端服务
│   ├── controllers/         # 控制器层
│   │   ├── authController.js
│   │   ├── diaryController.js
│   │   ├── settingsController.js
│   │   └── summaryController.js
│   ├── models/             # 数据模型
│   │   ├── User.js
│   │   ├── Diary.js
│   │   └── Settings.js
│   ├── routes/             # 路由定义
│   │   ├── auth.js
│   │   ├── diaries.js
│   │   ├── settings.js
│   │   └── summary.js
│   ├── middleware/         # 中间件
│   │   ├── auth.js
│   │   └── errorHandler.js
│   ├── utils/              # 工具函数
│   │   ├── localLLM.js
│   │   ├── externalLLM.js
│   │   └── llmService.js
│   ├── config/             # 配置文件
│   │   └── database.js
│   ├── package.json
│   └── server.js           # 服务器入口
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── components/     # React 组件
│   │   │   ├── Auth/
│   │   │   ├── Diary/
│   │   │   ├── Settings/
│   │   │   └── Common/
│   │   ├── pages/          # 页面组件
│   │   │   ├── Login.js
│   │   │   ├── Dashboard.js
│   │   │   ├── DiaryList.js
│   │   │   └── Settings.js
│   │   ├── services/       # API 服务
│   │   │   └── api.js
│   │   ├── utils/          # 工具函数
│   │   │   └── helpers.js
│   │   ├── styles/         # 样式文件
│   │   ├── App.js          # 应用入口
│   │   └── index.js
│   ├── public/             # 静态资源
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml      # Docker 编排文件
├── deploy.sh              # 部署脚本
├── nginx.conf             # Nginx 配置
└── README.md              # 项目说明
```

## 技术栈

### 后端技术
- **框架**: Express.js 4.18+
- **数据库**: MongoDB 6.0+ with Mongoose ODM
- **认证**: JWT (JSON Web Tokens)
- **密码加密**: bcryptjs
- **文件上传**: multer
- **定时任务**: node-cron
- **邮件服务**: nodemailer
- **跨域处理**: CORS
- **环境变量**: dotenv
- **HTTP 客户端**: axios

### 前端技术
- **框架**: React 18.2+
- **UI 库**: Ant Design 5.x
- **HTTP 客户端**: Axios
- **图表库**: Recharts
- **路由**: React Router DOM 6.x
- **状态管理**: React Hooks
- **样式**: CSS Modules + Ant Design

### 开发工具
- **容器化**: Docker + Docker Compose
- **反向代理**: Nginx
- **进程管理**: PM2
- **代码规范**: ESLint + Prettier
- **版本控制**: Git

### AI/LLM 集成
- **本地 LLM**: Ollama 支持
- **外部 LLM**: OpenAI、SiliconFlow、DeepSeek 等
- **模型支持**: GPT、Qwen、DeepSeek-V3 等

## 开发指南

### API 接口文档

#### 用户认证模块
```
POST /api/auth/register     # 用户注册
POST /api/auth/login        # 用户登录
POST /api/auth/logout       # 用户登出
GET  /api/auth/profile      # 获取用户信息
PUT  /api/auth/profile      # 更新用户信息
```

#### 日记管理模块
```
GET    /api/diaries         # 获取日记列表（支持分页、筛选）
POST   /api/diaries         # 创建新日记
GET    /api/diaries/:id     # 获取单个日记详情
PUT    /api/diaries/:id     # 更新日记内容
DELETE /api/diaries/:id     # 删除日记
GET    /api/diaries/search  # 搜索日记内容
```

#### 智能总结模块
```
POST /api/summary/weekly    # 生成周总结
POST /api/summary/monthly   # 生成月总结
POST /api/summary/yearly    # 生成年总结
GET  /api/summary/history   # 获取总结历史
GET  /api/summary/:id       # 获取特定总结
```

#### 系统设置模块
```
GET  /api/settings          # 获取系统设置
PUT  /api/settings          # 更新系统设置
POST /api/settings/llm/test # 测试 LLM 连接
GET  /api/settings/llm      # 获取 LLM 配置
```

#### 数据统计模块
```
GET /api/stats/overview     # 获取数据概览
GET /api/stats/timeline     # 获取时间线统计
GET /api/stats/wordcloud    # 获取词云数据
```

### 代码规范

#### 代码风格
- 使用 ESLint 进行代码检查
- 遵循 Airbnb JavaScript 风格指南
- 使用 Prettier 进行代码格式化
- 提交前运行测试和代码检查

#### Git 提交规范
```
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建过程或辅助工具的变动
```

#### 分支管理
- `master`: 主分支，用于生产环境
- `develop`: 开发分支
- `feature/*`: 功能分支
- `hotfix/*`: 紧急修复分支

## 安全最佳实践

### 生产环境安全配置

1. **环境变量安全**
```bash
# 生成强密码
openssl rand -base64 32

# 设置安全的 JWT 密钥
JWT_SECRET=$(openssl rand -base64 64)
```

2. **数据库安全**
```bash
# 创建专用数据库用户
mongo
use admin
db.createUser({
  user: "workdiaryuser",
  pwd: "$(openssl rand -base64 32)",
  roles: [{ role: "readWrite", db: "workdiary" }]
})
```

3. **Nginx 安全配置**
```nginx
# 隐藏 Nginx 版本
server_tokens off;

# 添加安全头
add_header X-Frame-Options DENY;
add_header X-Content-Type-Options nosniff;
add_header X-XSS-Protection "1; mode=block";
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
```

4. **防火墙配置**
```bash
# 配置 UFW 防火墙
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 27017  # 禁止外部访问 MongoDB
```

## 部署说明

详细的部署指南请参考 [DEPLOYMENT.md](./DEPLOYMENT.md)

### 生产环境注意事项

1. **安全配置**:
   - 修改默认密码和密钥
   - 配置 HTTPS 证书
   - 设置防火墙规则
   - 定期更新依赖包

2. **性能优化**:
   - 启用 Gzip 压缩
   - 配置 CDN
   - 数据库索引优化
   - 监控资源使用

3. **监控和日志**:
   - 配置日志收集
   - 设置健康检查
   - 监控资源使用
   - 配置告警机制

## 监控和维护

### 系统监控

```bash
# 查看系统资源使用情况
top
htop
df -h
free -h

# 查看 Docker 容器状态
docker ps
docker stats

# 查看服务状态
sudo systemctl status mongod
sudo systemctl status nginx
```

### 数据备份

```bash
# MongoDB 数据备份
mongodump --uri="mongodb://workdiaryuser:password123@localhost:27017/workdiary" --out=/backup/$(date +%Y%m%d)

# 恢复数据
mongorestore --uri="mongodb://workdiaryuser:password123@localhost:27017/workdiary" /backup/20231201/workdiary

# 自动备份脚本
cat > /usr/local/bin/backup-workdiary.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backup/workdiary"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
mongodump --uri="mongodb://workdiaryuser:password123@localhost:27017/workdiary" --out="$BACKUP_DIR/$DATE"
find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} +
EOF

chmod +x /usr/local/bin/backup-workdiary.sh

# 添加到定时任务
echo "0 2 * * * /usr/local/bin/backup-workdiary.sh" | crontab -
```

## 更新和升级

### 应用更新

```bash
# Docker 部署更新
git pull origin master
docker-compose down
docker-compose up --build -d

# 本地部署更新
git pull origin master
cd backend && npm install
cd ../frontend && npm install && npm run build
pm2 restart all
```

### 数据库迁移

```bash
# 如果有数据库结构变更，运行迁移脚本
node backend/scripts/migrate.js
```

### 日志管理

```bash
# 配置日志轮转
sudo cat > /etc/logrotate.d/workdiary << EOF
/var/log/workdiary/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload nginx
    endscript
}
EOF
```

## 常见使用场景

### 1. 个人工作日记
- 记录每日工作内容和进展
- 生成周报、月报
- 分析工作效率和时间分配

### 2. 团队协作
- 团队成员分享工作进展
- 项目进度跟踪
- 知识积累和经验分享

### 3. 项目管理
- 项目里程碑记录
- 问题和解决方案追踪
- 项目复盘和总结

## 扩展功能

### 计划中的功能
- [ ] 移动端 APP
- [ ] 多语言支持
- [ ] 团队协作功能
- [ ] 数据导出功能
- [ ] 更多图表类型
- [ ] 语音输入支持
- [ ] 智能标签推荐

### 插件系统
项目支持插件扩展，您可以开发自定义插件来扩展功能。

## 贡献指南

我们欢迎所有形式的贡献！

### 如何贡献

1. **Fork 项目**
   ```bash
   git clone https://github.com/he1110w0r1d/workdiaryapp.git
   cd workdiaryapp
   ```

2. **创建功能分支**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **进行开发**
   - 遵循代码规范
   - 添加必要的测试
   - 更新相关文档

4. **提交更改**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

5. **推送分支**
   ```bash
   git push origin feature/amazing-feature
   ```

6. **创建 Pull Request**
   - 详细描述您的更改
   - 包含相关的 issue 编号
   - 确保所有检查通过

### 贡献类型

- 🐛 **Bug 修复**: 修复现有功能的问题
- ✨ **新功能**: 添加新的功能特性
- 📚 **文档**: 改进文档和示例
- 🎨 **UI/UX**: 改进用户界面和体验
- ⚡ **性能**: 提升应用性能
- 🔧 **工具**: 改进开发工具和流程

### 代码审查

所有的 Pull Request 都会经过代码审查，请确保：
- 代码符合项目规范
- 包含适当的测试
- 文档已更新
- 没有破坏现有功能

## 社区和支持

### 获取帮助

如果您遇到问题或需要帮助，可以通过以下方式：

1. **查看文档**: 首先查看本 README 和相关文档
2. **搜索 Issues**: 在 GitHub Issues 中搜索类似问题
3. **提交 Issue**: 如果没有找到解决方案，请提交新的 Issue
4. **讨论区**: 参与 GitHub Discussions 讨论

### Issue 提交指南

提交 Issue 时，请包含以下信息：
- 问题的详细描述
- 重现步骤
- 期望的行为
- 实际的行为
- 环境信息（操作系统、浏览器、版本等）
- 相关的错误日志或截图

### 功能请求

我们欢迎功能请求！请在提交时说明：
- 功能的详细描述
- 使用场景和价值
- 可能的实现方案
- 是否愿意参与开发

## 许可证

本项目采用 MIT 许可证。这意味着您可以：

- ✅ 商业使用
- ✅ 修改代码
- ✅ 分发代码
- ✅ 私人使用

但需要：
- 📄 包含许可证和版权声明
- 📄 包含原作者信息

详细信息请查看 [LICENSE](LICENSE) 文件。

## 致谢

感谢所有为这个项目做出贡献的开发者和用户！

特别感谢以下开源项目：
- [React](https://reactjs.org/) - 前端框架
- [Express.js](https://expressjs.com/) - 后端框架
- [MongoDB](https://www.mongodb.com/) - 数据库
- [Ant Design](https://ant.design/) - UI 组件库
- [Docker](https://www.docker.com/) - 容器化平台

## 版本历史

### v1.0.0 (2024-01-01)
- ✨ 初始版本发布
- 📝 基础日记管理功能
- 🤖 LLM 智能总结功能
- 📊 数据统计和可视化
- 🔐 用户认证和权限管理

### 未来版本计划
- v1.1.0: 移动端支持
- v1.2.0: 团队协作功能
- v2.0.0: 重构和性能优化

---

## 联系我们

- **项目主页**: https://github.com/he1110w0r1d/workdiaryapp
- **问题反馈**: https://github.com/he1110w0r1d/workdiaryapp/issues
- **功能建议**: https://github.com/he1110w0r1d/workdiaryapp/discussions

---

**感谢使用工作日记应用！** 🎉

如果这个项目对您有帮助，请考虑给我们一个 ⭐ Star，这将是对我们最大的鼓励！

---

**注意**: 在生产环境中使用前，请务必修改所有默认密码和密钥！
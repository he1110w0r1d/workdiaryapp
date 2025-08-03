# 工作日记应用

一个基于 React + Node.js + MongoDB 的工作日记管理系统，支持日记记录、智能总结和数据分析。

## 功能特性

- 📝 **日记管理**: 创建、编辑、删除工作日记
- 🤖 **智能总结**: 基于 LLM 的日记内容总结
- 📊 **数据分析**: 工作效率和趋势分析
- 🔐 **用户认证**: 安全的用户登录和权限管理
- 📱 **响应式设计**: 支持桌面和移动设备

## 快速开始

### 环境要求

- Node.js 16+
- MongoDB 4.4+
- Docker & Docker Compose (推荐)

### 方式一：Docker 部署（推荐）

1. **克隆项目**
```bash
git clone https://github.com/he1110w0r1d/workdiaryapp.git
cd workdiaryapp
```

2. **配置环境变量**
```bash
# 复制环境变量模板
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 编辑配置文件（重要：修改密钥和密码）
# backend/.env - 修改 JWT_SECRET, MONGODB_URI 等
# frontend/.env - 修改 REACT_APP_API_URL 等
```

3. **启动服务**
```bash
# Linux/macOS
./deploy.sh

# Windows
deploy.bat

# 或手动启动
docker-compose up --build -d
```

4. **访问应用**
- 前端: http://localhost:3000
- 后端API: http://localhost:5000

### 方式二：本地开发

1. **安装依赖**
```bash
# 后端
cd backend
npm install

# 前端
cd ../frontend
npm install
```

2. **启动MongoDB**
```bash
# 确保MongoDB服务运行在 localhost:27017
mongod
```

3. **配置环境变量**
```bash
# backend/.env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/workdiary
JWT_SECRET=your-secret-key
NODE_ENV=development

# frontend/.env
REACT_APP_API_URL=http://localhost:5000
```

4. **启动服务**
```bash
# 启动后端 (在 backend 目录)
npm start

# 启动前端 (在 frontend 目录)
npm start
```

## 环境配置

### 后端配置 (backend/.env)

```env
# 服务器配置
PORT=5000
NODE_ENV=production

# 数据库配置
MONGODB_URI=mongodb://admin:password@mongodb:27017/workdiary?authSource=admin

# 安全配置
JWT_SECRET=your-super-secure-jwt-secret
SESSION_SECRET=your-super-secure-session-secret
ENCRYPTION_KEY=your-encryption-key-32-chars!!

# LLM配置（可选）
USE_LOCAL_LLM=false
LOCAL_LLM_API_URL=http://localhost:11434/api/generate
LOCAL_LLM_MODEL=llama3
```

### 前端配置 (frontend/.env)

```env
# API配置
REACT_APP_API_URL=http://localhost:5000

# 网络配置
HOST=0.0.0.0
PORT=3000

# 天气API（可选）
REACT_APP_QWEATHER_KEY=your-qweather-api-key
REACT_APP_USE_MOCK_WEATHER=true
```

## 数据备份与恢复

### 备份数据
```bash
cd backend
node backup-script.js
```

### 恢复数据
```bash
cd backend
node restore-script.js
```

备份文件位于 `backend/backup/` 目录。

## 项目结构

```
workdiaryapp/
├── backend/                 # 后端服务
│   ├── controllers/         # 控制器
│   ├── models/             # 数据模型
│   ├── routes/             # 路由
│   ├── backup/             # 数据备份
│   └── uploads/            # 文件上传
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── components/     # React组件
│   │   ├── routes/         # 路由配置
│   │   └── services/       # API服务
├── docker-compose.yml      # Docker配置
├── deploy.sh              # Linux/macOS部署脚本
└── deploy.bat             # Windows部署脚本
```

## 常见问题

### 端口冲突
如果端口被占用，修改环境变量中的端口配置。

### MongoDB连接失败
确保MongoDB服务正在运行，检查连接字符串是否正确。

### Docker启动失败
检查Docker服务是否运行，确保有足够的磁盘空间。

## 部署文档

详细的部署和配置说明请参考：
- [部署指南](DEPLOYMENT.md)
- [环境配置](ENV_SETUP.md)
- [网络安全](NETWORK_SECURITY.md)

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 联系方式

- 项目主页: https://github.com/he1110w0r1d/workdiaryapp
- 问题反馈: https://github.com/he1110w0r1d/workdiaryapp/issues

---

**注意**: 生产环境部署前请务必修改所有默认密码和密钥！
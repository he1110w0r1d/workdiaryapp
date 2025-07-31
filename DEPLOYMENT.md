# 工作日记应用部署指南

本文档提供了工作日记应用的完整部署指南，包括本地部署、生产环境部署和故障排除。

## 目录

- [系统要求](#系统要求)
- [快速部署](#快速部署)
- [详细部署步骤](#详细部署步骤)
- [配置说明](#配置说明)
- [生产环境部署](#生产环境部署)
- [故障排除](#故障排除)
- [维护和监控](#维护和监控)

## 系统要求

### 最低要求
- **操作系统**: Linux, macOS, Windows 10/11
- **内存**: 4GB RAM
- **存储**: 10GB 可用空间
- **网络**: 互联网连接（用于下载依赖）

### 软件依赖
- **Docker**: 20.10+ 
- **Docker Compose**: 2.0+
- **Git**: 2.0+（可选，用于代码管理）

## 快速部署

### Windows 用户
```bash
# 1. 进入项目目录
cd work-diary-app

# 2. 运行部署脚本
.\deploy.bat
```

### Linux/macOS 用户
```bash
# 1. 进入项目目录
cd work-diary-app

# 2. 给脚本执行权限
chmod +x deploy.sh

# 3. 运行部署脚本
./deploy.sh
```

### 手动部署
```bash
# 1. 构建并启动所有服务
docker-compose up --build -d

# 2. 查看服务状态
docker-compose ps

# 3. 查看日志
docker-compose logs -f
```

## 详细部署步骤

### 1. 环境准备

#### 安装 Docker

**Windows:**
1. 下载并安装 [Docker Desktop](https://www.docker.com/products/docker-desktop)
2. 启动 Docker Desktop
3. 确保 WSL2 已启用（Windows 11 推荐）

**Linux (Ubuntu/Debian):**
```bash
# 更新包索引
sudo apt update

# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 启动 Docker 服务
sudo systemctl start docker
sudo systemctl enable docker

# 将用户添加到 docker 组
sudo usermod -aG docker $USER
```

**macOS:**
```bash
# 使用 Homebrew 安装
brew install --cask docker

# 或下载 Docker Desktop for Mac
```

#### 安装 Docker Compose
```bash
# Linux
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker-compose --version
```

### 2. 项目配置

#### 修改环境变量

**后端配置 (.env.production):**
```env
# 重要：修改以下密钥为安全的随机字符串
JWT_SECRET=your-super-secure-jwt-secret-key-here
SESSION_SECRET=your-super-secure-session-secret-key-here
MONGODB_URI=mongodb://admin:your-secure-password@mongodb:27017/workdiary?authSource=admin

# 生产环境设置
NODE_ENV=production
CORS_ORIGIN=http://your-domain.com
```

**前端配置 (.env.production):**
```env
# 修改为实际的 API 地址
REACT_APP_API_URL=http://your-domain.com/api
# 或者使用 IP 地址
# REACT_APP_API_URL=http://192.168.1.100:5000
```

#### 修改数据库密码

编辑 `docker-compose.yml` 文件：
```yaml
services:
  mongodb:
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: your-secure-database-password  # 修改此处
```

### 3. 启动服务

```bash
# 构建并启动所有服务
docker-compose up --build -d

# 查看启动状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

### 4. 验证部署

访问以下地址验证服务：

- **前端应用**: http://localhost:3000
- **后端 API**: http://localhost:5000/api/health
- **Nginx 代理**: http://localhost:80

## 配置说明

### 服务架构

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx (80)    │────│  Frontend (3000) │    │  Backend (5000) │
│   反向代理       │    │   React 应用     │────│   Node.js API  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                               ┌─────────────────┐
                                               │ MongoDB (27017) │
                                               │     数据库      │
                                               └─────────────────┘
```

### 端口映射

| 服务 | 内部端口 | 外部端口 | 说明 |
|------|----------|----------|------|
| Nginx | 80 | 80 | 主入口，反向代理 |
| Frontend | 3000 | 3000 | React 开发服务器 |
| Backend | 5000 | 5000 | Node.js API 服务 |
| MongoDB | 27017 | 27017 | 数据库服务 |

### 数据持久化

- **MongoDB 数据**: 存储在 Docker volume `mongodb_data` 中
- **上传文件**: 映射到 `./backend/uploads` 目录

## 生产环境部署

### 1. 服务器要求

**推荐配置:**
- **CPU**: 2 核心以上
- **内存**: 8GB RAM
- **存储**: 50GB SSD
- **网络**: 100Mbps 带宽

### 2. 安全配置

#### 防火墙设置
```bash
# Ubuntu/Debian
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable

# CentOS/RHEL
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

#### SSL 证书配置

1. **获取 SSL 证书**（使用 Let's Encrypt）:
```bash
# 安装 Certbot
sudo apt install certbot

# 获取证书
sudo certbot certonly --standalone -d your-domain.com
```

2. **配置 Nginx HTTPS**:
取消注释 `nginx.conf` 中的 HTTPS 配置部分，并修改域名。

### 3. 域名配置

1. **DNS 设置**: 将域名 A 记录指向服务器 IP
2. **修改配置文件**:
   - `nginx.conf`: 更新 `server_name`
   - `.env.production`: 更新 `REACT_APP_API_URL`

### 4. 性能优化

#### Docker 资源限制
```yaml
# 在 docker-compose.yml 中添加资源限制
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
        reservations:
          memory: 512M
          cpus: '0.25'
```

#### 数据库优化
```yaml
# MongoDB 配置优化
mongodb:
  command: mongod --wiredTigerCacheSizeGB 1.5
```

## 故障排除

### 常见问题

#### 1. 容器启动失败

**问题**: 容器无法启动
```bash
# 查看详细错误信息
docker-compose logs [service-name]

# 检查容器状态
docker-compose ps

# 重新构建容器
docker-compose up --build --force-recreate
```

#### 2. 数据库连接失败

**问题**: 后端无法连接数据库
```bash
# 检查 MongoDB 容器状态
docker-compose logs mongodb

# 进入 MongoDB 容器
docker-compose exec mongodb mongo

# 测试连接
use workdiary
show collections
```

#### 3. 前端无法访问后端

**问题**: API 请求失败
```bash
# 检查网络连接
docker network ls
docker network inspect work-diary-app_work-diary-network

# 测试后端 API
curl http://localhost:5000/api/health
```

#### 4. 端口冲突

**问题**: 端口已被占用
```bash
# Windows
netstat -ano | findstr :3000

# Linux/macOS
lsof -i :3000

# 修改 docker-compose.yml 中的端口映射
ports:
  - "3001:3000"  # 使用不同的外部端口
```

### 日志查看

```bash
# 查看所有服务日志
docker-compose logs

# 查看特定服务日志
docker-compose logs backend
docker-compose logs frontend
docker-compose logs mongodb

# 实时查看日志
docker-compose logs -f

# 查看最近的日志
docker-compose logs --tail=50
```

### 数据备份与恢复

#### 备份数据库
```bash
# 创建备份
docker-compose exec mongodb mongodump --db workdiary --out /data/backup

# 复制备份文件到主机
docker cp work-diary-mongodb:/data/backup ./backup
```

#### 恢复数据库
```bash
# 复制备份文件到容器
docker cp ./backup work-diary-mongodb:/data/backup

# 恢复数据库
docker-compose exec mongodb mongorestore --db workdiary /data/backup/workdiary
```

## 维护和监控

### 定期维护

#### 1. 更新镜像
```bash
# 拉取最新镜像
docker-compose pull

# 重新构建并启动
docker-compose up --build -d
```

#### 2. 清理资源
```bash
# 清理未使用的镜像
docker image prune -f

# 清理未使用的容器
docker container prune -f

# 清理未使用的网络
docker network prune -f

# 清理未使用的卷（谨慎使用）
docker volume prune -f
```

#### 3. 监控资源使用
```bash
# 查看容器资源使用情况
docker stats

# 查看磁盘使用情况
docker system df
```

### 健康检查

在 `docker-compose.yml` 中添加健康检查：
```yaml
services:
  backend:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### 自动化部署

#### 使用 GitHub Actions
创建 `.github/workflows/deploy.yml`：
```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    
    - name: Deploy to server
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.HOST }}
        username: ${{ secrets.USERNAME }}
        key: ${{ secrets.KEY }}
        script: |
          cd /path/to/work-diary-app
          git pull origin main
          docker-compose up --build -d
```

## 支持和帮助

如果遇到问题，请检查：

1. **系统要求**: 确保满足最低系统要求
2. **网络连接**: 确保可以访问 Docker Hub
3. **端口占用**: 确保所需端口未被占用
4. **权限问题**: 确保有足够的权限运行 Docker
5. **日志信息**: 查看详细的错误日志

更多帮助请参考：
- [Docker 官方文档](https://docs.docker.com/)
- [Docker Compose 文档](https://docs.docker.com/compose/)
- [Node.js 部署指南](https://nodejs.org/en/docs/guides/)
- [React 部署指南](https://create-react-app.dev/docs/deployment/)

---

**注意**: 在生产环境中，请务必修改所有默认密码和密钥，并定期更新系统和依赖包。
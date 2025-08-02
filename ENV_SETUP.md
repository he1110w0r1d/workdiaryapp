# 环境变量配置指南

本项目使用环境变量来管理不同环境下的配置。为了安全起见，实际的 `.env` 文件不会上传到 Git 仓库中。

## 快速开始

### 1. 复制示例文件

```bash
# 后端环境变量
cp backend/.env.example backend/.env

# 前端环境变量
cp frontend/.env.example frontend/.env
```

### 2. 修改配置

#### 后端配置 (backend/.env)

**必须修改的配置项：**
- `JWT_SECRET`: JWT令牌密钥，请使用安全的随机字符串
- `SESSION_SECRET`: 会话密钥，请使用安全的随机字符串
- `MONGODB_URI`: 数据库连接字符串（根据部署环境调整）

**可选配置项：**
- `USE_LOCAL_LLM`: 是否使用本地LLM服务
- `LOCAL_LLM_*`: 本地LLM相关配置

#### 前端配置 (frontend/.env)

**必须修改的配置项：**
- `REACT_APP_API_URL`: 后端API地址
- `HOST`: 前端服务绑定的主机地址

**可选配置项：**
- `REACT_APP_QWEATHER_KEY`: 和风天气API密钥
- `REACT_APP_OPENWEATHER_KEY`: OpenWeatherMap API密钥
- `REACT_APP_USE_MOCK_WEATHER`: 是否使用模拟天气数据

## 不同环境的配置示例

### 开发环境

**后端 (.env):**
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/workdiary
JWT_SECRET=dev-jwt-secret-key
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

**前端 (.env):**
```env
REACT_APP_API_URL=http://localhost:5000/api
HOST=localhost
PORT=3000
```

### 生产环境

**后端 (.env):**
```env
PORT=5000
MONGODB_URI=mongodb://admin:secure-password@mongodb:27017/workdiary?authSource=admin
JWT_SECRET=super-secure-jwt-secret-key
SESSION_SECRET=super-secure-session-secret-key
NODE_ENV=production
CORS_ORIGIN=http://your-domain.com
```

**前端 (.env):**
```env
REACT_APP_API_URL=http://your-domain.com/api
HOST=0.0.0.0
PORT=3000
```

### 局域网部署

**后端 (.env):**
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/workdiary
JWT_SECRET=your-secure-jwt-secret
NODE_ENV=production
CORS_ORIGIN=http://192.168.1.100:3000
```

**前端 (.env):**
```env
REACT_APP_API_URL=http://192.168.1.100:5000/api
HOST=192.168.1.100
PORT=3000
```

## 安全注意事项

1. **永远不要将包含真实密钥的 `.env` 文件提交到 Git 仓库**
2. **使用强密码和随机字符串作为密钥**
3. **定期更换生产环境的密钥**
4. **不要在代码中硬编码敏感信息**

## 生成安全密钥

可以使用以下方法生成安全的随机密钥：

```bash
# 使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 使用 OpenSSL
openssl rand -hex 32

# 使用 Python
python -c "import secrets; print(secrets.token_hex(32))"
```

## 故障排除

### 常见问题

1. **服务无法启动**: 检查 `.env` 文件是否存在且配置正确
2. **数据库连接失败**: 检查 `MONGODB_URI` 配置
3. **前端无法访问后端**: 检查 `REACT_APP_API_URL` 和 `CORS_ORIGIN` 配置
4. **跨域问题**: 确保 `CORS_ORIGIN` 与前端访问地址一致

### 验证配置

```bash
# 检查后端配置
cd backend && node -e "require('dotenv').config(); console.log(process.env.JWT_SECRET ? '✓ JWT_SECRET configured' : '✗ JWT_SECRET missing')"

# 检查前端配置
cd frontend && node -e "require('dotenv').config(); console.log(process.env.REACT_APP_API_URL ? '✓ API_URL configured' : '✗ API_URL missing')"
```
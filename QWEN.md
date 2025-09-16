# 工作日记应用 - 项目上下文

## 项目概述

这是一个使用React（前端）+ Node.js/Express（后端）+ MongoDB（数据库）构建的工作日记管理系统。该应用支持日记记录、基于LLM的智能总结和数据分析功能。

### 核心功能
- 日记管理：创建、编辑、删除工作日记
- 智能总结：基于LLM的内容总结
- 数据分析：工作效率和趋势分析
- 用户认证：安全的登录和访问控制
- 响应式设计：支持桌面和移动设备
- 标签系统：使用自定义标签分类工作条目
- 待办集成：将日记条目与待办事项关联
- 数据备份/恢复：导出和导入功能

## 技术栈

### 后端
- Node.js with Express.js
- MongoDB with Mongoose ODM
- JSON Web Tokens (JWT) 用于认证
- Docker 用于容器化
- RESTful API 架构

### 前端
- React with React Router
- Ant Design UI 组件
- Recharts 用于数据可视化
- Styled Components 用于样式

### 基础设施
- Docker & Docker Compose (推荐部署)
- Nginx 作为反向代理
- MongoDB 数据库

## 项目结构

```
workdiaryapp/
├── backend/                 # 后端服务
│   ├── controllers/        # 请求处理器
│   ├── models/            # 数据库模型
│   ├── routes/            # API 路由
│   ├── middleware/        # 自定义中间件
│   ├── utils/             # 工具函数
│   ├── backup/            # 数据备份
│   └── uploads/           # 文件上传
├── frontend/              # 前端应用
│   ├── src/
│   │   ├── components/    # React 组件
│   │   ├── routes/        # 路由配置
│   │   └── services/      # API 服务
├── deploy.sh              # Linux/macOS 部署脚本
└── deploy.bat             # Windows 部署脚本
```

## 开发环境设置

### 前置要求
- Node.js 16+
- MongoDB 4.4+
- Docker & Docker Compose (推荐)

### 快速开始 - Docker 部署 (推荐)

1. 复制环境配置文件:
   ```bash
   # 后端
   cp backend/.env.example backend/.env
   
   # 前端
   cp frontend/.env.example frontend/.env
   ```

2. 修改配置文件:
   - `backend/.env` - 更新 JWT_SECRET, MONGODB_URI 和其他敏感值
   - `frontend/.env` - 更新 REACT_APP_API_URL 以匹配后端地址

3. 运行部署脚本:
   ```bash
   # Linux/macOS
   ./deploy.sh
   
   # Windows
   deploy.bat
   ```

4. 访问应用:
   - 前端: http://localhost:3000
   - 后端 API: http://localhost:5000

### 本地开发设置

1. 安装依赖:
   ```bash
   # 后端
   cd backend
   npm install
   
   # 前端
   cd ../frontend
   npm install
   ```

2. 启动 MongoDB 服务在 localhost:27017

3. 配置环境变量:
   - `backend/.env` 配置数据库连接和密钥
   - `frontend/.env` 配置 API URL

4. 启动服务:
   ```bash
   # 后端 (在 backend 目录)
   npm start
   
   # 前端 (在 frontend 目录)
   npm start
   ```

## 环境配置

### 后端 (.env)
```env
# 服务器配置
PORT=5000
NODE_ENV=production

# 数据库配置
MONGODB_URI=mongodb://admin:password@mongodb:27017/workdiary?authSource=admin

# 安全配置
JWT_SECRET=your-super-secure-jwt-secret
SESSION_SECRET=your-super-secure-session-secret

# LLM 配置 (可选)
USE_LOCAL_LLM=false
LOCAL_LLM_API_URL=http://localhost:11434/api/generate
LOCAL_LLM_MODEL=llama3
```

### 前端 (.env)
```env
# API 配置
REACT_APP_API_URL=http://localhost:5000

# 网络配置
HOST=0.0.0.0
PORT=3000
```

## 构建和运行

### 开发命令

后端:
```bash
# 启动开发服务器并自动重载
npm run dev

# 启动生产服务器
npm start
```

前端:
```bash
# 启动开发服务器
npm start

# 构建生产版本
npm run build

# 运行测试
npm test
```

### 生产部署

1. 构建 Docker 镜像:
   ```bash
   # 构建后端
   cd backend
   docker build -t work-diary-backend .
   
   # 构建前端
   cd ../frontend
   docker build -t work-diary-frontend .
   ```

2. 或使用部署脚本:
   ```bash
   # Linux/macOS
   ./deploy.sh
   
   # Windows
   deploy.bat
   ```

## API 接口

### 认证
- POST `/api/users/register` - 用户注册
- POST `/api/users/login` - 用户登录
- GET `/api/users/profile` - 获取用户资料
- PUT `/api/users/profile` - 更新用户资料

### 日记
- POST `/api/diaries` - 创建日记
- GET `/api/diaries` - 获取日记 (支持过滤)
- GET `/api/diaries/:id` - 获取特定日记
- PUT `/api/diaries/:id` - 更新日记
- DELETE `/api/diaries/:id` - 删除日记

### 总结
- GET `/api/summaries` - 获取总结
- POST `/api/summaries/generate` - 生成新总结

### 设置
- GET `/api/settings/llm` - 获取 LLM 设置
- PUT `/api/settings/llm` - 更新 LLM 设置

## 数据模型

### 日记
- user: ObjectId (引用 User)
- content: String (必需)
- location: String
- startTime: Date (必需)
- endTime: Date (必需)
- tags: [String]
- workPriority: Enum ['高', '中', '低']
- isTodo: Boolean
- todoStatus: Enum ['待办', '已完成', '已放弃', '已转交']
- relatedTodo: ObjectId (引用 Todo)
- isDeleted: Boolean
- deletedAt: Date

### 总结
- user: ObjectId (引用 User)
- type: Enum ['daily', 'weekly', 'monthly', 'yearly']
- date: Date
- content: String
- statistics: Object
- htmlFilePath: String
- isRead: Boolean
- readAt: Date

## 开发规范

### 代码风格
- 后端: 标准 JavaScript with Express 模式
- 前端: React 函数组件和 hooks
- 样式: Ant Design 组件 with 自定义主题
- API: RESTful 约定 with JSON 响应

### 测试
- 后端: API 端点的集成测试
- 前端: 使用 Jest/React Testing Library 的组件测试

### Git 工作流
- 功能分支用于新功能开发
- Pull requests 用于代码审查
- 语义化版本控制用于发布

## 安全考虑

- IP 访问限制为 192.168.1.x 局域网 (可配置)
- 基于 JWT 的认证
- 环境变量存储敏感配置
- CORS 配置用于 API 访问控制
- 输入验证和清理

## 常见任务

### 添加新功能
1. 在 `backend/routes/` 创建新路由
2. 在 `backend/controllers/` 实现控制器
3. 如需要在 `backend/models/` 添加模型
4. 在 `frontend/src/components/` 创建前端组件
5. 在 `frontend/src/App.js` 添加路由

### 数据备份
```bash
# 使用备份脚本
cd backend
node backup-script.js
```

### 更新依赖
```bash
# 后端
cd backend
npm update

# 前端
cd ../frontend
npm update
```

## 故障排除

### 常见问题
1. 数据库连接失败 - 检查 MONGODB_URI 配置
2. 端口冲突 - 修改 .env 文件中的 PORT
3. CORS 错误 - 验证 CORS_ORIGIN 设置
4. 认证失败 - 检查 JWT_SECRET 配置

### 查看日志
```bash
# Docker 日志
docker-compose logs [service-name]

# 直接日志 (如果不使用 Docker 运行)
# 检查控制台输出或 backend/utils/ 中的日志文件
```

## 部署信息

### 生产考虑
- 更改所有默认密码和密钥
- 配置 SSL 证书用于 HTTPS
- 设置防火墙规则
- 定期数据库备份
- 监控资源使用情况
- 定期更新依赖

### 扩展选项
- 使用负载均衡器进行水平扩展
- 数据库复制实现高可用性
- CDN 用于静态资源
- 缓存层提高性能
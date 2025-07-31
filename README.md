# 工作日记应用

一个基于 React + Node.js + MongoDB 的工作日记管理系统，支持日记记录、智能总结和数据分析。

## 功能特性

- 📝 **日记管理**: 创建、编辑、删除工作日记
- 🤖 **智能总结**: 基于 LLM 的日记内容总结
- 📊 **数据分析**: 工作效率和趋势分析
- 🔐 **用户认证**: 安全的用户登录和权限管理
- 📱 **响应式设计**: 支持桌面和移动设备

## 快速开始

### 方式一：Docker 部署（推荐）

#### 生产环境部署
```bash
# Windows 用户
.\deploy.bat

# Linux/macOS 用户
chmod +x deploy.sh
./deploy.sh
```

#### 开发环境部署
```bash
# 启动开发环境
docker-compose -f docker-compose.dev.yml up --build
```

### 方式二：本地开发

#### 前置要求
- Node.js 18+
- MongoDB 6.0+
- npm 或 yarn

#### 后端启动
```bash
cd backend
npm install
npm run dev
```

#### 前端启动
```bash
cd frontend
npm install
npm start
```

## 访问地址

- **前端应用**: http://localhost:3000
- **后端 API**: http://localhost:5000
- **API 文档**: http://localhost:5000/api/docs

## 项目结构

```
work-diary-app/
├── backend/                 # 后端服务
│   ├── controllers/         # 控制器
│   ├── models/             # 数据模型
│   ├── routes/             # 路由定义
│   ├── middleware/         # 中间件
│   ├── utils/              # 工具函数
│   └── server.js           # 服务器入口
├── frontend/               # 前端应用
│   ├── src/
│   │   ├── components/     # React 组件
│   │   ├── services/       # API 服务
│   │   ├── utils/          # 工具函数
│   │   └── App.js          # 应用入口
│   └── public/             # 静态资源
├── docker-compose.yml      # 生产环境配置
├── docker-compose.dev.yml  # 开发环境配置
└── DEPLOYMENT.md           # 详细部署指南
```

## 环境配置

### 后端环境变量 (.env)
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/workdiary
JWT_SECRET=your-secret-key
NODE_ENV=development
```

### 前端环境变量 (.env)
```env
REACT_APP_API_URL=http://localhost:5000
```

## 技术栈

### 后端
- **框架**: Express.js
- **数据库**: MongoDB + Mongoose
- **认证**: JWT
- **其他**: bcryptjs, cors, dotenv

### 前端
- **框架**: React 18
- **UI 库**: Ant Design
- **路由**: React Router
- **HTTP 客户端**: Axios
- **图表**: Recharts

### 部署
- **容器化**: Docker + Docker Compose
- **反向代理**: Nginx
- **数据库**: MongoDB

## 开发指南

### API 接口

#### 用户认证
- `POST /api/users/register` - 用户注册
- `POST /api/users/login` - 用户登录
- `GET /api/users/profile` - 获取用户信息

#### 日记管理
- `GET /api/diaries` - 获取日记列表
- `POST /api/diaries` - 创建日记
- `PUT /api/diaries/:id` - 更新日记
- `DELETE /api/diaries/:id` - 删除日记

#### 总结功能
- `POST /api/summaries/daily` - 生成日总结
- `POST /api/summaries/monthly` - 生成月总结
- `GET /api/summaries` - 获取总结列表

### 代码规范

- 使用 ESLint 进行代码检查
- 遵循 Airbnb JavaScript 风格指南
- 组件和函数使用驼峰命名
- 文件名使用 kebab-case

## 部署说明

详细的部署指南请参考 [DEPLOYMENT.md](./DEPLOYMENT.md)

### 生产环境注意事项

1. **安全配置**:
   - 修改默认密码和密钥
   - 配置 HTTPS 证书
   - 设置防火墙规则

2. **性能优化**:
   - 启用 Gzip 压缩
   - 配置 CDN
   - 数据库索引优化

3. **监控和日志**:
   - 配置日志收集
   - 设置健康检查
   - 监控资源使用

## 故障排除

### 常见问题

1. **端口冲突**: 修改 docker-compose.yml 中的端口映射
2. **数据库连接失败**: 检查 MongoDB 服务状态
3. **前端无法访问后端**: 检查 CORS 配置和网络连接

### 查看日志
```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs backend
docker-compose logs frontend
```

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 支持

如果您遇到问题或有建议，请：

1. 查看 [DEPLOYMENT.md](./DEPLOYMENT.md) 获取详细帮助
2. 检查现有的 Issues
3. 创建新的 Issue 描述问题

---

**注意**: 在生产环境中使用前，请务必修改所有默认密码和密钥！
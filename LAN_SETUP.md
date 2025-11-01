# 局域网部署指南

## 1. 环境要求
- Node.js 16+
- MongoDB
- 稳定的局域网连接

## 2. 服务器配置

### 后端配置
1. 复制环境变量文件：
```bash
cp .env.example .env
```

2. 修改后端配置（可选）：
```env
# 在 .env 文件中修改以下配置
HOST=0.0.0.0  # 允许局域网访问
PORT=5000     # 端口号
```

3. 启动后端服务：
```bash
cd backend
npm install
npm start
```

### 前端配置
1. 修改前端环境变量：
```env
# 在 frontend/.env 文件中添加
REACT_APP_API_URL=http://你的IP地址:5000/api
```

2. 构建前端：
```bash
cd frontend
npm install
npm run build
```

3. 启动前端服务（开发模式）：
```bash
npm start
```

## 3. 局域网访问地址

### 开发模式访问
- 后端API: http://你的IP地址:5000
- 前端界面: http://你的IP地址:13000

### 生产模式访问
- 网站地址: http://你的IP地址:5000 (如果使用nginx代理)

## 4. 获取本机IP地址

### Windows
```cmd
ipconfig
```
查找无线局域网适配器 WLAN 的 IPv4 地址

### macOS/Linux
```bash
ifconfig
```
或
```bash
ip addr show
```

## 5. 防火墙配置

### Windows
1. 打开"Windows Defender 防火墙"
2. 点击"允许应用或功能通过 Windows Defender 防火墙"
3. 添加 Node.js 或允许端口 5000 和 3000

### 命令行方式
```cmd
netsh advfirewall firewall add rule name="Work Diary Backend" dir=in action=allow protocol=TCP localport=5000
netsh advfirewall firewall add rule name="Work Diary Frontend" dir=in action=allow protocol=TCP localport=3000
```

## 6. 局域网用户访问

局域网其他用户可以通过以下地址访问：
- http://你的IP地址:13000 (开发模式)
- http://你的IP地址:5000 (生产模式)

## 7. 注意事项

1. **确保MongoDB运行**：局域网用户需要能访问MongoDB服务
2. **IP地址稳定性**：如果使用DHCP，IP地址可能会变化
3. **安全考虑**：在生产环境中考虑使用HTTPS和身份验证
4. **性能优化**：局域网访问通常比本地访问慢，确保服务器性能足够

## 8. 故障排除

### 无法访问
1. 检查防火墙设置
2. 确认IP地址正确
3. 检查服务是否正常运行

### 连接超时
1. 检查网络连接
2. 确认端口未被占用
3. 查看服务日志

## 9. 高级配置（可选）

### 使用nginx反向代理
```nginx
server {
    listen 80;
    server_name your-local-ip;
    
    location / {
proxy_pass http://localhost:13000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 使用PM2管理进程
```bash
npm install -g pm2
pm2 start backend/server.js --name "work-diary-backend"
pm2 start frontend/server.js --name "work-diary-frontend"
pm2 save
pm2 startup
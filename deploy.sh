#!/bin/bash

# 工作日记应用部署脚本

echo "=== 工作日记应用部署脚本 ==="
echo "开始部署工作日记应用..."

# 检查 Docker 和 Docker Compose 是否安装
if ! command -v docker &> /dev/null; then
    echo "错误: Docker 未安装，请先安装 Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "错误: Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

# 停止现有容器
echo "停止现有容器..."
docker-compose down

# 清理旧镜像 (可选)
read -p "是否清理旧的 Docker 镜像? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "清理旧镜像..."
    docker system prune -f
    docker image prune -f
fi

# 构建并启动服务
echo "构建并启动服务..."
docker-compose up --build -d

# 等待服务启动
echo "等待服务启动..."
sleep 10

# 检查服务状态
echo "检查服务状态..."
docker-compose ps

# 显示日志
echo "显示最近的日志..."
docker-compose logs --tail=20

echo ""
echo "=== 部署完成 ==="
echo "前端访问地址: http://localhost:3000"
echo "后端API地址: http://localhost:5000"
echo "Nginx代理地址: http://localhost:80"
echo ""
echo "查看日志: docker-compose logs -f"
echo "停止服务: docker-compose down"
echo "重启服务: docker-compose restart"
echo ""
echo "注意: 请修改 .env.production 文件中的密钥和数据库密码！"
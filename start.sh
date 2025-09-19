#!/bin/bash

# 获取宿主机IP地址 (适用于Linux/macOS/WSL)
# 如果在Windows上使用Git Bash或WSL，这个命令应该可以工作
# 如果在Windows CMD或PowerShell中，可能需要调整
HOST_IP=$(hostname -I | awk '{print $1}')

# 如果上面的命令没有获取到IP，尝试使用其他方法
if [ -z "$HOST_IP" ]; then
  # 尝试使用ip route命令获取
  HOST_IP=$(ip route get 1.1.1.1 | awk '{print $7}')
fi

# 如果还是没有获取到IP，尝试使用ifconfig (macOS)
if [ -z "$HOST_IP" ]; then
  HOST_IP=$(ifconfig | grep "inet " | grep -Fv 127.0.0.1 | awk '{print $2}' | head -n 1)
fi

# 如果仍然没有获取到IP，使用默认值
if [ -z "$HOST_IP" ]; then
  echo "无法自动获取IP地址，使用默认值 127.0.0.1"
  HOST_IP="127.0.0.1"
fi

echo "检测到宿主机IP地址: $HOST_IP"

# 导出环境变量
export REACT_APP_API_URL="http://$HOST_IP:5000/api"
export BACKEND_CORS_ORIGIN="http://$HOST_IP:3000"

# 启动docker-compose服务
docker-compose down
docker-compose up -d

echo "服务已启动"
echo "前端访问地址: http://$HOST_IP:3000"
echo "后端API地址: http://$HOST_IP:5000"
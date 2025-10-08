@echo off
setlocal enabledelayedexpansion

REM 获取宿主机IP地址
for /f "tokens=2 delims=[]" %%a in ('ping -4 -n 1 %ComputerName% ^| findstr "["') do (
    set HOST_IP=%%a
)

REM 如果没有获取到IP，使用默认值
if "!HOST_IP!"=="" (
    echo 无法自动获取IP地址，使用默认值 127.0.0.1
    set HOST_IP=127.0.0.1
)

echo 检测到宿主机IP地址: !HOST_IP!

REM 设置环境变量
set REACT_APP_API_URL=http://!HOST_IP!:5000/api
set BACKEND_CORS_ORIGIN=http://!HOST_IP!:3000

REM 启动docker-compose服务
docker-compose down
docker-compose up -d

echo 服务已启动
echo 前端访问地址: http://!HOST_IP!:3000
echo 后端API地址: http://!HOST_IP!:5000

pause
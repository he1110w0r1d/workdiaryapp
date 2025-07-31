@echo off
chcp 65001 >nul
echo === 工作日记应用部署脚本 ===
echo 开始部署工作日记应用...
echo.

REM 检查 Docker 是否安装
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: Docker 未安装，请先安装 Docker Desktop
    pause
    exit /b 1
)

REM 检查 Docker Compose 是否安装
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: Docker Compose 未安装，请先安装 Docker Compose
    pause
    exit /b 1
)

REM 停止现有容器
echo 停止现有容器...
docker-compose down

REM 询问是否清理旧镜像
set /p cleanup="是否清理旧的 Docker 镜像? (y/N): "
if /i "%cleanup%"=="y" (
    echo 清理旧镜像...
    docker system prune -f
    docker image prune -f
)

REM 构建并启动服务
echo 构建并启动服务...
docker-compose up --build -d

REM 等待服务启动
echo 等待服务启动...
timeout /t 10 /nobreak >nul

REM 检查服务状态
echo 检查服务状态...
docker-compose ps

REM 显示日志
echo 显示最近的日志...
docker-compose logs --tail=20

echo.
echo === 部署完成 ===
echo 前端访问地址: http://localhost:3000
echo 后端API地址: http://localhost:5000
echo Nginx代理地址: http://localhost:80
echo.
echo 查看日志: docker-compose logs -f
echo 停止服务: docker-compose down
echo 重启服务: docker-compose restart
echo.
echo 注意: 请修改 .env.production 文件中的密钥和数据库密码！
echo.
pause
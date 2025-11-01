@echo off
echo 正在启动工作日记应用...
cd /d "%~dp0"
pm2 start ecosystem.config.js
echo 应用已启动！
echo 后端服务运行在: http://localhost:5000
echo 前端服务运行在: http://localhost:13000
echo 局域网访问地址: http://192.168.1.168:13000
echo.
echo 常用命令:
echo pm2 status              - 查看应用状态
echo pm2 stop all            - 停止所有应用
echo pm2 restart all         - 重启所有应用
echo pm2 logs                - 查看日志
echo pm2 delete all          - 删除所有应用
pause
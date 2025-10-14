@echo off
echo 正在停止工作日记应用...
cd /d "%~dp0"
pm2 stop all
echo 应用已停止！
pause
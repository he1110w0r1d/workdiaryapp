@echo off
echo 正在重启工作日记应用...
cd /d "%~dp0"
pm2 restart all
echo 应用已重启！
pause
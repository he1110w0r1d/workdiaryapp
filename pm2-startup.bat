@echo off
echo 设置PM2开机自启动...
echo 注意：Windows系统需要手动设置开机启动，请按以下步骤操作：
echo.
echo 1. 按 Win+R 打开运行对话框
echo 2. 输入 shell:startup 并按回车
echo 3. 将本脚本的快捷方式复制到启动文件夹
echo 4. 或者使用任务计划程序设置开机启动
echo.
echo 当前PM2应用状态：
pm2 status
echo.
echo 手动启动命令：pm2 resurrect
echo 手动保存状态：pm2 save
echo.
pause
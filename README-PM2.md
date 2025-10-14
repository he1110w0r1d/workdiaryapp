# PM2 进程管理说明

## 已创建的批处理文件

- `start-apps.bat` - 启动应用
- `stop-apps.bat` - 停止应用  
- `restart-apps.bat` - 重启应用
- `pm2-startup.bat` - 开机自启动说明

## 常用PM2命令

```bash
# 查看应用状态
pm2 status

# 查看应用日志
pm2 logs

# 停止所有应用
pm2 stop all

# 重启所有应用  
pm2 restart all

# 删除所有应用
pm2 delete all

# 保存当前状态
pm2 save

# 恢复保存的状态
pm2 resurrect
```

## Windows开机自启动设置

由于Windows不支持`pm2 startup`，需要手动设置：

### 方法1：启动文件夹
1. 按 `Win + R` 输入 `shell:startup`
2. 将 `start-apps.bat` 的快捷方式复制到启动文件夹

### 方法2：任务计划程序
1. 打开"任务计划程序"
2. 创建基本任务
3. 触发器选择"计算机启动时"
4. 操作选择"启动程序"，程序选择 `start-apps.bat`

## 当前应用配置

- **后端服务**: http://localhost:5000 (局域网: http://192.168.1.168:5000)
- **前端服务**: http://localhost:3000 (局域网: http://192.168.1.168:3000)

应用现在在后台运行，关闭命令行窗口也不会停止。
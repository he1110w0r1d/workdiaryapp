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

# 生成并启用 Systemd 自启动（Linux 推荐）
pm2 startup systemd -u $USER --hp $HOME
pm2 save
sudo env PATH=$PATH:/usr/bin systemctl enable pm2-$USER
sudo systemctl start pm2-$USER
```

## Linux 开机自启动（Systemd + PM2）

在 Linux 上推荐使用 PM2 的 Systemd 集成：

```bash
# 生成 systemd 配置（按当前用户创建）
pm2 startup systemd -u $USER --hp $HOME

# 保存当前进程列表（resurrect 会按此恢复）
pm2 save

# 启用并启动 pm2-$USER 服务
sudo env PATH=$PATH:/usr/bin systemctl enable pm2-$USER
sudo systemctl start pm2-$USER

# 验证是否生效
systemctl status pm2-$USER
pm2 resurrect   # 如系统启动后有丢失可手动恢复
pm2 status
```

可选方案（无需 systemd 权限）：使用 `crontab` 的 `@reboot` 触发脚本：

```bash
(crontab -l 2>/dev/null; echo "@reboot /home/shenchun/文档/personal-portal/start-portal.sh >> /home/shenchun/文档/personal-portal/logs/startup.log 2>&1") | crontab -
```

该脚本会：
- 如 MongoDB 未运行，则按 `start-portal.sh` 的配置启动本地 `mongod`
- 使用全局或本地的 `pm2` 恢复或启动 `ecosystem.config.js`
- 启动 `workdiaryapp/workdiaryapp/ecosystem.config.js` 中前后端服务
- 保存进程列表，保证下次重启自动恢复

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
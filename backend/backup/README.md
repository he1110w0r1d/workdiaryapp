# 工作日记应用数据备份

本目录包含工作日记应用的完整数据备份，包括数据库数据和用户上传的文件。

## 备份内容

### 数据库备份
- `users.json` - 用户数据 (11条记录)
- `diaries.json` - 日记数据 (32条记录) 
- `summaries.json` - 总结数据 (8条记录)
- `workdiary-backup-2025-08-02.json` - 完整备份文件

### 文件备份
- `uploads/` - 用户上传的文件目录
  - `avatars/` - 用户头像
  - `summaries/` - 总结相关文件

## 备份信息
- **备份时间**: 2025-08-02 17:10:25
- **数据库**: workdiary
- **总记录数**: 51条

## 如何恢复数据

### 1. 恢复数据库数据

在backend目录下运行恢复脚本：

```bash
cd backend
node restore-script.js
```

### 2. 恢复上传文件

```bash
# 在backend目录下执行
cp -r backup/uploads/* uploads/
```

### 3. 手动恢复（可选）

如果需要手动恢复特定集合，可以使用MongoDB命令：

```bash
# 恢复用户数据
mongoimport --db workdiary --collection users --file backup/users.json --jsonArray

# 恢复日记数据
mongoimport --db workdiary --collection diaries --file backup/diaries.json --jsonArray

# 恢复总结数据
mongoimport --db workdiary --collection summaries --file backup/summaries.json --jsonArray
```

## 注意事项

1. **数据库连接**: 确保MongoDB服务正在运行
2. **权限问题**: 确保有足够的权限访问数据库和文件系统
3. **数据冲突**: 恢复前请备份现有数据，避免数据丢失
4. **环境变量**: 确保`.env`文件配置正确

## 备份脚本

- `../backup-script.js` - 数据备份脚本
- `../restore-script.js` - 数据恢复脚本

这些脚本可以用于定期备份和快速恢复数据。
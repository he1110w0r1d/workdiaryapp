# 阿里云低内存部署（2026-09-17）

## 已上线

入口：https://www.workdiary.cn/login 。主机 `101.200.89.97` / `shenchuncloud`，x86_64，系统报告约 1.6GiB 内存。
功能源码提交：`dbf1ea0`（包含 `497e0e0` 的 Markdown、日报预算、问答修复）。

前端在 Windows 本机以 `REACT_APP_API_URL=/api` 构建；Linux 运行镜像在局域网机器组装，代码来自 Git 归档，只复用依赖目录，不包含局域网服务器的环境文件、凭据或业务数据。阿里云只执行镜像校验/加载，无 npm 编译或依赖安装。
镜像：`workdiary-aliyun-frontend:dbf1ea0`、`workdiary-aliyun-backend:dbf1ea0`。

## 数据保护与验证

- 完整备份位于 `/root/workdiary-release-20260917/backup-2`：Mongo archive、PG custom dump、附件、原提示词、原环境、容器描述、代理配置、部署后专用连接配置和 PG roles。
- Mongo gzip、PG TOC、备份 SHA256 全部通过；实际 Mongo archive 已执行只读 dry-run 检查。
- 加密 SSH 下载的离机副本：本工作区 `tmp/aliyun-release/private/private-backup-20260917.tar.gz`，Windows 目录仅当前管理员账号访问，SHA256 与服务器一致。此归档包含敏感配置，已由 tmp 忽略规则排除 Git，不应公开。
- 原有 8 个用户、412 条日记、194 条待办、176 份总结、0 条 API key，切换后及最终验收后逐集合内容哈希与停写快照一致。
- 仅临时验收账号执行 HTTPS 登录、日记保存/读取、Markdown 阅读和备份恢复。无效恢复被拒绝且原测试记录保留；合法恢复通过真实事务，内容一致。临时账号、数据、相关任务与测试备份文件已清理。
- 412 条有效日记全部完成检索同步，413 个本地向量片段，3 个索引任务成功，无未完成/失败任务。
- 未迁移局域网服务器的账号、日记或模型密钥，也未替其他账号配置外部模型。原云端没有默认向量模型，使用现有本地哈希向量回退；其语义检索能力弱于专用 embedding 模型。此次没有调用原用户的付费模型进行答案生成验收。

## 运行调整

- Mongo 保持原 7.0.28 镜像和原数据卷，转换为带 keyfile 认证的单节点副本集 `workdiary`，支持事务。事先在相同镜像的隔离环境验证独立模式→副本集、提交/回滚、备份恢复、再退回独立模式且保留新写入。
- 后端 `uploads`、`backup`、`private`、`config`、`templates` 挂载到 `/root/workdiary-release-20260917/data`，附件不再仅在容器内部。
- 后台任务启动开关允许先核对数据再启用。最终 `BACKGROUND_JOBS_ENABLED=true`。
- 原 PG 环境密码无法通过 TCP 认证；没有重置原管理员密码。创建仅有本应用表 CRUD / sequence 权限的 `workdiary_app` 角色，随机密码保存在受限 compose 配置中。
- 原向量表为空且固定为 vector(4096)，改为 `vector` 支持不同用户模型及 256 维本地回退，不删除数据。若从升级前 PG dump 恢复，需重新执行 `ALTER TABLE diary_embeddings ALTER COLUMN embedding TYPE vector;`，再重新建索引。
- Mongo WiredTiger cache 256MiB / 容器 512MiB；后端 Node old-space 256MiB / 容器 384MiB；前端 96MiB。设置 Docker 日志轮转，并增加 `/swap-workdiary` 2GiB 交换文件（fstab 持久化）。验收时仍有约 550MiB available，swap 未使用。
- 原 HTTPS 域名和证书保留，API 同域代理、600 秒读取超时、50MiB 上传限制；补上附件代理。另一网站的既有 OpenResty 重复 server_name 警告仍在，本次未改动其他站点。

## 运维与回滚

受限配置：`/root/workdiary-release-20260917/compose.production.json`，内含凭据，不公开。
本机仅有旧版 `docker-compose 1.29.2`，不是 `docker compose`。部署第一次因工具版本不匹配自动回退，第二次适配后成功。以后重建容器必须使用上述配置，避免重新运行旧的无挂载/无副本集参数。

旧前端、后端、Mongo 容器保留为原名加 `-before-20260917`，均处于停止状态；原镜像保留。PostgreSQL 容器及卷未替换。回滚时先停止新应用写入并备份当时数据，再恢复旧容器的名字和网络连接。**不要直接把升级前数据库备份覆盖到已经产生新记录的数据库。** Mongo 可退回独立模式继续使用当前卷，但新版事务功能将不可用。数据库大版本没有变化。

发布证据：`DEPLOYED`、`FINAL_ACCEPTANCE.json`、`acceptance-data-check.json`、`data-after.json`、`backup-final-verification.log`、`mongo-restore-dryrun.log`，均在上述发布目录。
运行镜像的后端测试 28 项通过、4 项隔离数据库组跳过；数据库迁移专项演练另行通过。前端生产构建通过，保留既有 lint/bundle 警告。

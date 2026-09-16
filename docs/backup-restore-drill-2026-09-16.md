# 上线前完整备份与隔离恢复演练

2026-09-16 在 `192.168.1.168` / `shenchun-linux` 完成。生产代码仍为 `346c91bc86fd0c5a24546e44717cda11642fefe0`，没有部署功能分支，没有迁移生产 MongoDB。

## 备份

- 目录：`/home/shenchun/workdiary-backups/20260916-222348`，约 149 MB，目录和文件限制其他用户访问。当前为服务器本机备份，未另外复制到异机。
- 后端停止写入：北京时间 22:24:18；恢复服务：22:24:24，约 6 秒。数据库、文件备份在这段时间完成，应用镜像在服务恢复后导出。
- `mongodb.archive.gz`：workdiary 数据库全部集合与索引。
- `postgres.dump`、`postgres-globals-private.sql`：向量数据库自定义格式备份，以及全局角色定义。
- `backend-app.tar`：运行容器的应用、配置、uploads、private、backup 内容。
- `frontend-html.tar`、`frontend-nginx.conf`：运行中的前端资源和 Nginx 配置。
- `source-and-config.tar.gz`、`source-revision.txt`：服务器源码及配置，不包含 Git 历史、依赖目录和前端构建目录；运行文件另有上述归档。
- `application-images.tar.gz`：按实际镜像 ID 导出生产前后端镜像，供旧版本回滚。
- `containers-private.json`：容器环境、挂载、镜像等恢复信息，含凭据，只保存在受限备份目录，未提交 Git。
- `SHA256SUMS` 已逐项复核；压缩归档完整性通过；最终存在 `BACKUP_COMPLETE`。

## 实际恢复结果

使用全新 Docker 内部网络，无宿主端口映射、无外部网络访问，恢复到独立 MongoDB 7 副本集和 pgvector PostgreSQL 16。

| MongoDB 集合 | 记录数 |
| --- | ---: |
| diaries | 627 |
| todos | 662 |
| summaries | 358 |
| diaryembeddings | 409 |
| users | 1 |
| apikeys | 2 |

- 六个集合逐记录按 `_id` 排序、使用非 relaxed EJSON 计算 SHA-256，与备份时来源一致。索引按名称排序后比较定义，同时保留复合索引字段顺序，全部一致。
- PostgreSQL 恢复 390 条向量，均为 4096 维。备份和恢复后重新导出的 COPY 行内容哈希、序列值一致；不是只核对记录数。
- 后端归档 4,876 个文件、前端归档 16 个文件，解压后逐文件内容哈希及符号链接目标一致。解压副本使用受限权限，不以宿主 UID/GID 与归档相同作为验证条件。
- 隔离 MongoDB 副本集的事务提交、事务回滚均实际通过；此项验证没有替代生产认证与副本集配置的迁移演练。
- 使用恢复的应用文件和原生产镜像连接隔离数据库，API 根路径返回 HTTP 200。此为启动检查，不是全部登录和业务流程验收。
- 生产 API 和前端恢复后均返回 HTTP 200。隔离容器、数据库卷、网络和临时解压副本已清理；保留备份归档与核对结果。

证据位于备份目录中的 `mongo-verification.json`、`pg-content-verification.json`、`file-verification.json`、`replica-transaction-check.txt`、`restored-api-health.txt` 及恢复日志。

## 下一阶段

准备带认证的生产 MongoDB 单节点副本集迁移配置，先在隔离环境验证 keyfile、连接 URI、启动与回退步骤。生产升级之前检查备份后是否出现新增数据，按需重新备份；不得将本次演练通过误认为已经升级生产。

回滚材料保留旧镜像、原容器配置与持久化文件。应用回退优先保留现有数据；整库回滚应停写并先备份当时数据，避免覆盖备份时间之后的新记录。

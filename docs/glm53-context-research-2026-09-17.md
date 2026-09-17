# GLM-5.3-Flash 官方能力核查与长上下文接入（2026-09-17）

## 核查结论

- 官方 API 文档：https://docs.z.ai/guides/vlm/glm-5.3-flash ，标注 1M context、128K maximum output。只支持 thinking enabled，不能通过 disabled 关闭推理。
- 官方模型卡：https://huggingface.co/zai-org/GLM-5.3-Flash ，明确 reasoning_effort 支持 low/high/max，省略默认为 max。
- 官方配置：https://huggingface.co/zai-org/GLM-5.3-Flash/raw/main/config.json ，max_position_embeddings=1048576。
- 国内旧文档索引仍有 GLM-5.2 信息，本次未将第三方评测页当作能力依据。

## 实施

提交 1fd6859。此前没有明确传 reasoning_effort，调用落到模型默认 max。总结服务现对 zhipu/glm-5.3-flash 启用经核验的能力配置：正文 high、资料整理与建议提取 low，保持 thinking enabled。这个档位选择是应用对质量/等待的折中，并非官方要求；官方推荐 max 用于充分性能。

整期资料在 800000 UTF-8 字节内时直接生成，不先分段压缩。字节数是保守 token 上界估算，不是精确 token 数；相对 1M 窗口为 128K 输出、提示词和余量留空间。超大输入继续完整分段，不截掉尾部。只对确切的已核查模型生效，未知模型不冒用其能力。

本地八月任务原始资料 36 条，约63696字符、123179字节，远低于阈值，可以整期读取。旧中间缓存不删除，旧报告不修改，但新正文直接依据全部原始日记。此前逐段进度不再是这次任务的处理方式。

本地该用户的默认模型最大输出从错误填写的1000000修正为131072；超时从180秒明确改为300秒用于单次长上下文请求。原配置已备份，其他模型和用户设置未改。请求预算与用户最大值分别保留，正文初始65536，需要时只在上限内扩容一次。

隔离副本集回归66通过、1个pgvector专项跳过；新增测试核对80K字符输入完整保留、high与thinking参数实际写入请求。

本地与阿里云镜像：workdiary-aliyun-backend:glm-20260917；备份分别在 /home/shenchun/workdiary-glm-lan-20260917/backup 与 /root/workdiary-glm-release-20260917/backup。云端没有构建。

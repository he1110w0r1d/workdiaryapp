const Diary = require('../models/Diary');
const DifyClient = require('../utils/dify');
const logger = require('../utils/logger');

// 组装单篇日记文本：正文 + 地点 + 标签 + 时间范围
function buildDiaryText(d) {
  const start = d.startTime ? new Date(d.startTime) : null;
  const end = d.endTime ? new Date(d.endTime) : null;
  const dateStr = start ? `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}` : '';
  const timeRange = start && end ? `${start.toLocaleString()} - ${end.toLocaleString()}` : '';
  return [
    d.content || '',
    d.location ? `地点: ${d.location}` : '',
    Array.isArray(d.tags) && d.tags.length ? `标签: ${d.tags.join(' ')}` : '',
    (dateStr || timeRange) ? `时间: ${dateStr} ${timeRange}` : ''
  ].filter(Boolean).join('\n');
}

function buildDiaryName(d) {
  const start = d.startTime ? new Date(d.startTime) : null;
  const dateStr = start ? `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}` : '未设日期';
  return `工作日记 ${dateStr} ${String(d._id)}`;
}

// 全量同步当前用户的日记到 Dify 知识库（每篇作为一个文档）
exports.syncAllDiaries = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 调试环境变量
    console.log('Environment variables:', {
      DIFY_BASE_URL: process.env.DIFY_BASE_URL,
      DIFY_DATASET_API_KEY: process.env.DIFY_DATASET_API_KEY,
      DIFY_DATASET_ID: process.env.DIFY_DATASET_ID,
      DIFY_DATASET_NAME: process.env.DIFY_DATASET_NAME
    });
    
    const dify = new DifyClient();

    // 基础配置检查
    dify.ensureBaseAuth();

    // 支持通过 query 传入 datasetId
    const queryDatasetId = req.query.datasetId;
    if (queryDatasetId) {
      dify.datasetId = String(queryDatasetId);
    }

    const apiKey = process.env.DIFY_DATASET_API_KEY || '';
    // 如果使用的是 Dataset API Key（前缀 dataset-），则要求必须提供 datasetId
    if (apiKey.startsWith('dataset-') && !dify.datasetId) {
      return res.status(400).json({
        success: false,
        message: '缺少 DIFY_DATASET_ID：使用数据集密钥时无法列出知识库，请在 .env 配置 DIFY_DATASET_ID 或通过 query 传入 datasetId',
      });
    }

    // 如果没有提供 datasetId（可能使用 Console API Key），尝试按名称解析
    if (!dify.datasetId) {
      const datasetName = req.query.datasetName || process.env.DIFY_DATASET_NAME || '工作日记记录';
      try {
        await dify.resolveDatasetIdByName(datasetName);
      } catch (err) {
        // 针对常见错误返回更明确的提示
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          return res.status(400).json({
            success: false,
            message: 'Dify鉴权失败：当前密钥无法列出知识库，请配置 DIFY_DATASET_ID 或通过 query 传入 datasetId',
            error: err.message
          });
        }
        if (status === 404) {
          return res.status(400).json({
            success: false,
            message: 'Dify接口 404：请确认 DIFY_BASE_URL 指向正确的数据 API（建议 http://<host>:<port>），客户端会拼接 /v1 路由前缀。',
            error: err.message
          });
        }
        throw err;
      }
    }

    dify.ensureDataset();

    const diaries = await Diary.find({ user: userId, isDeleted: false }).sort({ startTime: -1 }).lean();
    let created = 0, updated = 0;

    try { logger.llm('开始同步到Dify', { userId, count: diaries.length }); } catch (_) {}

    for (const d of diaries) {
      const name = buildDiaryName(d);
      const text = buildDiaryText(d);
      if (d.difyDocId) {
        try {
          await dify.updateByText(d.difyDocId, name, text, { indexing_technique: 'high_quality' });
          updated++;
        } catch (err) {
          // 如果更新失败，尝试重新创建
          logger.warn('更新Dify文档失败，尝试重新创建', { diaryId: String(d._id), message: err.message });
          const createdDoc = await dify.createByText(name, text, { indexing_technique: 'high_quality' });
          await Diary.updateOne({ _id: d._id }, { $set: { difyDocId: createdDoc.id } });
          created++;
        }
      } else {
        const createdDoc = await dify.createByText(name, text, { indexing_technique: 'high_quality' });
        await Diary.updateOne({ _id: d._id }, { $set: { difyDocId: createdDoc.id } });
        created++;
      }
    }

    try { logger.llm('Dify同步完成', { created, updated }); } catch (_) {}

    return res.json({ success: true, total: diaries.length, created, updated });
  } catch (error) {
    try { logger.error('Dify同步失败', { message: error.message }); } catch (_) {}
    return res.status(500).json({ success: false, message: 'Dify同步失败', error: error.message });
  }
};

/**
 * 内部使用：按日期范围同步指定用户的日记到 Dify（避免全量同步压力）
 * @param {string} userId 用户ID
 * @param {Date} startDate 开始时间（含）
 * @param {Date} endDate 结束时间（不含）
 */
exports.syncUserDiariesForDate = async (userId, startDate, endDate) => {
  try {
    const dify = new DifyClient();
    // 基础鉴权与数据集检查
    dify.ensureBaseAuth();
    // 若未配置 datasetId，尝试按名称解析（支持 Console Key 情况）
    if (!dify.datasetId) {
      const datasetName = process.env.DIFY_DATASET_NAME || '工作日记记录';
      try {
        await dify.resolveDatasetIdByName(datasetName);
      } catch (err) {
        // 若使用 Dataset Key 无法列出知识库，这里会抛错，交由上层日志处理
        throw err;
      }
    }
    dify.ensureDataset();

    const diaries = await Diary.find({
      user: userId,
      isDeleted: false,
      startTime: { $gte: startDate, $lt: endDate }
    }).sort({ startTime: 1 }).lean();

    let created = 0, updated = 0;
    try { logger.llm('按日期同步到Dify开始', { userId, count: diaries.length, startDate, endDate }); } catch (_) {}

    for (const d of diaries) {
      const name = buildDiaryName(d);
      const text = buildDiaryText(d);
      if (d.difyDocId) {
        try {
          await dify.updateByText(d.difyDocId, name, text, { indexing_technique: 'high_quality' });
          updated++;
        } catch (err) {
          logger.warn('更新Dify文档失败，尝试重新创建', { diaryId: String(d._id), message: err.message });
          const createdDoc = await dify.createByText(name, text, { indexing_technique: 'high_quality' });
          await Diary.updateOne({ _id: d._id }, { $set: { difyDocId: createdDoc.id } });
          created++;
        }
      } else {
        const createdDoc = await dify.createByText(name, text, { indexing_technique: 'high_quality' });
        await Diary.updateOne({ _id: d._id }, { $set: { difyDocId: createdDoc.id } });
        created++;
      }
    }

    try { logger.llm('按日期同步到Dify完成', { userId, created, updated }); } catch (_) {}
    return { success: true, total: diaries.length, created, updated };
  } catch (error) {
    try { logger.warn('按日期同步到Dify失败', { userId, message: error.message }); } catch (_) {}
    return { success: false, message: error.message };
  }
};
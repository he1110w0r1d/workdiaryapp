const index = require('../services/indexWorkflow');

// Manual and scheduled callers share the durable path and server-owned dataset configuration.
exports.syncAllDiaries = async (req, res) => {
  if (!process.env.DIFY_BASE_URL || !process.env.DIFY_DATASET_API_KEY) return res.status(400).json({ success: false, message: '服务器尚未配置 Dify 同步' });
  try {
    const job = await index.enqueue(req.user.id, 'dify', true);
    res.status(202).json({ success: true, jobId: job._id, message: '已加入 Dify 同步队列' });
  } catch (_) { res.status(500).json({ success: false, message: '同步任务入队失败' }); }
};
exports.syncUserDiariesForDate = userId => index.enqueue(userId, 'dify');

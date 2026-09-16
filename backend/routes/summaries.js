const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getSummaries,
  getSummaryById,
  deleteSummary,
  getPromptTemplate,
  updatePromptTemplate,
  markSummaryAsRead,
  getUnreadSummariesCount,
  markAllSummariesAsRead,
  ensureSummaryHTML
} = require('../controllers/summaryController');

const workflow = require('../controllers/workflowController');
router.get('/jobs', protect, workflow.list);
router.post('/jobs', protect, workflow.create);
router.post('/jobs/preview', protect, workflow.preview);
router.post('/jobs/:jobId/retry', protect, workflow.retry);
router.get('/:id/suggestions', protect, workflow.suggestions);
router.post('/suggestions/:suggestionId/accept', protect, workflow.accept);
router.post('/suggestions/:suggestionId/dismiss', protect, workflow.dismiss);

router.get('/:id/html', protect, require('../controllers/summaryFileController').getSummaryHTML);

router.route('/')
  .get(protect, getSummaries);

router.route('/:id')
  .get(protect, getSummaryById)
  .delete(protect, deleteSummary);

// 确保并生成总结HTML文件，返回可访问URL
router.route('/:id/ensure-html')
  .get(protect, ensureSummaryHTML);

router.route('/regenerate/daily')
  .post(protect, workflow.legacy('daily', true));

// 重新生成上周每周总结
router.route('/regenerate/weekly/last')
  .post(protect, workflow.legacy('weekly', true));

router.route('/generate/today')
  .post(protect, workflow.legacy('daily'));

router.route('/generate/weekly')
  .post(protect, workflow.legacy('weekly'));

router.route('/generate/monthly')
  .post(protect, workflow.legacy('monthly', true));

router.route('/generate/current-monthly')
  .post(protect, workflow.legacy('monthly'));

router.route('/generate/yearly')
  .post(protect, workflow.legacy('yearly'));

router.route('/prompt/:type')
  .get(protect, getPromptTemplate)
  .put(protect, updatePromptTemplate);

// 已读/未读相关路由
router.route('/unread/count')
  .get(protect, getUnreadSummariesCount);

router.route('/:id/read')
  .put(protect, markSummaryAsRead);

router.route('/read/all')
  .put(protect, markAllSummariesAsRead);

module.exports = router;
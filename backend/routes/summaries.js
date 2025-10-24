const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getSummaries,
  getSummaryById,
  deleteSummary,
  regenerateDailySummary,
  generateTodaySummary,
  generateWeeklySummary,
  generateMonthlySummary,
  generateCurrentMonthlySummary,
  generateYearlySummary,
  getPromptTemplate,
  updatePromptTemplate,
  markSummaryAsRead,
  getUnreadSummariesCount,
  markAllSummariesAsRead,
  ensureSummaryHTML
} = require('../controllers/summaryController');

router.route('/')
  .get(protect, getSummaries);

router.route('/:id')
  .get(protect, getSummaryById)
  .delete(protect, deleteSummary);

// 确保并生成总结HTML文件，返回可访问URL
router.route('/:id/ensure-html')
  .get(protect, ensureSummaryHTML);

router.route('/regenerate/daily')
  .post(protect, regenerateDailySummary);

router.route('/generate/today')
  .post(protect, generateTodaySummary);

router.route('/generate/weekly')
  .post(protect, generateWeeklySummary);

router.route('/generate/monthly')
  .post(protect, generateMonthlySummary);

router.route('/generate/current-monthly')
  .post(protect, generateCurrentMonthlySummary);

router.route('/generate/yearly')
  .post(protect, generateYearlySummary);

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
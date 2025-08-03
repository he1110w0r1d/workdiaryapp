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
  generateMonthlySummary,
  generateCurrentMonthlySummary,
  generateYearlySummary,
  getPromptTemplate,
  updatePromptTemplate
} = require('../controllers/summaryController');

router.route('/')
  .get(protect, getSummaries);

router.route('/:id')
  .get(protect, getSummaryById)
  .delete(protect, deleteSummary);

router.route('/regenerate/daily')
  .post(protect, regenerateDailySummary);

router.route('/generate/today')
  .post(protect, generateTodaySummary);

router.route('/generate/monthly')
  .post(protect, generateMonthlySummary);

router.route('/generate/current-monthly')
  .post(protect, generateCurrentMonthlySummary);

router.route('/generate/yearly')
  .post(protect, generateYearlySummary);

router.route('/prompt/:type')
  .get(protect, getPromptTemplate)
  .put(protect, updatePromptTemplate);

module.exports = router;
const express = require('express');
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
  generateYearlySummary
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

module.exports = router;
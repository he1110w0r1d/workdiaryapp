const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createDiary,
  getDiaries,
  getDiaryById,
  updateDiary,
  deleteDiary
} = require('../controllers/diaryController');

router.route('/')
  .post(protect, createDiary)
  .get(protect, getDiaries);

router.route('/:id')
  .get(protect, getDiaryById)
  .put(protect, updateDiary)
  .delete(protect, deleteDiary);

module.exports = router;
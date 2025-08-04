const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createDiary,
  getDiaries,
  getDiaryById,
  updateDiary,
  deleteDiary,
  updateTodoStatus,
  getDeletedDiaries,
  restoreDiary,
  permanentDeleteDiary
} = require('../controllers/diaryController');

router.route('/')
  .post(protect, createDiary)
  .get(protect, getDiaries);

router.route('/:id')
  .get(protect, getDiaryById)
  .put(protect, updateDiary)
  .delete(protect, deleteDiary);

// 更新日记待办状态
router.put('/:id/todo-status', protect, updateTodoStatus);

// 回收站相关路由
router.get('/recycle/list', protect, getDeletedDiaries);
router.put('/:id/restore', protect, restoreDiary);
router.delete('/:id/permanent', protect, permanentDeleteDiary);

module.exports = router;
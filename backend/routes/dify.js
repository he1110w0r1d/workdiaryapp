const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const difyController = require('../controllers/difyController');

// 全量同步当前用户日记到 Dify 知识库
router.post('/dify/sync', protect, difyController.syncAllDiaries);

module.exports = router;
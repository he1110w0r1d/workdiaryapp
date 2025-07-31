const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { protect } = require('../middleware/auth');

// 获取LLM设置
router.get('/llm', protect, settingsController.getLLMSettings);

// 保存LLM设置
router.post('/llm', protect, settingsController.saveLLMSettings);

// 测试LLM连接
router.post('/llm/test', protect, settingsController.testLLMConnection);

module.exports = router;
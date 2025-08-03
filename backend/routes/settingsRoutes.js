const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { protect } = require('../middleware/auth');

// 获取LLM设置
router.get('/llm', protect, settingsController.getLLMSettings);

// 保存LLM设置
router.post('/llm', protect, settingsController.saveLLMSettings);

// 测试LLM连接
router.post('/llm/test', protect, settingsController.testLLMConnection);

// 用户级别LLM配置路由
// 获取用户LLM配置列表
router.get('/user-llm', protect, settingsController.getUserLLMConfigs);

// 保存用户LLM配置
router.post('/user-llm', protect, settingsController.saveUserLLMConfig);

// 更新用户LLM配置
router.put('/user-llm/:configId', protect, settingsController.updateUserLLMConfig);

// 删除用户LLM配置
router.delete('/user-llm/:configId', protect, settingsController.deleteUserLLMConfig);

// 测试用户LLM配置
router.post('/user-llm/:configId/test', protect, settingsController.testUserLLMConfig);

// 设置默认用户LLM配置
router.put('/user-llm/:configId/set-default', protect, settingsController.setDefaultUserLLMConfig);

module.exports = router;
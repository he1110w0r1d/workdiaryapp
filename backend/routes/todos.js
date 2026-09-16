const express = require('express');
const router = express.Router();
const todoController = require('../controllers/todoController');
const { protect } = require('../middleware/auth');

// 所有路由都需要认证
router.use(protect);

// 获取待办列表
router.get('/', todoController.getTodos);

// 创建新待办
router.post('/', todoController.createTodo);

// 更新待办状态
router.put('/:id/status', todoController.updateTodoStatus);
router.put('/:id', todoController.updateTodo);

// 删除待办
router.delete('/:id', todoController.deleteTodo);

// 获取待办统计
router.get('/stats', todoController.getTodoStats);

module.exports = router;

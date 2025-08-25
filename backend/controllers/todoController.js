const Todo = require('../models/Todo');
const Diary = require('../models/Diary');
const logger = require('../utils/logger');

// 获取用户的待办列表
exports.getTodos = async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 10 } = req.query;
    const userId = req.user.id;
    
    // 构建查询条件
    const query = { user: userId, isDeleted: false };
    if (status) {
      query.status = status;
    }
    if (priority) {
      query.priority = priority;
    }
    
    // 分页计算
    const skip = (page - 1) * limit;
    
    // 查询待办列表
    const todos = await Todo.find(query)
      .populate('relatedDiary', 'content startTime endTime')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // 获取总数
    const total = await Todo.countDocuments(query);
    
    res.json({
      success: true,
      todos,
      pagination: {
        current: parseInt(page),
        pageSize: parseInt(limit),
        total
      }
    });
  } catch (error) {
    logger.error('获取待办列表失败:', error);
    res.status(500).json({ success: false, message: '获取待办列表失败' });
  }
};

// 创建新待办
exports.createTodo = async (req, res) => {
  try {
    const { content, priority, dueDate, relatedDiary } = req.body;
    const userId = req.user.id;
    
    // 验证必填字段
    if (!content || !dueDate) {
      return res.status(400).json({ success: false, message: '内容和截止时间为必填项' });
    }
    
    // 创建待办
    const todo = new Todo({
      user: userId,
      content,
      priority: priority || '中',
      dueDate: new Date(dueDate),
      relatedDiary: relatedDiary || null
    });
    
    await todo.save();
    
    // 如果有关联日记，更新日记的待办状态
    if (relatedDiary) {
      await Diary.findByIdAndUpdate(relatedDiary, {
        isTodo: true,
        relatedTodo: todo._id,
        todoStatus: '待办'
      });
    }
    
    logger.info(`用户 ${userId} 创建了新待办: ${content}`);
    
    res.status(201).json({
      success: true,
      message: '待办创建成功',
      todo
    });
  } catch (error) {
    logger.error('创建待办失败:', error);
    res.status(500).json({ success: false, message: '创建待办失败' });
  }
};

// 更新待办状态
exports.updateTodoStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason, summary, transferTo } = req.body;
    const userId = req.user.id;
    
    // 验证状态值
    const validStatuses = ['待办', '已完成', '已放弃', '已转交'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: '无效的状态值' });
    }
    
    // 查找待办项
    const todo = await Todo.findOne({ _id: id, user: userId, isDeleted: false });
    if (!todo) {
      return res.status(404).json({ success: false, message: '待办项不存在' });
    }
    
    // 添加状态变更记录
    const statusChange = {
      status,
      reason: summary || reason || '',
      changedAt: new Date()
    };
    
    if (status === '已转交' && transferTo) {
      statusChange.transferTo = transferTo;
    }
    
    // 更新待办状态
    todo.status = status;
    todo.statusHistory.push(statusChange);
    await todo.save();
    
    // 如果有关联日记，同步更新日记状态
    if (todo.relatedDiary) {
      await Diary.findByIdAndUpdate(todo.relatedDiary, {
        todoStatus: status
      });
    }
    
    logger.info(`用户 ${userId} 更新待办状态: ${todo.content} -> ${status}`);
    
    res.json({
      success: true,
      message: '待办状态更新成功',
      todo
    });
  } catch (error) {
    logger.error('更新待办状态失败:', error);
    res.status(500).json({ success: false, message: '更新待办状态失败' });
  }
};

// 删除待办
exports.deleteTodo = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // 查找并删除待办项
    const todo = await Todo.findOneAndDelete({ _id: id, user: userId, isDeleted: false });
    if (!todo) {
      return res.status(404).json({ success: false, message: '待办项不存在' });
    }
    
    // 如果有关联日记，清除日记的待办状态
    if (todo.relatedDiary) {
      await Diary.findByIdAndUpdate(todo.relatedDiary, {
        isTodo: false,
        relatedTodo: null,
        todoStatus: '待办'
      });
    }
    
    logger.info(`用户 ${userId} 删除了待办: ${todo.content}`);
    
    res.json({
      success: true,
      message: '待办删除成功'
    });
  } catch (error) {
    logger.error('删除待办失败:', error);
    res.status(500).json({ success: false, message: '删除待办失败' });
  }
};

// 获取待办统计信息
exports.getTodoStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 统计各状态的待办数量
    const stats = await Todo.aggregate([
      { $match: { user: userId, isDeleted: false } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // 统计优先级分布
    const priorityStats = await Todo.aggregate([
      { $match: { user: userId, status: '待办', isDeleted: false } },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // 统计即将到期的待办（7天内）
    const upcomingDeadline = new Date();
    upcomingDeadline.setDate(upcomingDeadline.getDate() + 7);
    
    const upcomingTodos = await Todo.countDocuments({
      user: userId,
      status: '待办',
      dueDate: { $lte: upcomingDeadline },
      isDeleted: false
    });
    
    res.json({
      success: true,
      stats: {
        statusStats: stats,
        priorityStats: priorityStats,
        upcomingDeadlines: upcomingTodos
      }
    });
  } catch (error) {
    logger.error('获取待办统计失败:', error);
    res.status(500).json({ success: false, message: '获取待办统计失败' });
  }
};
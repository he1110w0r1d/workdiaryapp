const express = require('express');
const router = express.Router();
const Diary = require('../models/Diary');
const Todo = require('../models/Todo');
const Summary = require('../models/Summary');
const logger = require('../utils/logger');
const { apiKeyAuth } = require('../middleware/apiKeyAuth');

router.get('/diaries', apiKeyAuth('diary:read'), async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      search, 
      tags, 
      priority, 
      page = 1, 
      limit = 20,
      sort = 'desc'
    } = req.query;
    
    const query = { user: req.user._id, isDeleted: false };
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.startTime = { $gte: start, $lte: end };
    }
    
    if (search) {
      query.$or = [
        { content: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      query.tags = { $in: tagArray };
    }

    if (priority) {
      query.workPriority = priority;
    }

    const sortOrder = sort === 'asc' ? 1 : -1;
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100);

    const diaries = await Diary.find(query)
      .select('content location startTime endTime tags workPriority isTodo todoStatus createdAt updatedAt')
      .sort({ startTime: sortOrder })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .lean();

    const total = await Diary.countDocuments(query);

    res.json({
      success: true,
      data: {
        diaries,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    logger.error('Public API - Get diaries failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal Server Error',
      message: 'Failed to fetch diaries'
    });
  }
});

router.get('/diaries/:id', apiKeyAuth('diary:read'), async (req, res) => {
  try {
    const diary = await Diary.findOne({
      _id: req.params.id,
      user: req.user._id,
      isDeleted: false
    })
    .select('content location startTime endTime tags workPriority isTodo todoStatus statusDescription createdAt updatedAt')
    .populate('relatedTodo', 'content priority status dueDate')
    .lean();

    if (!diary) {
      return res.status(404).json({ 
        success: false, 
        error: 'Not Found',
        message: 'Diary not found'
      });
    }

    res.json({
      success: true,
      data: diary
    });
  } catch (error) {
    logger.error('Public API - Get diary by ID failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal Server Error',
      message: 'Failed to fetch diary'
    });
  }
});

router.post('/diaries', apiKeyAuth('diary:write'), async (req, res) => {
  try {
    const { content, location, startTime, endTime, tags, workPriority } = req.body;

    if (!content || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'content, startTime, and endTime are required'
      });
    }

    const diary = new Diary({
      user: req.user._id,
      content,
      location: location || '',
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      tags: tags || [],
      workPriority: workPriority || '中',
      isTodo: false
    });

    await diary.save();

    logger.info(`Public API - Diary created by API key: ${req.apiKey.keyPrefix}`);

    res.status(201).json({
      success: true,
      data: {
        id: diary._id,
        content: diary.content,
        location: diary.location,
        startTime: diary.startTime,
        endTime: diary.endTime,
        tags: diary.tags,
        workPriority: diary.workPriority,
        createdAt: diary.createdAt
      }
    });
  } catch (error) {
    logger.error('Public API - Create diary failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal Server Error',
      message: 'Failed to create diary'
    });
  }
});

router.put('/diaries/:id', apiKeyAuth('diary:write'), async (req, res) => {
  try {
    const { content, location, startTime, endTime, tags, workPriority } = req.body;

    const updateData = {};
    if (content !== undefined) updateData.content = content;
    if (location !== undefined) updateData.location = location;
    if (startTime !== undefined) updateData.startTime = new Date(startTime);
    if (endTime !== undefined) updateData.endTime = new Date(endTime);
    if (tags !== undefined) updateData.tags = tags;
    if (workPriority !== undefined) updateData.workPriority = workPriority;
    updateData.updatedAt = Date.now();

    const diary = await Diary.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id, isDeleted: false },
      updateData,
      { new: true }
    ).select('content location startTime endTime tags workPriority isTodo todoStatus createdAt updatedAt');

    if (!diary) {
      return res.status(404).json({ 
        success: false, 
        error: 'Not Found',
        message: 'Diary not found'
      });
    }

    logger.info(`Public API - Diary updated by API key: ${req.apiKey.keyPrefix}`);

    res.json({
      success: true,
      data: diary
    });
  } catch (error) {
    logger.error('Public API - Update diary failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal Server Error',
      message: 'Failed to update diary'
    });
  }
});

router.delete('/diaries/:id', apiKeyAuth('diary:write'), async (req, res) => {
  try {
    const diary = await Diary.findOne({
      _id: req.params.id,
      user: req.user._id,
      isDeleted: false
    });

    if (!diary) {
      return res.status(404).json({ 
        success: false, 
        error: 'Not Found',
        message: 'Diary not found'
      });
    }

    diary.isDeleted = true;
    diary.deletedAt = new Date();
    diary.deletedBy = req.user._id;
    await diary.save();

    logger.info(`Public API - Diary deleted by API key: ${req.apiKey.keyPrefix}`);

    res.json({
      success: true,
      message: 'Diary deleted successfully'
    });
  } catch (error) {
    logger.error('Public API - Delete diary failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal Server Error',
      message: 'Failed to delete diary'
    });
  }
});

router.get('/todos', apiKeyAuth('todo:read'), async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 20, sort = 'desc' } = req.query;
    
    const query = { user: req.user._id, isDeleted: false };
    if (status) query.status = status;
    if (priority) query.priority = priority;

    const sortOrder = sort === 'asc' ? 1 : -1;
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100);

    const todos = await Todo.find(query)
      .select('content priority status dueDate createdAt updatedAt')
      .populate('relatedDiary', 'content startTime')
      .sort({ createdAt: sortOrder })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .lean();

    const total = await Todo.countDocuments(query);

    res.json({
      success: true,
      data: {
        todos,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    logger.error('Public API - Get todos failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal Server Error',
      message: 'Failed to fetch todos'
    });
  }
});

router.post('/todos', apiKeyAuth('todo:write'), async (req, res) => {
  try {
    const { content, priority, dueDate } = req.body;

    if (!content || !dueDate) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'content and dueDate are required'
      });
    }

    const todo = new Todo({
      user: req.user._id,
      content,
      priority: priority || '中',
      dueDate: new Date(dueDate)
    });

    await todo.save();

    logger.info(`Public API - Todo created by API key: ${req.apiKey.keyPrefix}`);

    res.status(201).json({
      success: true,
      data: {
        id: todo._id,
        content: todo.content,
        priority: todo.priority,
        status: todo.status,
        dueDate: todo.dueDate,
        createdAt: todo.createdAt
      }
    });
  } catch (error) {
    logger.error('Public API - Create todo failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal Server Error',
      message: 'Failed to create todo'
    });
  }
});

router.put('/todos/:id/status', apiKeyAuth('todo:write'), async (req, res) => {
  try {
    const { status, reason } = req.body;

    const validStatuses = ['待办', '已完成', '已放弃', '已转交'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const todo = await Todo.findOne({ _id: req.params.id, user: req.user._id, isDeleted: false });
    if (!todo) {
      return res.status(404).json({ 
        success: false, 
        error: 'Not Found',
        message: 'Todo not found'
      });
    }

    const statusChange = {
      status,
      reason: reason || '',
      changedAt: new Date()
    };

    todo.status = status;
    todo.statusHistory.push(statusChange);
    await todo.save();

    if (todo.relatedDiary) {
      await Diary.findByIdAndUpdate(todo.relatedDiary, { todoStatus: status });
    }

    logger.info(`Public API - Todo status updated by API key: ${req.apiKey.keyPrefix}`);

    res.json({
      success: true,
      data: {
        id: todo._id,
        status: todo.status,
        statusHistory: todo.statusHistory
      }
    });
  } catch (error) {
    logger.error('Public API - Update todo status failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal Server Error',
      message: 'Failed to update todo status'
    });
  }
});

router.get('/summaries', apiKeyAuth('summary:read'), async (req, res) => {
  try {
    const { type, page = 1, limit = 10 } = req.query;
    
    const query = { user: req.user._id };
    if (type && ['daily', 'weekly', 'monthly', 'yearly'].includes(type)) {
      query.type = type;
    }

    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 50);

    const summaries = await Summary.find(query)
      .select('type date content statistics isRead createdAt')
      .sort({ date: -1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .lean();

    const total = await Summary.countDocuments(query);

    res.json({
      success: true,
      data: {
        summaries,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    logger.error('Public API - Get summaries failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal Server Error',
      message: 'Failed to fetch summaries'
    });
  }
});

router.get('/summaries/:id', apiKeyAuth('summary:read'), async (req, res) => {
  try {
    const summary = await Summary.findOne({
      _id: req.params.id,
      user: req.user._id
    })
    .select('type date content statistics meta isRead readAt createdAt')
    .lean();

    if (!summary) {
      return res.status(404).json({ 
        success: false, 
        error: 'Not Found',
        message: 'Summary not found'
      });
    }

    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    logger.error('Public API - Get summary by ID failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal Server Error',
      message: 'Failed to fetch summary'
    });
  }
});

router.get('/tags', apiKeyAuth('diary:read'), async (req, res) => {
  try {
    const tags = await Diary.distinct('tags', { 
      user: req.user._id, 
      isDeleted: false,
      tags: { $exists: true, $ne: [] }
    });
    
    res.json({
      success: true,
      data: {
        tags: tags.filter(tag => tag && tag.trim() !== '')
      }
    });
  } catch (error) {
    logger.error('Public API - Get tags failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal Server Error',
      message: 'Failed to fetch tags'
    });
  }
});

router.get('/stats', apiKeyAuth('diary:read'), async (req, res) => {
  try {
    const userId = req.user._id;

    const diaryCount = await Diary.countDocuments({ user: userId, isDeleted: false });
    
    const todoStats = await Todo.aggregate([
      { $match: { user: userId, isDeleted: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const summaryCount = await Summary.countDocuments({ user: userId });

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    
    const thisMonthDiaries = await Diary.countDocuments({
      user: userId,
      isDeleted: false,
      startTime: { $gte: thisMonth }
    });

    res.json({
      success: true,
      data: {
        diaries: {
          total: diaryCount,
          thisMonth: thisMonthDiaries
        },
        todos: todoStats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        summaries: summaryCount
      }
    });
  } catch (error) {
    logger.error('Public API - Get stats failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal Server Error',
      message: 'Failed to fetch statistics'
    });
  }
});

module.exports = router;

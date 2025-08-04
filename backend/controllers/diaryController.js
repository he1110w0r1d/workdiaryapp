const Diary = require('../models/Diary');
const Todo = require('../models/Todo');

const logger = require('../utils/logger');
exports.createDiary = async (req, res) => {
  try {
    const { content, location, startTime, endTime, tags, workPriority, isTodo, todoDueDate } = req.body;
    
    const diary = new Diary({
      user: req.user.id,
      content,
      location,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      tags: tags || [],
      workPriority: workPriority || '中',
      isTodo: isTodo || false
    });

    await diary.save();
    
    // 如果设置为待办，创建对应的待办项
    if (isTodo && todoDueDate) {
      const todo = new Todo({
        user: req.user.id,
        content: content,
        priority: workPriority || '中',
        dueDate: new Date(todoDueDate),
        relatedDiary: diary._id
      });
      
      await todo.save();
      
      // 更新日记关联的待办项
      diary.relatedTodo = todo._id;
      await diary.save();
      
      logger.info(`用户 ${req.user.id} 创建了日记并设置为待办: ${content}`);
    }
    
    res.status(201).json(diary);
  } catch (error) {
    logger.error('创建日记失败:', error);
    res.status(400).json({ message: error.message });
  }
};

exports.getDiaries = async (req, res) => {
  try {
    const { startDate, endDate, search, page = 1, limit = 10 } = req.query;
    
    let query = { user: req.user.id };
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      // 设置结束日期为当天的23:59:59.999
      end.setHours(23, 59, 59, 999);
      
      query.startTime = {
        $gte: start,
        $lte: end
      };
    }
    
    if (search) {
      query.$or = [
        { content: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const diaries = await Diary.find(query)
      .sort({ startTime: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Diary.countDocuments(query);

    res.json({
      diaries,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getDiaryById = async (req, res) => {
  try {
    const diary = await Diary.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!diary) {
      return res.status(404).json({ message: '日记未找到' });
    }

    res.json(diary);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateDiary = async (req, res) => {
  try {
    const { content, location, startTime, endTime, tags, workPriority, isTodo, todoDueDate } = req.body;
    
    // 准备更新数据
    const updateData = {
      content,
      location,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      tags: tags || [],
      workPriority: workPriority !== undefined ? workPriority : '中',
      updatedAt: Date.now()
    };
    
    // 处理待办相关字段
    if (isTodo !== undefined) {
      updateData.isTodo = isTodo;
      if (isTodo && todoDueDate) {
        updateData.todoDueDate = new Date(todoDueDate);
      } else if (!isTodo) {
        updateData.todoDueDate = null;
      }
    }
    
    const diary = await Diary.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      updateData,
      { new: true }
    );
    
    // 如果日记从待办状态改为非待办状态，需要删除关联的待办项
    if (diary && diary.relatedTodo && !isTodo) {
      await Todo.findByIdAndDelete(diary.relatedTodo);
      diary.relatedTodo = null;
      await diary.save();
      logger.info(`日记编辑时删除了关联的待办项: ${diary.relatedTodo}`);
    }
    
    // 如果日记从非待办状态改为待办状态，需要创建新的待办项
    if (diary && isTodo && !diary.relatedTodo && todoDueDate) {
      const todo = new Todo({
        user: req.user.id,
        content: content,
        priority: workPriority || '中',
        dueDate: new Date(todoDueDate),
        relatedDiary: diary._id
      });
      
      await todo.save();
      diary.relatedTodo = todo._id;
      await diary.save();
      logger.info(`日记编辑时创建了新的待办项: ${todo._id}`);
    }
    
    // 如果是待办日记且已有关联待办项，更新待办项内容
    if (diary && isTodo && diary.relatedTodo && todoDueDate) {
      const todoUpdateData = {
        content: content,
        priority: workPriority || '中',
        dueDate: new Date(todoDueDate)
      };
      
      await Todo.findByIdAndUpdate(diary.relatedTodo, todoUpdateData);
      logger.info(`日记编辑时更新了关联的待办项: ${diary.relatedTodo}`);
    }

    if (!diary) {
      return res.status(404).json({ message: '日记未找到' });
    }

    res.json(diary);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteDiary = async (req, res) => {
  try {
    const diary = await Diary.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!diary) {
      return res.status(404).json({ message: '日记未找到' });
    }

    // 如果日记有关联的待办项，先删除待办项
    if (diary.relatedTodo) {
      await Todo.findByIdAndDelete(diary.relatedTodo);
      logger.info(`删除日记时同时删除了关联的待办项: ${diary.relatedTodo}`);
    }

    // 删除日记
    await Diary.findByIdAndDelete(diary._id);

    logger.info(`用户 ${req.user.id} 删除了日记: ${diary._id}`);
    res.json({ message: '日记删除成功' });
  } catch (error) {
    logger.error('删除日记失败:', error);
    res.status(500).json({ message: error.message });
  }
};

// 更新日记的待办状态
exports.updateTodoStatus = async (req, res) => {
  try {
    const { todoStatus, statusDescription } = req.body;
    
    // 验证状态值
    const validStatuses = ['待办', '已完成', '已放弃', '已转交'];
    if (!validStatuses.includes(todoStatus)) {
      return res.status(400).json({ message: '无效的待办状态' });
    }
    
    const updateData = { todoStatus };
    if (statusDescription) {
      updateData.statusDescription = statusDescription;
    }
    
    const diary = await Diary.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id, isTodo: true },
      updateData,
      { new: true }
    );

    if (!diary) {
      return res.status(404).json({ message: '待办日记未找到' });
    }

    // 如果有关联的待办项，也更新待办项的状态
    if (diary.relatedTodo) {
      const todoUpdateData = { status: todoStatus };
      if (statusDescription) {
        // 添加状态变更记录到待办项
        const todo = await Todo.findById(diary.relatedTodo);
        if (todo) {
          const statusChange = {
            status: todoStatus,
            reason: statusDescription,
            changedAt: new Date()
          };
          todo.statusHistory.push(statusChange);
          todo.status = todoStatus;
          await todo.save();
        }
      } else {
        await Todo.findByIdAndUpdate(diary.relatedTodo, todoUpdateData);
      }
    }

    logger.info(`用户 ${req.user.id} 更新了日记待办状态: ${diary._id} -> ${todoStatus}`);
    res.json({ success: true, diary });
  } catch (error) {
    logger.error('更新日记待办状态失败:', error);
    res.status(500).json({ message: error.message });
  }
};
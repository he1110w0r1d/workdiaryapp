const Diary = require('../models/Diary');
const Todo = require('../models/Todo');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const logger = require('../utils/logger');

// 配置multer用于文件上传
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/json' || path.extname(file.originalname).toLowerCase() === '.json') {
      cb(null, true);
    } else {
      cb(new Error('只支持JSON格式文件'), false);
    }
  }
});

exports.uploadMiddleware = upload.single('file');
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
    const { startDate, endDate, search, tags, priority, todoStatus, page = 1, limit = 10 } = req.query;
    
    let query = { user: req.user.id, isDeleted: false };
    
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

    // 标签筛选
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      query.tags = { $in: tagArray };
    }

    // 优先级筛选
    if (priority) {
      query.workPriority = priority;
    }

    // 待办状态筛选
    if (todoStatus) {
      query.todoStatus = todoStatus;
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
      user: req.user.id,
      isDeleted: false
    }).populate('relatedTodo');

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
      { _id: req.params.id, user: req.user.id, isDeleted: false },
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

// 软删除日记
exports.deleteDiary = async (req, res) => {
  try {
    const diary = await Diary.findOne({
      _id: req.params.id,
      user: req.user.id,
      isDeleted: false
    });

    if (!diary) {
      return res.status(404).json({ message: '日记未找到' });
    }

    // 软删除日记
    diary.isDeleted = true;
    diary.deletedAt = new Date();
    diary.deletedBy = req.user.id;
    await diary.save();

    // 如果日记有关联的待办项，也软删除待办项
    if (diary.relatedTodo) {
      await Todo.findByIdAndUpdate(diary.relatedTodo, {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: req.user.id
      });
      logger.info(`软删除日记时同时软删除了关联的待办项: ${diary.relatedTodo}`);
    }

    logger.info(`用户 ${req.user.id} 软删除了日记: ${diary._id}`);
    res.json({ message: '日记已移至回收站' });
  } catch (error) {
    logger.error('删除日记失败:', error);
    res.status(500).json({ message: error.message });
  }
};

// 获取回收站中的日记
exports.getDeletedDiaries = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const deletedDiaries = await Diary.find({
      user: req.user.id,
      isDeleted: true
    })
    .sort({ deletedAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('relatedTodo');

    const total = await Diary.countDocuments({
      user: req.user.id,
      isDeleted: true
    });

    res.json({
      diaries: deletedDiaries,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    logger.error('获取回收站日记失败:', error);
    res.status(500).json({ message: error.message });
  }
};

// 恢复日记
exports.restoreDiary = async (req, res) => {
  try {
    const diary = await Diary.findOne({
      _id: req.params.id,
      user: req.user.id,
      isDeleted: true
    });

    if (!diary) {
      return res.status(404).json({ message: '已删除的日记未找到' });
    }

    // 恢复日记
    diary.isDeleted = false;
    diary.deletedAt = null;
    diary.deletedBy = null;
    await diary.save();

    // 如果日记有关联的待办项，也恢复待办项
    if (diary.relatedTodo) {
      await Todo.findByIdAndUpdate(diary.relatedTodo, {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null
      });
      logger.info(`恢复日记时同时恢复了关联的待办项: ${diary.relatedTodo}`);
    }

    logger.info(`用户 ${req.user.id} 恢复了日记: ${diary._id}`);
    res.json({ message: '日记恢复成功', diary });
  } catch (error) {
    logger.error('恢复日记失败:', error);
    res.status(500).json({ message: error.message });
  }
};

// 永久删除日记
exports.permanentDeleteDiary = async (req, res) => {
  try {
    const diary = await Diary.findOne({
      _id: req.params.id,
      user: req.user.id,
      isDeleted: true
    });

    if (!diary) {
      return res.status(404).json({ message: '已删除的日记未找到' });
    }

    // 如果日记有关联的待办项，永久删除待办项
    if (diary.relatedTodo) {
      await Todo.findByIdAndDelete(diary.relatedTodo);
      logger.info(`永久删除日记时同时永久删除了关联的待办项: ${diary.relatedTodo}`);
    }

    // 永久删除日记
    await Diary.findByIdAndDelete(diary._id);

    logger.info(`用户 ${req.user.id} 永久删除了日记: ${diary._id}`);
    res.json({ message: '日记已永久删除' });
  } catch (error) {
    logger.error('永久删除日记失败:', error);
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
    logger.error('更新待办状态失败:', error);
    res.status(500).json({ message: error.message });
  }
};

// 获取用户的所有可用标签
exports.getAvailableTags = async (req, res) => {
  try {
    const tags = await Diary.distinct('tags', { 
      user: req.user.id, 
      isDeleted: false,
      tags: { $exists: true, $ne: [] }
    });
    
    res.json({ tags: tags.filter(tag => tag && tag.trim() !== '') });
  } catch (error) {
    logger.error('获取可用标签失败:', error);
    res.status(500).json({ message: error.message });
  }
};

// 导出日记
exports.exportDiaries = async (req, res) => {
  try {
    logger.info('开始导出日记', { userId: req.user.id, query: req.query });
    const { startDate, endDate, search, tags, priority, todoStatus } = req.query;
    
    let query = { user: req.user.id, isDeleted: false };
    
    // 应用筛选条件
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
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

    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      query.tags = { $in: tagArray };
    }

    if (priority) {
      query.workPriority = priority;
    }

    if (todoStatus) {
      query.todoStatus = todoStatus;
    }

    const diaries = await Diary.find(query)
      .populate('relatedTodo')
      .sort({ startTime: -1 })
      .exec();

    // 清理字符串中的无效字符
    const cleanString = (str) => {
      if (!str) return str;
      try {
        // 移除或替换可能导致JSON解析错误的字符
        let cleaned = str
          // 移除控制字符
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
          // 移除可能的BOM字符
          .replace(/\uFEFF/g, '')
          // 移除其他可能有问题的Unicode字符
          .replace(/[\uFFF0-\uFFFF]/g, '')
          // 确保字符串是有效的UTF-8
          .replace(/[\uD800-\uDFFF]/g, '');
        
        // 测试字符串是否可以安全地JSON序列化
        JSON.stringify(cleaned);
        return cleaned;
      } catch (error) {
        // 如果仍然有问题，返回安全的替代文本
        logger.warn('字符串清理失败，使用安全替代:', { original: str.substring(0, 100), error: error.message });
        return '[内容包含无效字符，已清理]';
      }
    };

    // 准备导出数据
    const exportData = {
      exportInfo: {
        exportDate: new Date().toISOString(),
        totalCount: diaries.length,
        filters: {
          startDate,
          endDate,
          search,
          tags,
          priority,
          todoStatus
        }
      },
      diaries: diaries.map(diary => ({
        content: cleanString(diary.content),
        location: cleanString(diary.location),
        startTime: diary.startTime,
        endTime: diary.endTime,
        tags: diary.tags ? diary.tags.map(tag => cleanString(tag)) : [],
        workPriority: diary.workPriority,
        isTodo: diary.isTodo,
        todoStatus: diary.todoStatus,
        statusDescription: cleanString(diary.statusDescription),
        createdAt: diary.createdAt,
        updatedAt: diary.updatedAt,
        relatedTodo: diary.relatedTodo ? {
          content: cleanString(diary.relatedTodo.content),
          priority: diary.relatedTodo.priority,
          status: diary.relatedTodo.status,
          dueDate: diary.relatedTodo.dueDate,
          statusHistory: diary.relatedTodo.statusHistory
        } : null
      }))
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="工作日记导出_${new Date().toISOString().split('T')[0]}.json"`);
    
    logger.info(`用户 ${req.user.id} 导出了 ${diaries.length} 条日记`);
    res.json(exportData);
  } catch (error) {
    logger.error('导出日记失败:', error);
    res.status(500).json({ message: error.message });
  }
};

// 导入日记
exports.importDiaries = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '请选择要导入的文件' });
    }

    let importData;
    try {
      const fileContent = req.file.buffer.toString('utf8');
      importData = JSON.parse(fileContent);
    } catch (parseError) {
      return res.status(400).json({ message: '文件格式错误，请确保是有效的JSON文件' });
    }

    // 验证数据结构
    if (!importData.diaries || !Array.isArray(importData.diaries)) {
      return res.status(400).json({ message: '文件格式错误，缺少diaries数组' });
    }

    let importedCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const diaryData of importData.diaries) {
      try {
        // 验证必需字段
        if (!diaryData.content || !diaryData.startTime || !diaryData.endTime) {
          errors.push(`跳过无效日记：缺少必需字段`);
          skippedCount++;
          continue;
        }

        // 检查是否已存在相同的日记（基于内容和时间）
        const existingDiary = await Diary.findOne({
          user: req.user.id,
          content: diaryData.content,
          startTime: new Date(diaryData.startTime),
          isDeleted: false
        });

        if (existingDiary) {
          skippedCount++;
          continue;
        }

        // 创建新日记
        const newDiary = new Diary({
          user: req.user.id,
          content: diaryData.content,
          location: diaryData.location || '',
          startTime: new Date(diaryData.startTime),
          endTime: new Date(diaryData.endTime),
          tags: diaryData.tags || [],
          workPriority: diaryData.workPriority || '中',
          isTodo: diaryData.isTodo || false,
          todoStatus: diaryData.todoStatus || '待办',
          statusDescription: diaryData.statusDescription || ''
        });

        await newDiary.save();

        // 如果是待办日记且有相关待办数据，创建待办项
        if (diaryData.isTodo && diaryData.relatedTodo) {
          const newTodo = new Todo({
            user: req.user.id,
            content: diaryData.relatedTodo.content || diaryData.content,
            priority: diaryData.relatedTodo.priority || diaryData.workPriority || '中',
            status: diaryData.relatedTodo.status || '待办',
            dueDate: diaryData.relatedTodo.dueDate ? new Date(diaryData.relatedTodo.dueDate) : new Date(),
            relatedDiary: newDiary._id,
            statusHistory: diaryData.relatedTodo.statusHistory || []
          });

          await newTodo.save();
          
          // 更新日记关联的待办项
          newDiary.relatedTodo = newTodo._id;
          await newDiary.save();
        }

        importedCount++;
      } catch (itemError) {
        errors.push(`导入日记失败：${itemError.message}`);
        skippedCount++;
      }
    }

    logger.info(`用户 ${req.user.id} 导入了 ${importedCount} 条日记，跳过 ${skippedCount} 条`);
    
    res.json({
      success: true,
      importedCount,
      skippedCount,
      totalProcessed: importData.diaries.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : [] // 最多返回10个错误
    });
  } catch (error) {
    logger.error('导入日记失败:', error);
    res.status(500).json({ message: error.message });
  }
};
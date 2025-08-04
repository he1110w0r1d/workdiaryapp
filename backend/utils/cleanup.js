const cron = require('node-cron');
const Diary = require('../models/Diary');
const Todo = require('../models/Todo');
const logger = require('./logger');

// 每天凌晨2点执行清理任务
const scheduleCleanup = () => {
  cron.schedule('0 2 * * *', async () => {
    try {
      logger.info('开始执行定时清理任务...');
      
      // 计算30天前的日期
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      // 查找需要永久删除的日记
      const diariesToDelete = await Diary.find({
        isDeleted: true,
        deletedAt: { $lte: thirtyDaysAgo }
      });
      
      // 查找需要永久删除的待办项
      const todosToDelete = await Todo.find({
        isDeleted: true,
        deletedAt: { $lte: thirtyDaysAgo }
      });
      
      // 永久删除日记
      if (diariesToDelete.length > 0) {
        const diaryIds = diariesToDelete.map(diary => diary._id);
        await Diary.deleteMany({ _id: { $in: diaryIds } });
        logger.info(`永久删除了 ${diariesToDelete.length} 条日记记录`);
      }
      
      // 永久删除待办项
      if (todosToDelete.length > 0) {
        const todoIds = todosToDelete.map(todo => todo._id);
        await Todo.deleteMany({ _id: { $in: todoIds } });
        logger.info(`永久删除了 ${todosToDelete.length} 条待办记录`);
      }
      
      if (diariesToDelete.length === 0 && todosToDelete.length === 0) {
        logger.info('没有需要清理的记录');
      }
      
      logger.info('定时清理任务执行完成');
    } catch (error) {
      logger.error('定时清理任务执行失败:', error);
    }
  });
  
  logger.info('定时清理任务已启动，每天凌晨2点执行');
};

// 手动执行清理任务（用于测试）
const manualCleanup = async () => {
  try {
    logger.info('开始执行手动清理任务...');
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const diariesToDelete = await Diary.find({
      isDeleted: true,
      deletedAt: { $lte: thirtyDaysAgo }
    });
    
    const todosToDelete = await Todo.find({
      isDeleted: true,
      deletedAt: { $lte: thirtyDaysAgo }
    });
    
    if (diariesToDelete.length > 0) {
      const diaryIds = diariesToDelete.map(diary => diary._id);
      await Diary.deleteMany({ _id: { $in: diaryIds } });
      logger.info(`手动清理：永久删除了 ${diariesToDelete.length} 条日记记录`);
    }
    
    if (todosToDelete.length > 0) {
      const todoIds = todosToDelete.map(todo => todo._id);
      await Todo.deleteMany({ _id: { $in: todoIds } });
      logger.info(`手动清理：永久删除了 ${todosToDelete.length} 条待办记录`);
    }
    
    return {
      deletedDiaries: diariesToDelete.length,
      deletedTodos: todosToDelete.length
    };
  } catch (error) {
    logger.error('手动清理任务执行失败:', error);
    throw error;
  }
};

module.exports = {
  scheduleCleanup,
  manualCleanup
};
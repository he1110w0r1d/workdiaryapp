const mongoose = require('mongoose');
const User = require('../models/User');
const Diary = require('../models/Diary');
const Summary = require('../models/Summary');

const logger = require('../utils/logger');
// 连接数据库
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/workdiary')
  .then(async () => {
    logger.info('数据库连接成功');
    
    try {
      // 查找要保留的用户
      const keepUser = await User.findOne({ username: 'shenchun' });
      if (!keepUser) {
        logger.user('未找到用户 shenchun，操作取消');
        return;
      }
      
      logger.info(`保留用户: ${keepUser.username} (${keepUser.email})`);
      
      // 查找要删除的用户
      const usersToDelete = await User.find({ username: { $ne: 'shenchun' } });
      logger.info(`\n准备删除 ${usersToDelete.length} 个用户:`);
      
      const userIdsToDelete = [];
      usersToDelete.forEach((user, index) => {
        logger.info(`${index + 1}. ${user.username} (${user.email})`);
        userIdsToDelete.push(user._id);
      });
      
      if (userIdsToDelete.length === 0) {
        logger.user('没有需要删除的用户');
        return;
      }
      
      // 删除相关的日记记录
      const diaryDeleteResult = await Diary.deleteMany({ userId: { $in: userIdsToDelete } });
      logger.info(`\n删除了 ${diaryDeleteResult.deletedCount} 条日记记录`);
      
      // 删除相关的总结记录
      const summaryDeleteResult = await Summary.deleteMany({ userId: { $in: userIdsToDelete } });
      logger.info(`删除了 ${summaryDeleteResult.deletedCount} 条总结记录`);
      
      // 删除用户账户
      const userDeleteResult = await User.deleteMany({ _id: { $in: userIdsToDelete } });
      logger.info(`删除了 ${userDeleteResult.deletedCount} 个用户账户`);
      
      // 验证结果
      const remainingUsers = await User.countDocuments();
      logger.info(`\n清理完成！数据库中剩余 ${remainingUsers} 个用户`);
      
      const finalUser = await User.findOne({ username: 'shenchun' });
      if (finalUser) {
        logger.info(`保留的用户: ${finalUser.username} (${finalUser.email})`);
      }
      
    } catch (error) {
      logger.error('清理用户失败:', error);
    } finally {
      mongoose.connection.close();
      logger.info('\n数据库连接已关闭');
    }
  })
  .catch(err => {
    logger.error('数据库连接失败:', err);
    process.exit(1);
  });
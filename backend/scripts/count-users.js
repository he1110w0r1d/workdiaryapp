const mongoose = require('mongoose');
const User = require('../models/User');

const logger = require('../utils/logger');
// 连接数据库
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/workdiary')
  .then(async () => {
    logger.info('数据库连接成功');
    
    try {
      // 统计用户数量
      const userCount = await User.countDocuments();
      logger.info(`数据库中共有 ${userCount} 个用户账户`);
      
      // 获取所有用户的基本信息
      const users = await User.find({}, 'username email nickname createdAt').sort({ createdAt: -1 });
      logger.user('\n用户列表:');
      users.forEach((user, index) => {
        logger.info(`${index + 1}. 用户名: ${user.username}, 邮箱: ${user.email}, 昵称: ${user.nickname || '未设置'}, 创建时间: ${user.createdAt.toLocaleDateString()}`);
      });
      
    } catch (error) {
      logger.error('查询用户失败:', error);
    } finally {
      mongoose.connection.close();
      logger.info('\n数据库连接已关闭');
    }
  })
  .catch(err => {
    logger.error('数据库连接失败:', err);
    process.exit(1);
  });
const mongoose = require('mongoose');
require('dotenv').config();

// 连接数据库
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/workdiary', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const Summary = require('../models/Summary');

async function migrateIsReadField() {
  try {
    console.log('开始迁移总结的isRead字段...');
    
    // 查找所有没有isRead字段的总结
    const summariesWithoutIsRead = await Summary.find({
      $or: [
        { isRead: { $exists: false } },
        { isRead: null }
      ]
    });
    
    console.log(`找到 ${summariesWithoutIsRead.length} 个需要更新的总结`);
    
    if (summariesWithoutIsRead.length === 0) {
      console.log('所有总结都已经有isRead字段，无需迁移');
      return;
    }
    
    // 批量更新所有总结，设置isRead为true，readAt为当前时间
    const result = await Summary.updateMany(
      {
        $or: [
          { isRead: { $exists: false } },
          { isRead: null }
        ]
      },
      {
        $set: {
          isRead: true,
          readAt: new Date()
        }
      }
    );
    
    console.log(`成功更新了 ${result.modifiedCount} 个总结的isRead字段`);
    console.log('迁移完成！');
    
  } catch (error) {
    console.error('迁移过程中出现错误:', error);
  } finally {
    // 关闭数据库连接
    await mongoose.connection.close();
    console.log('数据库连接已关闭');
  }
}

// 执行迁移
migrateIsReadField();
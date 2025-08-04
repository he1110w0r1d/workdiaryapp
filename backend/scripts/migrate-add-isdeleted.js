const mongoose = require('mongoose');
const Diary = require('../models/Diary');
require('dotenv').config();

// 连接数据库
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/workdiary', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function migrateAddIsDeleted() {
  try {
    console.log('开始迁移：为现有日记添加 isDeleted 字段...');
    
    // 查找所有没有 isDeleted 字段的日记
    const diariesWithoutIsDeleted = await Diary.find({
      isDeleted: { $exists: false }
    });
    
    console.log(`找到 ${diariesWithoutIsDeleted.length} 条需要更新的日记`);
    
    if (diariesWithoutIsDeleted.length === 0) {
      console.log('所有日记都已经有 isDeleted 字段，无需迁移');
      return;
    }
    
    // 批量更新所有没有 isDeleted 字段的日记
    const result = await Diary.updateMany(
      { isDeleted: { $exists: false } },
      { 
        $set: { 
          isDeleted: false,
          deletedAt: null,
          deletedBy: null
        } 
      }
    );
    
    console.log(`成功更新了 ${result.modifiedCount} 条日记`);
    console.log('迁移完成！');
    
  } catch (error) {
    console.error('迁移过程中发生错误:', error);
  } finally {
    // 关闭数据库连接
    await mongoose.connection.close();
    console.log('数据库连接已关闭');
  }
}

// 执行迁移
migrateAddIsDeleted();
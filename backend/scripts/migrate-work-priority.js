const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Diary = require('../models/Diary');

// 加载环境变量
dotenv.config({ path: '../.env' });

// 数据迁移脚本：为缺少workPriority字段的日记条目添加默认值
async function migrateWorkPriority() {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/workdiary', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('已连接到MongoDB数据库');
    
    // 查找所有缺少workPriority字段的日记条目
    const diariesWithoutPriority = await Diary.find({
      workPriority: { $exists: false }
    });
    
    console.log(`找到 ${diariesWithoutPriority.length} 个缺少workPriority字段的日记条目`);
    
    if (diariesWithoutPriority.length === 0) {
      console.log('所有日记条目都已包含workPriority字段，无需迁移');
      return;
    }
    
    // 批量更新，为这些条目添加默认的workPriority值
    const result = await Diary.updateMany(
      { workPriority: { $exists: false } },
      { $set: { workPriority: '中' } }
    );
    
    console.log(`成功更新了 ${result.modifiedCount} 个日记条目，添加了默认优先级'中'`);
    
    // 验证更新结果
    const remainingWithoutPriority = await Diary.countDocuments({
      workPriority: { $exists: false }
    });
    
    if (remainingWithoutPriority === 0) {
      console.log('✅ 数据迁移完成！所有日记条目现在都包含workPriority字段');
    } else {
      console.log(`⚠️  仍有 ${remainingWithoutPriority} 个条目缺少workPriority字段`);
    }
    
  } catch (error) {
    console.error('数据迁移失败:', error);
  } finally {
    // 关闭数据库连接
    await mongoose.connection.close();
    console.log('数据库连接已关闭');
  }
}

// 执行迁移
if (require.main === module) {
  migrateWorkPriority();
}

module.exports = migrateWorkPriority;
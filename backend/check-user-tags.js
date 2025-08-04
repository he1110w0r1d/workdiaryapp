// 检查用户自定义标签的脚本
const mongoose = require('mongoose');
const User = require('./models/User');

async function checkUserTags() {
  try {
    // 连接数据库
    await mongoose.connect('mongodb://localhost:27017/workdiary', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('数据库连接成功');
    
    // 查找test@example.com用户
    const user = await User.findOne({ email: 'test@example.com' });
    if (user) {
      console.log('用户信息:');
      console.log('- 用户名:', user.username);
      console.log('- 邮箱:', user.email);
      console.log('- 自定义标签:', user.workProfile?.customTags || []);
      console.log('- 工作配置:', user.workProfile);
      console.log('- 更新时间:', user.updatedAt);
    } else {
      console.log('未找到test@example.com用户');
    }
    
    // 关闭连接
    await mongoose.connection.close();
    console.log('数据库连接已关闭');
  } catch (error) {
    console.error('检查失败:', error);
  }
}

checkUserTags();
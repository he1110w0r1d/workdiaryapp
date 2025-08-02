// MongoDB数据库备份脚本
// 使用MongoDB shell连接并导出数据

// 连接到workdiary数据库
use('workdiary');

// 导出用户数据
print('正在导出用户数据...');
const users = db.users.find().toArray();
print('用户数据导出完成，共 ' + users.length + ' 条记录');

// 导出日记数据
print('正在导出日记数据...');
const diaries = db.diaries.find().toArray();
print('日记数据导出完成，共 ' + diaries.length + ' 条记录');

// 导出总结数据
print('正在导出总结数据...');
const summaries = db.summaries.find().toArray();
print('总结数据导出完成，共 ' + summaries.length + ' 条记录');

// 创建备份对象
const backup = {
  exportDate: new Date(),
  database: 'workdiary',
  collections: {
    users: users,
    diaries: diaries,
    summaries: summaries
  },
  stats: {
    usersCount: users.length,
    diariesCount: diaries.length,
    summariesCount: summaries.length
  }
};

print('\n=== 备份统计 ===');
print('导出时间: ' + backup.exportDate);
print('用户数量: ' + backup.stats.usersCount);
print('日记数量: ' + backup.stats.diariesCount);
print('总结数量: ' + backup.stats.summariesCount);
print('\n备份完成！数据已保存到内存中。');
print('请将此脚本的输出保存为JSON文件。');

// 输出JSON格式的备份数据
print('\n=== JSON备份数据开始 ===');
print(JSON.stringify(backup, null, 2));
print('=== JSON备份数据结束 ===');
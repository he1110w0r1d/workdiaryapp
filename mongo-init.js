// MongoDB 初始化脚本
// 创建应用数据库和用户

db = db.getSiblingDB('workdiary');

// 创建应用用户
db.createUser({
  user: 'workdiaryuser',
  pwd: 'workdiarypass123',
  roles: [
    {
      role: 'readWrite',
      db: 'workdiary'
    }
  ]
});

// 创建基础集合
db.createCollection('users');
db.createCollection('diaries');
db.createCollection('summaries');

print('Database initialized successfully!');
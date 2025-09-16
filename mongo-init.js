// MongoDB 初始化脚本
// 创建应用数据库和用户

db = db.getSiblingDB('workdiary');

// 创建admin用户（与docker-compose.yml中定义的root用户一致）
db.createUser({
  user: 'admin',
  pwd: 'adminpassword123',
  roles: [
    {
      role: 'readWrite',
      db: 'workdiary'
    },
    {
      role: 'dbAdmin',
      db: 'workdiary'
    }
  ]
});

// 创建基础集合
db.createCollection('users');
db.createCollection('diaries');
db.createCollection('summaries');

print('Database initialized successfully!');
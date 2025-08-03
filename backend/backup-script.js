const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const logger = require('../utils/logger');
// MongoDB连接配置
const MONGODB_URI = 'mongodb://localhost:27017';
const DATABASE_NAME = 'workdiary';
const BACKUP_DIR = './backup';

async function backupDatabase() {
  let client;
  
  try {
    logger.info('正在连接MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(DATABASE_NAME);
    logger.info(`已连接到数据库: ${DATABASE_NAME}`);
    
    // 创建备份目录
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      logger.info(`创建备份目录: ${BACKUP_DIR}`);
    }
    
    // 获取所有集合
    const collections = await db.listCollections().toArray();
    logger.info(`发现 ${collections.length} 个集合`);
    
    const backup = {
      exportDate: new Date().toISOString(),
      database: DATABASE_NAME,
      collections: {},
      stats: {}
    };
    
    // 备份每个集合
    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      logger.info(`正在备份集合: ${collectionName}`);
      
      const collection = db.collection(collectionName);
      const documents = await collection.find({}).toArray();
      
      backup.collections[collectionName] = documents;
      backup.stats[collectionName + 'Count'] = documents.length;
      
      logger.info(`${collectionName}: ${documents.length} 条记录`);
      
      // 单独保存每个集合
      const collectionFile = path.join(BACKUP_DIR, `${collectionName}.json`);
      fs.writeFileSync(collectionFile, JSON.stringify(documents, null, 2), 'utf8');
      logger.info(`已保存: ${collectionFile}`);
    }
    
    // 保存完整备份
    const backupFile = path.join(BACKUP_DIR, `workdiary-backup-${new Date().toISOString().split('T')[0]}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), 'utf8');
    
    logger.system('\n=== 备份完成 ===');
    logger.info(`备份时间: ${backup.exportDate}`);
    logger.info(`备份位置: ${path.resolve(BACKUP_DIR)}`);
    logger.info(`完整备份文件: ${backupFile}`);
    
    Object.keys(backup.stats).forEach(key => {
      logger.info(`${key}: ${backup.stats[key]}`);
    });
    
  } catch (error) {
    logger.error('备份失败:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      logger.info('\nMongoDB连接已关闭');
    }
  }
}

// 运行备份
backupDatabase();
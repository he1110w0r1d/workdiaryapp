const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// MongoDB连接配置
const MONGODB_URI = 'mongodb://localhost:27017';
const DATABASE_NAME = 'workdiary';
const BACKUP_DIR = './backup';

async function restoreDatabase() {
  let client;
  
  try {
    console.log('正在连接MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(DATABASE_NAME);
    console.log(`已连接到数据库: ${DATABASE_NAME}`);
    
    // 检查备份目录
    if (!fs.existsSync(BACKUP_DIR)) {
      throw new Error(`备份目录不存在: ${BACKUP_DIR}`);
    }
    
    // 获取备份文件列表
    const backupFiles = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.endsWith('.json') && !file.includes('workdiary-backup'))
      .map(file => file.replace('.json', ''));
    
    console.log(`发现备份集合: ${backupFiles.join(', ')}`);
    
    let totalRestored = 0;
    
    // 恢复每个集合
    for (const collectionName of backupFiles) {
      console.log(`\n正在恢复集合: ${collectionName}`);
      
      const backupFile = path.join(BACKUP_DIR, `${collectionName}.json`);
      const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
      
      if (backupData.length === 0) {
        console.log(`${collectionName}: 无数据需要恢复`);
        continue;
      }
      
      const collection = db.collection(collectionName);
      
      // 清空现有数据（可选，根据需要启用）
      // await collection.deleteMany({});
      // console.log(`已清空集合: ${collectionName}`);
      
      // 插入备份数据
      const result = await collection.insertMany(backupData);
      console.log(`${collectionName}: 已恢复 ${result.insertedCount} 条记录`);
      totalRestored += result.insertedCount;
    }
    
    console.log('\n=== 恢复完成 ===');
    console.log(`总共恢复: ${totalRestored} 条记录`);
    console.log('\n注意: 用户上传的文件需要手动恢复到 uploads/ 目录');
    console.log('命令: cp -r backup/uploads/* uploads/');
    
  } catch (error) {
    console.error('恢复失败:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('\nMongoDB连接已关闭');
    }
  }
}

// 运行恢复
if (require.main === module) {
  console.log('警告: 此操作将向数据库中插入备份数据');
  console.log('如果需要清空现有数据，请取消注释脚本中的 deleteMany 行');
  console.log('\n按 Ctrl+C 取消，或等待 5 秒后自动开始...');
  
  setTimeout(() => {
    restoreDatabase();
  }, 5000);
}

module.exports = { restoreDatabase };
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const unzipper = require('unzipper');
const logger = require('../utils/logger');

// 导入模型
const Diary = require('../models/Diary');
const Todo = require('../models/Todo');
const Summary = require('../models/Summary');
const User = require('../models/User');

// 创建备份
const createBackup = async (req, res) => {
  try {
    const userId = req.user.id;
    logger.info('开始创建备份', { userId, query: req.query });

    // 获取用户的所有数据
    const [diaries, todos, summaries] = await Promise.all([
      Diary.find({ userId }).lean(),
      Todo.find({ userId }).lean(),
      Summary.find({ userId }).lean()
    ]);

    // 创建备份数据对象
    const backupData = {
      metadata: {
        version: '1.0',
        createdAt: new Date().toISOString(),
        userId: userId,
        exportDate: new Date().toISOString()
      },
      data: {
        diaries,
        todos,
        summaries
      }
    };

    // 创建备份目录
    const backupDir = path.join(__dirname, '../backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // 生成备份文件名
    const timestamp = new Date().getTime();
    // 确保userId是字符串且不包含无效字符
    const safeUserId = String(userId).replace(/[^a-zA-Z0-9_-]/g, '');
    const backupFileName = `backup-${safeUserId}-${timestamp}.json`;
    const backupFilePath = path.join(backupDir, backupFileName);

    // 保存备份文件
    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));

    logger.info('备份创建成功', { 
      userId, 
      backupFilePath,
      stats: {
        diaries: diaries.length,
        todos: todos.length,
        summaries: summaries.length
      }
    });

    res.json({
      success: true,
      message: '备份创建成功',
      backup: {
        timestamp,
        fileName: backupFileName,
        downloadUrl: `/api/backup/download/${backupFileName}`,
        stats: {
          diaries: diaries.length,
          todos: todos.length,
          summaries: summaries.length
        }
      }
    });

  } catch (error) {
    logger.error('备份创建失败:', error);
    res.status(500).json({
      success: false,
      message: '备份创建失败: ' + error.message
    });
  }
};

// 恢复备份
const restoreBackup = async (req, res) => {
  try {
    const userId = req.user.id;
    
    if (!req.files || !req.files.backupFile) {
      return res.status(400).json({
        success: false,
        message: '请上传备份文件'
      });
    }

    const backupFile = req.files.backupFile;
    const tempFilePath = path.join(__dirname, '../temp', backupFile.name);
    
    // 确保临时目录存在
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // 保存上传的文件
    await backupFile.mv(tempFilePath);

    // 读取备份文件
    const backupData = JSON.parse(fs.readFileSync(tempFilePath, 'utf8'));

    // 验证备份文件格式
    if (!backupData.metadata || !backupData.data) {
      fs.unlinkSync(tempFilePath);
      return res.status(400).json({
        success: false,
        message: '无效的备份文件格式'
      });
    }

    // 开始事务恢复数据
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 删除用户现有数据
      await Promise.all([
        Diary.deleteMany({ userId }).session(session),
        Todo.deleteMany({ userId }).session(session),
        Summary.deleteMany({ userId }).session(session)
      ]);

      // 恢复数据
      const { diaries, todos, summaries } = backupData.data;

      // 恢复日记
      if (diaries && diaries.length > 0) {
        const diariesWithUserId = diaries.map(diary => ({
          ...diary,
          userId,
          _id: new mongoose.Types.ObjectId()
        }));
        await Diary.insertMany(diariesWithUserId, { session });
      }

      // 恢复待办事项
      if (todos && todos.length > 0) {
        const todosWithUserId = todos.map(todo => ({
          ...todo,
          userId,
          _id: new mongoose.Types.ObjectId()
        }));
        await Todo.insertMany(todosWithUserId, { session });
      }

      // 恢复总结
      if (summaries && summaries.length > 0) {
        const summariesWithUserId = summaries.map(summary => ({
          ...summary,
          userId,
          _id: new mongoose.Types.ObjectId()
        }));
        await Summary.insertMany(summariesWithUserId, { session });
      }


      await session.commitTransaction();
      session.endSession();

      // 删除临时文件
      fs.unlinkSync(tempFilePath);

      logger.info('数据恢复成功', { userId });

      res.json({
        success: true,
        message: '数据恢复成功',
        restored: {
          diaries: diaries?.length || 0,
          todos: todos?.length || 0,
          summaries: summaries?.length || 0
        }
      });

    } catch (transactionError) {
      await session.abortTransaction();
      session.endSession();
      fs.unlinkSync(tempFilePath);
      throw transactionError;
    }

  } catch (error) {
    logger.error('恢复备份失败:', error);
    res.status(500).json({
      success: false,
      message: '恢复备份失败: ' + error.message
    });
  }
};

// 获取备份状态
const getBackupStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 检查备份目录是否存在
    const backupDir = path.join(__dirname, '../backup');
    const backups = [];
    
    if (fs.existsSync(backupDir)) {
      const files = fs.readdirSync(backupDir);
      const userBackups = files.filter(file => file.includes(userId));
      
      for (const file of userBackups) {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        backups.push({
          fileName: file,
          size: stats.size,
          created: stats.mtime,
          downloadUrl: `/api/backup/download/${file}`
        });
      }
    }

    res.json({
      success: true,
      available: backups.length > 0,
      backups: backups.sort((a, b) => b.created - a.created),
      backupDirExists: fs.existsSync(backupDir)
    });

  } catch (error) {
    logger.error('获取备份状态失败:', error);
    res.status(500).json({
      success: false,
      message: '获取备份状态失败: ' + error.message
    });
  }
};

// 下载备份文件
const downloadBackup = async (req, res) => {
  try {
    const fileName = req.params.fileName;
    const userId = req.user.id;
    
    // 安全检查：确保文件名只包含用户ID
    if (!fileName.includes(userId)) {
      return res.status(403).json({
        success: false,
        message: '无权访问此备份文件'
      });
    }

    const filePath = path.join(__dirname, '../backup', fileName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: '备份文件不存在'
      });
    }

    res.download(filePath, `workdiary-backup-${userId}.json`, (err) => {
      if (err) {
        logger.error('下载备份文件失败:', err);
        res.status(500).json({
          success: false,
          message: '下载备份文件失败'
        });
      }
    });

  } catch (error) {
    logger.error('下载备份文件失败:', error);
    res.status(500).json({
      success: false,
      message: '下载备份文件失败: ' + error.message
    });
  }
};

module.exports = {
  createBackup,
  restoreBackup,
  getBackupStatus,
  downloadBackup
};
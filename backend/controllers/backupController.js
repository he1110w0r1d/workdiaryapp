const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const unzipper = require('unzipper');
const crypto = require('crypto');
const logger = require('../utils/logger');
// 简易进度存储（内存占位实现）
const progressStore = new Map();
// 目录确保工具
const ensureDir = (dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (e) {
    logger.error('确保目录失败', { dirPath, error: e });
    throw e;
  }
};
const newProgress = (stage = 'queued') => {
  const id = Math.random().toString(36).slice(2, 10);
  progressStore.set(id, { status: 'queued', stage, percent: 0, logs: [] });
  return id;
};
const setProgress = (id, patch) => {
  const curr = progressStore.get(id) || { status: 'queued', stage: 'queued', percent: 0, logs: [] };
  const next = { ...curr, ...patch };
  progressStore.set(id, next);
  return next;
};

// 计算文件SHA256校验
const computeFileChecksumSha256 = (filePath) => new Promise((resolve, reject) => {
  try {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  } catch (e) {
    reject(e);
  }
});

// 解析备份zip：读取meta.json与data.json，判断可选文件存在性
const parseBackupZip = async (zipPath) => {
  const directory = await unzipper.Open.file(zipPath);
  const findEntry = (name) => directory.files.find((f) => f.path === name);

  const metaEntry = findEntry('meta.json');
  const dataEntry = findEntry('data.json');
  const llmEntry = findEntry('config/llm-settings.json');
  const envEntry = findEntry('env/.env');

  if (!metaEntry || !dataEntry) {
    throw new Error('备份包缺少必须文件：meta.json 或 data.json');
  }
  const metaBuf = await metaEntry.buffer();
  const dataBuf = await dataEntry.buffer();
  let meta, data;
  try {
    meta = JSON.parse(metaBuf.toString('utf8'));
  } catch (e) {
    throw new Error('meta.json解析失败：' + e.message);
  }
  try {
    data = JSON.parse(dataBuf.toString('utf8'));
  } catch (e) {
    throw new Error('data.json解析失败：' + e.message);
  }

  return {
    meta,
    data,
    hasLLMConfig: !!llmEntry,
    hasEnv: !!envEntry,
  };
};

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
    const [diaries, todos, summaries, userDoc] = await Promise.all([
      Diary.find({ user: userId }).lean(),
      Todo.find({ user: userId }).lean(),
      Summary.find({ user: userId }).lean(),
      User.findById(userId).lean()
    ]);

    // 组装用户设置（剔除敏感字段）
    const userProfile = userDoc ? {
      username: userDoc.username,
      email: userDoc.email,
      nickname: userDoc.nickname,
      bio: userDoc.bio,
      avatar: userDoc.avatar,
      workProfile: userDoc.workProfile || {},
      customPrompts: userDoc.customPrompts || {},
      createdAt: userDoc.createdAt,
      updatedAt: userDoc.updatedAt
    } : null;
    const llmConfigs = Array.isArray(userDoc?.llmConfigs) ? userDoc.llmConfigs : [];
    const embeddingConfigs = Array.isArray(userDoc?.embeddingConfigs) ? userDoc.embeddingConfigs : [];

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
        summaries,
        user: {
          profile: userProfile,
          llmConfigs,
          embeddingConfigs
        }
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
        summaries: summaries.length,
        llmConfigs: llmConfigs.length,
        embeddingConfigs: embeddingConfigs.length,
        hasUserProfile: !!userProfile
      }
    });

    res.json({
      success: true,
      message: '备份创建成功',
      backup: {
        timestamp,
        fileName: backupFileName,
        downloadUrl: `/backup/download/${backupFileName}`,
        stats: {
          diaries: diaries.length,
          todos: todos.length,
          summaries: summaries.length,
          llmConfigs: llmConfigs.length,
          embeddingConfigs: embeddingConfigs.length,
          hasUserProfile: !!userProfile
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
    if (!req.file) return res.status(400).json({ success: false, message: '请上传备份文件' });
    const backup = JSON.parse(fs.readFileSync(req.file.path, 'utf8'));
    const { restoreBackupData } = require('../services/backupRestore');
    const restored = await restoreBackupData(backup, req.user.id, req.body?.strategy || 'merge');
    return res.json({ success: true, message: '数据恢复成功', restored });
  } catch (error) {
    logger.error('恢复备份失败:', error);
    const status = error.status || (error instanceof SyntaxError || error.name === 'ValidationError' ? 400 : 500);
    return res.status(status).json({ success: false, message: '恢复备份失败: ' + error.message });
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

    res.download(filePath, (err) => {
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

// 新接口：导出备份（占位实现，后续迭代完善）
const exportBackup = async (req, res) => {
  try {
    const userId = req.user.id;
    const { mode = 'plain', includeEnv = false, split = false, chunkSizeMB = 200 } = req.body || {};
    logger.info('导出备份（plain实现v1）', { userId, mode, includeEnv, split, chunkSizeMB });

    // 仅实现 plain 基础导出：打包配置与元数据到 zip
    const progressId = newProgress('export');
    setProgress(progressId, { status: 'running', stage: 'init', percent: 5, logs: ['开始导出（plain v1）'] });

    if (mode !== 'plain') {
      setProgress(progressId, { status: 'failed', stage: 'validate', percent: 5, logs: ['当前版本仅支持 plain'] });
      return res.status(400).json({ success: false, message: '暂不支持 secure，先完成 plain', progressId });
    }

    const backupDir = path.join(__dirname, '..', 'backup');
    ensureDir(backupDir);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `backup-${userId}-${timestamp}.zip`;
    const filePath = path.join(backupDir, fileName);

    const output = fs.createWriteStream(filePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    const finalizeArchive = () => new Promise((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
    });

    archive.on('warning', (err) => {
      logger.warn('archiver warning', err);
    });
    archive.on('error', (err) => {
      logger.error('archiver error', err);
      throw err;
    });
    archive.pipe(output);

    // 添加元数据
    const meta = {
      version: '1.0',
      mode,
      userId,
      createdAt: new Date().toISOString(),
      includeEnv,
      split,
      chunkSizeMB,
      stats: { diaries: 0, todos: 0, summaries: 0 }
    };
    archive.append(JSON.stringify(meta, null, 2), { name: 'meta.json' });
    setProgress(progressId, { stage: 'collect', percent: 20, logs: ['写入 meta.json'] });

    // 添加配置文件：backend/config/llm-settings.json（如果存在）
    const llmConfigPath = path.join(__dirname, '..', 'config', 'llm-settings.json');
    if (fs.existsSync(llmConfigPath)) {
      archive.file(llmConfigPath, { name: 'config/llm-settings.json' });
      setProgress(progressId, { percent: 30, logs: ['包含 llm-settings.json'] });
    } else {
      setProgress(progressId, { percent: 30, logs: ['未找到 llm-settings.json，跳过'] });
    }

    // 可选：加入 .env（在 backend 根目录）
    if (includeEnv) {
      const envPath = path.join(__dirname, '..', '.env');
      if (fs.existsSync(envPath)) {
        archive.file(envPath, { name: 'env/.env' });
        setProgress(progressId, { percent: 40, logs: ['包含 .env'] });
      } else {
        setProgress(progressId, { percent: 40, logs: ['未找到 .env，跳过'] });
      }
    }

    // 采集用户数据并写入 data.json
    setProgress(progressId, { stage: 'collect', percent: 45, logs: ['采集用户数据'] });
    const [diaries, todos, summaries] = await Promise.all([
      Diary.find({ user: userId }).lean(),
      Todo.find({ user: userId }).lean(),
      Summary.find({ user: userId }).lean()
    ]);
    meta.stats = { diaries: diaries.length, todos: todos.length, summaries: summaries.length };
    archive.append(JSON.stringify({ diaries, todos, summaries }, null, 2), { name: 'data.json' });
    setProgress(progressId, { stage: 'pack', percent: 60, logs: [`写入 data.json（${diaries.length}/${todos.length}/${summaries.length}）`] });
    await archive.finalize();
    await finalizeArchive();

    setProgress(progressId, { stage: 'finalize', percent: 100, status: 'completed', logs: ['导出完成'] });

    const downloadUrl = `/api/backup/download/${encodeURIComponent(fileName)}`;
    return res.json({ success: true, progressId, fileName, filePath, downloadUrl });
  } catch (err) {
    logger.error('导出备份失败（plain v1）:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// 新接口：备份验证（plain v1实现）
const validateBackup = async (req, res) => {
  try {
    const userId = req.user.id;
    const { mode = 'plain', source = 'upload', fileName } = req.body || {};
    const progressId = newProgress('validate');
    setProgress(progressId, { status: 'running', stage: 'init', percent: 5, logs: ['开始验证'] });

    if (mode !== 'plain') {
      setProgress(progressId, { status: 'failed', stage: 'validate', percent: 10, logs: ['当前验证仅支持plain'] });
      return res.status(400).json({ success: false, message: '当前仅支持plain校验', progressId });
    }

    // 确定zip来源
    let zipPath;
    if (source === 'upload' && req.file && req.file.path) {
      zipPath = req.file.path;
    } else if (source === 'existing' && typeof fileName === 'string') {
      if (!fileName.includes(userId)) {
        return res.status(403).json({ success: false, message: '无权校验该文件', progressId });
      }
      zipPath = path.join(__dirname, '..', 'backup', fileName);
    } else {
      return res.status(400).json({ success: false, message: '缺少备份来源：请上传文件或提供fileName', progressId });
    }

    if (!fs.existsSync(zipPath)) {
      return res.status(404).json({ success: false, message: '备份文件不存在', progressId });
    }

    setProgress(progressId, { stage: 'parse', percent: 20, logs: ['解析zip'] });
    const checksum = await computeFileChecksumSha256(zipPath);
    const parsed = await parseBackupZip(zipPath);
    const { meta, data, hasLLMConfig, hasEnv } = parsed;

    // 结构与字段检查
    const issues = [];
    if (!meta || typeof meta !== 'object') issues.push('meta缺失或格式错误');
    if (!data || typeof data !== 'object') issues.push('data缺失或格式错误');
    if (!meta.version) issues.push('meta.version缺失');
    if (meta.mode && meta.mode !== 'plain') issues.push('meta.mode非plain');
    if (!meta.userId) issues.push('meta.userId缺失');
    if (!meta.createdAt) issues.push('meta.createdAt缺失');
    const diaries = Array.isArray(data.diaries) ? data.diaries : [];
    const todos = Array.isArray(data.todos) ? data.todos : [];
    const summaries = Array.isArray(data.summaries) ? data.summaries : [];
    const statsFromData = { diaries: diaries.length, todos: todos.length, summaries: summaries.length };
    if (meta.stats) {
      if (meta.stats.diaries !== statsFromData.diaries) issues.push('meta.stats.diaries与数据不一致');
      if (meta.stats.todos !== statsFromData.todos) issues.push('meta.stats.todos与数据不一致');
      if (meta.stats.summaries !== statsFromData.summaries) issues.push('meta.stats.summaries与数据不一致');
    }

    setProgress(progressId, { stage: 'conflict-check', percent: 60, logs: ['冲突预检'] });
    // 冲突预检：用_id交叉判断潜在覆盖
    const [existingDiaries, existingTodos, existingSummaries] = await Promise.all([
      Diary.find({ user: userId }, { _id: 1 }).lean(),
      Todo.find({ user: userId }, { _id: 1 }).lean(),
      Summary.find({ user: userId }, { _id: 1 }).lean(),
    ]);
    const setFrom = (arr) => new Set(arr.map((x) => String(x._id)));
    const existD = setFrom(existingDiaries);
    const existT = setFrom(existingTodos);
    const existS = setFrom(existingSummaries);
    const interCount = (incoming, existSet) => incoming.reduce((acc, x) => acc + (existSet.has(String(x._id)) ? 1 : 0), 0);
    const overwrite = {
      diaries: interCount(diaries, existD),
      todos: interCount(todos, existT),
      summaries: interCount(summaries, existS),
    };
    const plan = {
      total: statsFromData,
      overwrite,
      newItems: {
        diaries: statsFromData.diaries - overwrite.diaries,
        todos: statsFromData.todos - overwrite.todos,
        summaries: statsFromData.summaries - overwrite.summaries,
      },
    };

    setProgress(progressId, { stage: 'finalize', percent: 100, status: 'completed', logs: ['验证完成'] });
    return res.json({
      success: true,
      progressId,
      result: {
        checksum,
        version: meta.version || 'unknown',
        mode: meta.mode || 'plain',
        userId: meta.userId,
        createdAt: meta.createdAt,
        hasLLMConfig,
        hasEnv,
        stats: statsFromData,
        issues,
        plan,
      },
    });
  } catch (err) {
    logger.error('验证备份失败:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// 新接口：增强还原（实现dry-run分析）
const restoreBackupV2 = async (req, res) => {
  try {
    const userId = req.user.id;
    const { backupMode = 'plain', dryRun = false, strategy = 'merge', source = 'upload', fileName } = req.body || {};
    const progressId = newProgress('import');
    setProgress(progressId, { status: 'running', stage: 'init', percent: 5, logs: ['开始增强还原'] });

    if (backupMode !== 'plain') {
      setProgress(progressId, { status: 'failed', stage: 'validate', percent: 10, logs: ['当前仅支持plain'] });
      return res.status(400).json({ success: false, message: '当前仅支持plain', progressId });
    }

    // 找到zip来源
    let zipPath;
    if (source === 'upload' && req.file && req.file.path) {
      zipPath = req.file.path;
    } else if (source === 'existing' && typeof fileName === 'string') {
      if (!fileName.includes(userId)) {
        return res.status(403).json({ success: false, message: '无权使用该备份', progressId });
      }
      zipPath = path.join(__dirname, '..', 'backup', fileName);
    } else {
      return res.status(400).json({ success: false, message: '缺少备份来源：请上传文件或提供fileName', progressId });
    }
    if (!fs.existsSync(zipPath)) {
      return res.status(404).json({ success: false, message: '备份文件不存在', progressId });
    }

    setProgress(progressId, { stage: 'parse', percent: 20, logs: ['解析zip'] });
    const parsed = await parseBackupZip(zipPath);
    const { meta, data } = parsed;
    const diaries = Array.isArray(data.diaries) ? data.diaries : [];
    const todos = Array.isArray(data.todos) ? data.todos : [];
    const summaries = Array.isArray(data.summaries) ? data.summaries : [];

    // 现有数据
    const [existingDiaries, existingTodos, existingSummaries] = await Promise.all([
      Diary.find({ user: userId }, { _id: 1 }).lean(),
      Todo.find({ user: userId }, { _id: 1 }).lean(),
      Summary.find({ user: userId }, { _id: 1 }).lean(),
    ]);
    const setFrom = (arr) => new Set(arr.map((x) => String(x._id)));
    const existD = setFrom(existingDiaries);
    const existT = setFrom(existingTodos);
    const existS = setFrom(existingSummaries);
    const interCount = (incoming, existSet) => incoming.reduce((acc, x) => acc + (existSet.has(String(x._id)) ? 1 : 0), 0);
    const overwrite = {
      diaries: interCount(diaries, existD),
      todos: interCount(todos, existT),
      summaries: interCount(summaries, existS),
    };
    const plan = {
      strategy,
      total: { diaries: diaries.length, todos: todos.length, summaries: summaries.length },
      overwrite,
      newItems: {
        diaries: diaries.length - overwrite.diaries,
        todos: todos.length - overwrite.todos,
        summaries: summaries.length - overwrite.summaries,
      },
      notes: strategy === 'merge' ? 'merge：保留现有，插入新项；同_id不覆盖' : 'overwrite：同_id将覆盖现有项',
    };

    if (dryRun) {
      setProgress(progressId, { stage: 'finalize', percent: 100, status: 'completed', logs: ['干跑完成'] });
      return res.json({ success: true, progressId, dryRun: true, plan, meta });
    }

    // 非dry-run暂不执行真实导入，避免误写数据
    setProgress(progressId, { status: 'failed', stage: 'apply', percent: 80, logs: ['真实导入暂未开放'] });
    return res.status(501).json({ success: false, message: '真实导入功能将后续开放（当前仅支持dry-run）', progressId, plan });
  } catch (err) {
    logger.error('增强还原失败:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// 进度查询
const getProgress = async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ success: false, message: '缺少progressId' });
    const state = progressStore.get(id);
    if (!state) return res.status(404).json({ success: false, message: '未找到进度' });
    return res.json({ success: true, ...state, id });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createBackup,
  restoreBackup,
  getBackupStatus,
  downloadBackup,
  exportBackup,
  validateBackup,
  restoreBackupV2,
  getProgress
};
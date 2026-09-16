const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const cron = require('node-cron');
const cookieParser = require('cookie-parser');

const logger = require('./utils/logger');
// 加载环境变量（覆盖 PM2 环境变量）
dotenv.config({ path: require('path').join(__dirname, '.env'), override: true });

// 加载LLM配置
const fs = require('fs');
const path = require('path');
const settingsFilePath = path.join(__dirname, 'config/llm-settings.json');
const ragRoutes = require('./routes/rag');
const difyRoutes = require('./routes/dify');

// 在启动时加载LLM配置到环境变量
if (fs.existsSync(settingsFilePath)) {
  try {
    const settingsData = fs.readFileSync(settingsFilePath, 'utf8');
    const settings = JSON.parse(settingsData);

    // 设置LLM类型
    if (settings.llmType) process.env.LLM_TYPE = settings.llmType;

    // 设置本地LLM环境变量
    if (settings.useLocalLLM !== undefined) process.env.USE_LOCAL_LLM = String(settings.useLocalLLM);
    if (settings.apiUrl) process.env.LOCAL_LLM_API_URL = settings.apiUrl;
    if (settings.model) process.env.LOCAL_LLM_MODEL = settings.model;
    if (settings.timeout) process.env.LOCAL_LLM_TIMEOUT = String(settings.timeout);
    if (settings.temperature) process.env.LOCAL_LLM_TEMPERATURE = String(settings.temperature);

    // 设置外部LLM环境变量
    if (settings.externalProvider) process.env.EXTERNAL_LLM_PROVIDER = settings.externalProvider;
    if (settings.externalApiKey) process.env.EXTERNAL_LLM_API_KEY = settings.externalApiKey;
    if (settings.externalApiUrl) process.env.EXTERNAL_LLM_API_URL = settings.externalApiUrl;
    if (settings.externalModel) process.env.EXTERNAL_LLM_MODEL = settings.externalModel;
    if (settings.externalTimeout) process.env.EXTERNAL_LLM_TIMEOUT = String(settings.externalTimeout);
    if (settings.externalTemperature) process.env.EXTERNAL_LLM_TEMPERATURE = String(settings.externalTemperature);
    if (settings.externalMaxTokens) process.env.EXTERNAL_LLM_MAX_TOKENS = String(settings.externalMaxTokens);

    // 设置 Embeddings 环境变量（用于RAG索引/查询）
    if (settings.externalEmbeddingsProvider) process.env.EXTERNAL_EMBEDDINGS_PROVIDER = settings.externalEmbeddingsProvider;
    if (settings.externalEmbeddingsApiKey) process.env.EXTERNAL_EMBEDDINGS_API_KEY = settings.externalEmbeddingsApiKey;
    if (settings.externalEmbeddingsApiUrl) process.env.EXTERNAL_EMBEDDINGS_API_URL = settings.externalEmbeddingsApiUrl;
    if (settings.externalEmbeddingsModel) process.env.EXTERNAL_EMBEDDINGS_MODEL = settings.externalEmbeddingsModel;
    if (settings.externalEmbeddingsTimeout) process.env.EXTERNAL_EMBEDDINGS_TIMEOUT = String(settings.externalEmbeddingsTimeout);

    logger.info('LLM配置已加载:', {
      type: settings.llmType,
      useLocalLLM: settings.useLocalLLM,
      localModel: settings.model,
      localApiUrl: settings.apiUrl ? settings.apiUrl.substring(0, 30) + '...' : 'N/A',
      externalProvider: settings.externalProvider,
      externalModel: settings.externalModel
    });

    // 记录 Embeddings 配置加载情况，便于故障排查
    logger.info('Embeddings配置已加载:', {
      provider: settings.externalEmbeddingsProvider,
      model: settings.externalEmbeddingsModel,
      apiUrl: settings.externalEmbeddingsApiUrl ? String(settings.externalEmbeddingsApiUrl).substring(0, 30) + '...' : 'N/A',
      hasApiKey: Boolean(settings.externalEmbeddingsApiKey)
    });
  } catch (error) {
    logger.error('加载LLM配置失败:', error.message);
  }
} else {
  logger.llm('LLM配置文件不存在，使用默认配置');
}

// 导入路由
const userRoutes = require('./routes/users');
const diaryRoutes = require('./routes/diaries');
const summaryRoutes = require('./routes/summaries');
const settingsRoutes = require('./routes/settingsRoutes');
const todoRoutes = require('./routes/todos');
const backupRoutes = require('./routes/backup');
const apiKeyRoutes = require('./routes/apiKeys');
const publicApiRoutes = require('./routes/publicApi');

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';
// 启用trust proxy以正确获取客户端IP
app.set('trust proxy', true);

// 设置请求超时时间为10分钟，适应LLM生成时间
app.use((req, res, next) => {
  req.setTimeout(600000); // 10分钟
  res.setTimeout(600000); // 10分钟
  next();
});

// 请求日志记录中间件
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`[${req.method}] ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// 配置CORS - 动态设置允许的源
const corsOptions = {
  origin: function (origin, callback) {
    // 允许没有origin的请求（如移动应用或直接浏览器请求）
    if (!origin) return callback(null, true);

    // 允许localhost来源
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }

    // 允许生产环境域名（支持 HTTP 和 HTTPS）
    if (origin.match(/^https?:\/\/(.*\.)?workdiary\.cn(:\d+)?$/)) {
      return callback(null, true);
    }

    // 允许局域网IP地址来源（包含192.168.*、172.*、10.*）
    if (
      origin.match(/^http:\/\/192\.168\.\d+\.\d+:/) ||
      origin.match(/^http:\/\/172\.\d+\.\d+\.\d+:/) ||
      origin.match(/^http:\/\/10\.\d+\.\d+\.\d+:/)
    ) {
      return callback(null, true);
    }

    // 拒绝其他来源
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// 中间件
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 静态文件服务
require('./middleware/publicUploads')(app);

// 数据库连接
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/workdiary', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => logger.info('MongoDB connected'))
  .catch(err => logger.error('MongoDB connection error:', err));

// 路由
app.use('/api/users', userRoutes);
app.use('/api/diaries', diaryRoutes);
app.use('/api/summaries', summaryRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/apikeys', apiKeyRoutes);
// 对于备份路由，使用带有文件上传中间件的路由
app.use('/api/backup', backupRoutes);
app.use('/api', ragRoutes);
app.use('/api', difyRoutes);
// 公开API路由（供外部Agent调用）
app.use('/api/v1', publicApiRoutes);

// 提供API文档（Markdown原文）
app.get('/api/docs/api-documentation', (req, res) => {
  const docPath = path.join(__dirname, 'API_DOCUMENTATION.md');
  if (fs.existsSync(docPath)) {
    const content = fs.readFileSync(docPath, 'utf8');
    res.type('text/plain').send(content);
  } else {
    res.status(404).json({ message: 'API文档未找到' });
  }
});

// Durable jobs are shared by manual generation and schedules. Start once after Mongo is ready.
const summaryWorkflow = require('./services/summaryWorkflow');
const jobQueue = require('./services/jobQueue');
const safeSchedule = type => () => summaryWorkflow.enqueueScheduled(type).catch(() => logger.error('总结入队失败'));
for (const [schedule, type] of [['0 1 * * *', 'daily'], ['30 1 * * 1', 'weekly'], ['0 2 1 * *', 'monthly'], ['0 3 1 1 *', 'yearly']]) {
  cron.schedule(schedule, safeSchedule(type), { timezone: 'Asia/Shanghai' });
}
mongoose.connection.once('connected', async () => {
  await require('./models/BackgroundJob').init();
  await require('./models/TodoSuggestion').init();
  jobQueue.startWorker('summary', summaryWorkflow.generate);
  require('./services/indexWorkflow').start();
  safeSchedule('daily')();
});

// 启动定时清理任务
const { scheduleCleanup } = require('./utils/cleanup');
scheduleCleanup();

// 根路径
app.get('/', (req, res) => {
  res.json({ message: 'Work Diary API Server' });
});

app.listen(PORT, HOST, () => {
  logger.info(`服务器运行在端口 ${PORT}`);
  logger.info(`局域网访问地址: http://${HOST}:${PORT}`);
  console.log(`服务器运行在端口 ${PORT}`);
  console.log(`局域网访问地址: http://${HOST}:${PORT}`);
});
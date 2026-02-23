const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const cron = require('node-cron');
const multer = require('multer');
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

// 配置multer文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB限制
  }
  // 移除fileFilter，让后端控制器自己处理文件类型验证
});

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

// 导入定时任务
const { generateDailySummary, generateMonthlySummary, generateYearlySummary, batchGenerateWeeklySummary } = require('./controllers/summaryController');

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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads/avatars', express.static(path.join(__dirname, 'uploads/avatars')));
app.use('/uploads/summaries', express.static(path.join(__dirname, 'uploads/summaries')));

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
app.use('/api/backup', upload.single('backupFile'), backupRoutes);
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

// 定时任务
const cronTimeZone = 'Asia/Shanghai';

// 每天凌晨1点生成昨日总结
cron.schedule('0 1 * * *', generateDailySummary, {
  timezone: cronTimeZone
});
logger.info(`每日总结定时任务已设置，将在每天凌晨1点（${cronTimeZone}）运行`);

// 服务器启动时检查是否需要生成昨日总结
const checkAndGenerateYesterdaySummary = async () => {
  try {
    const now = new Date();
    const currentHour = now.getHours();

    // 如果当前时间在凌晨1点之后启动，检查昨日总结是否已生成
    if (currentHour >= 1) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const Summary = require('./models/Summary');
      const existingSummary = await Summary.findOne({
        type: 'daily',
        date: yesterday
      });

      if (!existingSummary) {
        logger.info('检测到昨日总结未生成，正在补生成...');
        await generateDailySummary();
        logger.info('昨日总结补生成完成');
      }
    }
  } catch (error) {
    logger.error('检查昨日总结时出错:', error);
  }
};

// 在数据库连接建立后执行检查
mongoose.connection.on('connected', () => {
  setTimeout(checkAndGenerateYesterdaySummary, 3000);
});

// 每周一凌晨1点30分生成上周总结
cron.schedule('30 1 * * 1', batchGenerateWeeklySummary, {
  timezone: cronTimeZone
});
logger.info(`每周总结定时任务已设置，将在每周一凌晨1点30分（${cronTimeZone}）运行`);

// 每月1日凌晨2点生成上月总结
cron.schedule('0 2 1 * *', require('./controllers/summaryController').batchGenerateMonthlySummary, {
  timezone: cronTimeZone
});
logger.info(`每月总结定时任务已设置，将在每月1凌晨2点（${cronTimeZone}）运行`);

// 每年1月1凌晨3点生成上年总结
cron.schedule('0 3 1 1 *', require('./controllers/summaryController').batchGenerateYearlySummary, {
  timezone: cronTimeZone
});
logger.info(`每年总结定时任务已设置，将在每年1月1凌晨3点（${cronTimeZone}）运行`);

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
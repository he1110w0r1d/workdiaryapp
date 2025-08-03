const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const cron = require('node-cron');

const logger = require('./utils/logger');
// 加载环境变量
dotenv.config();

// 加载LLM配置
const fs = require('fs');
const path = require('path');
const settingsFilePath = path.join(__dirname, 'config/llm-settings.json');

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
    
    logger.info('LLM配置已加载:', {
      type: settings.llmType,
      useLocalLLM: settings.useLocalLLM,
      localModel: settings.model,
      localApiUrl: settings.apiUrl ? settings.apiUrl.substring(0, 30) + '...' : 'N/A',
      externalProvider: settings.externalProvider,
      externalModel: settings.externalModel
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

// 导入定时任务
const { generateDailySummary, generateMonthlySummary, generateYearlySummary } = require('./controllers/summaryController');

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST 
// 启用trust proxy以正确获取客户端IP
app.set('trust proxy', true);

// 设置请求超时时间为10分钟，适应LLM生成时间
app.use((req, res, next) => {
  req.setTimeout(600000); // 10分钟
  res.setTimeout(600000); // 10分钟
  next();
});

// IP访问限制中间件 - 只允许局域网192.168.1.x访问
app.use((req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 
    (req.connection.socket ? req.connection.socket.remoteAddress : null);
  
  // 获取真实IP（处理代理情况）
  const realIP = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || clientIP;
  const ip = realIP ? realIP.split(',')[0].trim() : clientIP;
  
  logger.info(`访问请求来自IP: ${ip}`);
  
  // 允许本地访问
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
    return next();
  }
  
  // 检查是否为192.168.1.x网段
  const ipv4Regex = /^192\.168\.1\.(\d{1,3})$/;
  const ipv6MappedRegex = /^::ffff:192\.168\.1\.(\d{1,3})$/;
  
  if (ipv4Regex.test(ip) || ipv6MappedRegex.test(ip)) {
    return next();
  }
  
  // 拒绝访问
  logger.info(`拒绝来自IP ${ip} 的访问请求`);
  return res.status(403).json({ 
    error: '访问被拒绝', 
    message: '此服务仅限局域网192.168.1.x网段访问' 
  });
});

// 中间件
app.use(cors());
app.use(express.json());

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
.catch(err => logger.info(err));

// 路由
app.use('/api/users', userRoutes);
app.use('/api/diaries', diaryRoutes);
app.use('/api/summaries', summaryRoutes);
app.use('/api/settings', settingsRoutes);

// 定时任务
// 每天凌晨1点生成昨日总结
cron.schedule('0 1 * * *', generateDailySummary);
// 每月1日凌晨2点生成上月总结
cron.schedule('0 2 1 * *', require('./controllers/summaryController').batchGenerateMonthlySummary);
// 每年1月1日凌晨3点生成上年总结
cron.schedule('0 3 1 1 *', require('./controllers/summaryController').batchGenerateYearlySummary);

// 根路径
app.get('/', (req, res) => {
  res.json({ message: 'Work Diary API Server' });
});

app.listen(PORT, HOST, () => {
  logger.info(`服务器运行在端口 ${PORT}`);
  logger.info(`局域网访问地址: http://${HOST}:${PORT}`);
  logger.info('注意: 此服务仅限192.168.1.x网段访问');
});
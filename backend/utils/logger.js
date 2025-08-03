const fs = require('fs');
const path = require('path');

/**
 * 日志工具类
 * 用于统一管理应用日志
 */
class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.ensureLogDir();
  }

  /**
   * 确保日志目录存在
   */
  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * 获取当前时间戳
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * 写入日志文件
   */
  writeLog(level, message, data = null) {
    const timestamp = this.getTimestamp();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(data && { data })
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    const logFile = path.join(this.logDir, `${new Date().toISOString().split('T')[0]}.log`);
    
    fs.appendFileSync(logFile, logLine);
  }

  /**
   * 信息日志
   */
  info(message, data = null) {
    this.writeLog('INFO', message, data);
  }

  /**
   * 警告日志
   */
  warn(message, data = null) {
    this.writeLog('WARN', message, data);
  }

  /**
   * 错误日志
   */
  error(message, data = null) {
    this.writeLog('ERROR', message, data);
  }

  /**
   * 调试日志（仅在开发环境记录）
   */
  debug(message, data = null) {
    if (process.env.NODE_ENV === 'development') {
      this.writeLog('DEBUG', message, data);
    }
  }

  /**
   * LLM相关日志
   */
  llm(message, data = null) {
    this.writeLog('LLM', message, data);
  }

  /**
   * 用户操作日志
   */
  user(message, data = null) {
    this.writeLog('USER', message, data);
  }

  /**
   * 系统日志
   */
  system(message, data = null) {
    this.writeLog('SYSTEM', message, data);
  }
}

// 创建全局日志实例
const logger = new Logger();

module.exports = logger;
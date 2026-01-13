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
   * 获取UTC时间戳（ISO）
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * 获取本地时间戳（带时区偏移，如 +08:00）
   */
  getLocalTimestamp() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const tzMin = -now.getTimezoneOffset(); // 北京时间为 +480
    const sign = tzMin >= 0 ? '+' : '-';
    const abs = Math.abs(tzMin);
    const tzh = String(Math.floor(abs / 60)).padStart(2, '0');
    const tzm = String(abs % 60).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}:${ss} ${sign}${tzh}:${tzm}`;
  }

  /**
   * 写入日志文件
   */
  writeLog(level, message, data = null) {
    const timestamp = this.getTimestamp();
    const localTimestamp = this.getLocalTimestamp();
    const logEntry = {
      timestamp,
      localTimestamp,
      level,
      message,
      message,
      ...(data && {
        data: data instanceof Error ?
          { message: data.message, stack: data.stack, name: data.name } :
          data
      })
    };

    const logLine = JSON.stringify(logEntry) + '\n';
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const fileDate = `${y}-${m}-${d}`;
    const logFile = path.join(this.logDir, `${fileDate}.log`);

    // 写文件并在关键级别同步输出到控制台，避免静默失败
    try {
      fs.appendFileSync(logFile, logLine);
    } catch (e) {
      try { console.warn('[logger] file write failed:', e.message); } catch (_) { }
    }
    if (level === 'LLM' || level === 'ERROR') {
      try { console.log(logLine.trim()); } catch (_) { }
    }
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
/**
 * 前端日志工具
 * 提供统一的日志记录接口
 */

class Logger {
  static info(message, ...args) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[INFO] ${message}`, ...args);
    }
  }

  static warn(message, ...args) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  static error(message, ...args) {
    console.error(`[ERROR] ${message}`, ...args);
  }

  static debug(message, ...args) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  static user(message, ...args) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[USER] ${message}`, ...args);
    }
  }

  static api(message, ...args) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] ${message}`, ...args);
    }
  }
}

export default Logger;
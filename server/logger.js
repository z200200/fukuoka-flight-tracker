// 轻量分级日志：NODE_ENV=production 时只输出 warn/error
const LEVELS = ['debug', 'info', 'warn', 'error'];

class Logger {
  constructor() {
    this.level = process.env.NODE_ENV === 'production' ? 'warn' : 'debug';
  }

  shouldLog(level) {
    return LEVELS.indexOf(level) >= LEVELS.indexOf(this.level);
  }

  debug(message, meta) {
    if (this.shouldLog('debug')) console.log(`[DEBUG] ${message}`, meta ?? '');
  }

  info(message, meta) {
    if (this.shouldLog('info')) console.info(`[INFO] ${message}`, meta ?? '');
  }

  warn(message, meta) {
    if (this.shouldLog('warn')) console.warn(`[WARN] ${message}`, meta ?? '');
  }

  error(message, error) {
    if (this.shouldLog('error')) console.error(`[ERROR] ${message}`, error ?? '');
  }
}

export const logger = new Logger();

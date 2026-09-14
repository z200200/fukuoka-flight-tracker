// 轻量分级日志：开发环境输出 debug 及以上，生产环境只输出 warn/error
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

class Logger {
  private level: LogLevel = import.meta.env.PROD ? 'warn' : 'debug';

  private shouldLog(level: LogLevel): boolean {
    return LEVELS.indexOf(level) >= LEVELS.indexOf(this.level);
  }

  debug(message: string, meta?: unknown): void {
    if (this.shouldLog('debug')) console.log(`[DEBUG] ${message}`, meta ?? '');
  }

  info(message: string, meta?: unknown): void {
    if (this.shouldLog('info')) console.info(`[INFO] ${message}`, meta ?? '');
  }

  warn(message: string, meta?: unknown): void {
    if (this.shouldLog('warn')) console.warn(`[WARN] ${message}`, meta ?? '');
  }

  error(message: string, error?: unknown): void {
    if (this.shouldLog('error')) console.error(`[ERROR] ${message}`, error ?? '');
  }
}

export const logger = new Logger();

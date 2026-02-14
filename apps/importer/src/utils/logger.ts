/**
 * Simple structured logger for import operations
 */

export type LogLevel = 'info' | 'success' | 'warn' | 'error';

export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  success(message: string, data?: unknown): void {
    this.log('success', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    const prefix = this.getPrefix(level);
    const contextLabel = `[${this.context}]`;

    if (data !== undefined) {
      console.log(`${prefix} ${contextLabel} ${message}`, data);
    } else {
      console.log(`${prefix} ${contextLabel} ${message}`);
    }
  }

  private getPrefix(level: LogLevel): string {
    switch (level) {
      case 'info':
        return 'ℹ';
      case 'success':
        return '✓';
      case 'warn':
        return '⚠';
      case 'error':
        return '✗';
    }
  }
}

/**
 * Create a logger with the given context
 */
export function createLogger(context: string): Logger {
  return new Logger(context);
}

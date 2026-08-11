type LogLevel = 'info' | 'warn' | 'error';

type LogContext = Record<string, string | number | boolean | null | undefined>;

function write(level: LogLevel, message: string, context: LogContext = {}) {
  const payload = {
    level,
    message,
    service: 'whyhouse-front',
    timestamp: new Date().toISOString(),
    ...context,
  };

  console[level](JSON.stringify(payload));
}

export const logger = {
  info: (message: string, context?: LogContext) => write('info', message, context),
  warn: (message: string, context?: LogContext) => write('warn', message, context),
  error: (message: string, context?: LogContext) => write('error', message, context),
};

import winston from 'winston';
import path from 'path';

export class Logger {
  private logger: winston.Logger;

  constructor(private moduleName: string = 'AutoGuild') {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
      ),
      defaultMeta: { module: moduleName },
      transports: [
        new winston.transports.File({
          filename: path.join('logs', 'error.log'),
          level: 'error',
        }),
        new winston.transports.File({
          filename: path.join('logs', 'combined.log'),
        }),
      ],
    });

    // If we're not in production, log to the console with a simpler format
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf((info) => {
              const { timestamp, level, message, module, ...meta } = info;
              const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
              return `${timestamp} [${module}] ${level}: ${message} ${metaStr}`;
            })
          ),
        })
      );
    }
  }

  info(message: string, meta?: any) {
    this.logger.info(message, meta);
  }

  error(message: string, error?: Error | any) {
    this.logger.error(message, { error: error?.message || error, stack: error?.stack });
  }

  warn(message: string, meta?: any) {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: any) {
    this.logger.debug(message, meta);
  }

  verbose(message: string, meta?: any) {
    this.logger.verbose(message, meta);
  }
}

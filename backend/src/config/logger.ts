import winston from 'winston';
import fs from 'fs';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from './index.js';

fs.mkdirSync(config.paths.logs, { recursive: true });

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${message}${stack ? '\n' + stack : ''}`;
  })
);

export const logger = winston.createLogger({
  level: config.isDev ? 'debug' : 'info',
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      ),
    }),
    new DailyRotateFile({
      dirname: config.paths.logs,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
      level: 'error',
    }),
    new DailyRotateFile({
      dirname: config.paths.logs,
      filename: 'combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
    }),
  ],
});

export default logger;

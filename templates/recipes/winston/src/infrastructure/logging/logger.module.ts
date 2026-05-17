import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

@Module({
  imports: [
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        level: configService.get<string>('LOG_LEVEL', 'info'),
        transports: [
          new winston.transports.Console({
            format:
              configService.get<string>('NODE_ENV') !== 'production'
                ? winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.colorize(),
                    winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
                      const ctx = context ? `[${context}] ` : '';
                      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
                      return `${timestamp} ${level} ${ctx}${message}${metaStr}`;
                    }),
                  )
                : winston.format.combine(winston.format.timestamp(), winston.format.json()),
          }),
        ],
      }),
    }),
  ],
  exports: [WinstonModule],
})
export class LoggerModule {}

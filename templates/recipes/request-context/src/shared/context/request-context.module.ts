import { Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';

@Module({
  imports: [
    ClsModule.forRoot({
      middleware: {
        mount: true,
        setup: (cls, req) => {
          cls.set('correlationId', req.headers['x-correlation-id'] ?? crypto.randomUUID());
          cls.set('userId', (req as any).user?.sub ?? null);
          cls.set('ip', req.ip);
        },
      },
    }),
  ],
  exports: [ClsModule],
})
export class RequestContextModule {}

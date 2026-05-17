import { Injectable, NestMiddleware } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { FastifyReply, FastifyRequest } from 'fastify';

export interface TraceContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
  parentSpanId?: string;
}

export const traceStorage = new AsyncLocalStorage<TraceContext>();

const TRACEPARENT_HEADER = 'traceparent';
const TRACEPARENT_REGEX = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

function generateHexId(bytes: number): string {
  const array = new Uint8Array(bytes);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function parseTraceparent(header: string | undefined): TraceContext | null {
  if (!header) {
    return null;
  }

  const match = TRACEPARENT_REGEX.exec(header);

  if (!match) {
    return null;
  }

  return {
    traceId: match[1],
    parentSpanId: match[2],
    spanId: generateHexId(8),
    traceFlags: parseInt(match[3], 16),
  };
}

function createTraceContext(): TraceContext {
  return {
    traceId: generateHexId(16),
    spanId: generateHexId(8),
    traceFlags: 1,
  };
}

function formatTraceparent(ctx: TraceContext): string {
  return `00-${ctx.traceId}-${ctx.spanId}-${ctx.traceFlags.toString(16).padStart(2, '0')}`;
}

@Injectable()
export class TracePropagationMiddleware implements NestMiddleware {
  use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: () => void): void {
    const incoming = req.headers[TRACEPARENT_HEADER] as string | undefined;
    const traceContext = parseTraceparent(incoming) || createTraceContext();

    res.setHeader(TRACEPARENT_HEADER, formatTraceparent(traceContext));

    traceStorage.run(traceContext, () => {
      next();
    });
  }
}

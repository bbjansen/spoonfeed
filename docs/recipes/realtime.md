# Realtime Recipes

Server-to-client and bidirectional real-time communication patterns for NestJS.

## Available Recipes

| Recipe     | Protocol / API                     | Best For                                                | Recipe README                                                       |
| ---------- | ---------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------- |
| SSE        | HTTP `text/event-stream`           | Live feeds, notifications, progress updates             | [sse](../../packages/templates/recipes/sse/README.md)               |
| WebSockets | Socket.io via `@nestjs/websockets` | Chat, collaboration, gaming, low-latency bi-directional | [websockets](../../packages/templates/recipes/websockets/README.md) |

## When to Use Each

- **SSE** — when the server pushes data and the client only listens (dashboards, stock tickers, build logs). Simpler to implement, works over plain HTTP, and auto-reconnects natively.
- **WebSockets** — when the client and server both send messages frequently (chat, multiplayer, collaborative editing). Higher complexity but supports bidirectional communication.

## Comparison

| Feature              | SSE                              | WebSockets                        |
| -------------------- | -------------------------------- | --------------------------------- |
| Direction            | Server to client                 | Bidirectional                     |
| Protocol             | HTTP/1.1+ (text/event-stream)    | WS (upgraded from HTTP)           |
| Reconnection         | Built-in (browser `EventSource`) | Manual (Socket.io handles it)     |
| Binary data          | No (text only)                   | Yes                               |
| Proxy / firewall     | Passes through HTTP proxies      | May require special configuration |
| Scaling              | Stateless (easy)                 | Sticky sessions or Redis adapter  |
| Browser support      | All modern browsers              | All modern browsers               |
| NestJS decorator     | `@Sse()`                         | `@SubscribeMessage()`             |
| Overhead per message | Very low                         | Low                               |

## Quick Start: SSE

```typescript
import { Controller, Sse, MessageEvent } from '@nestjs/common';
import { Observable, interval, map } from 'rxjs';

@Controller('events')
export class EventsController {
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return interval(1000).pipe(
      map((n) => ({
        data: { tick: n, timestamp: new Date().toISOString() },
      })),
    );
  }
}
```

Client-side:

```javascript
const source = new EventSource('/events/stream');
source.onmessage = (event) => {
  console.log(JSON.parse(event.data));
};
```

## Decision Guide

Choose **SSE** when you only need server-to-client pushes and want the simplest possible setup. Choose **WebSockets** when the client must send frequent messages back to the server or when you need binary data support.

## External Documentation

- [NestJS Server-Sent Events](https://docs.nestjs.com/techniques/server-sent-events)
- [NestJS WebSocket Gateways](https://docs.nestjs.com/websockets/gateways)
- [MDN — EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
- [Socket.io Documentation](https://socket.io/docs/v4/)

# WebSockets

Real-time bidirectional communication using NestJS WebSocket gateways.

## Links

- [NestJS WebSocket Gateways](https://docs.nestjs.com/websockets/gateways)
- [@nestjs/websockets on npm](https://www.npmjs.com/package/@nestjs/websockets)
- [@nestjs/platform-socket.io on npm](https://www.npmjs.com/package/@nestjs/platform-socket.io)
- [@nestjs/websockets on GitHub](https://github.com/nestjs/nest/tree/master/packages/websockets)

## Dependencies

| Package                      | Version   | Purpose                     |
| ---------------------------- | --------- | --------------------------- |
| `@nestjs/websockets`         | `11.0.20` | WebSocket module for NestJS |
| `@nestjs/platform-socket.io` | `11.0.20` | Socket.IO platform adapter  |

## Usage

```typescript
import { EventsGateway } from '@/shared/gateways/events.gateway';

@Module({
  providers: [EventsGateway],
})
export class AppModule {}
```

Connect from a client:

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');
socket.emit('ping', { timestamp: Date.now() });
socket.on('pong', (data) => console.log(data));
```

## Generated Files

| File                                    | Description                              |
| --------------------------------------- | ---------------------------------------- |
| `src/shared/gateways/events.gateway.ts` | Example WebSocket gateway with ping/pong |

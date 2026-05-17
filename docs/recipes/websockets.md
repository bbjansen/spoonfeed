# WebSocket Recipes

Real-time bidirectional communication for NestJS using WebSocket gateways.

## Available Recipes

| Recipe     | Library                            | Best For                                               | Recipe README                                                       |
| ---------- | ---------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------- |
| WebSockets | Socket.io via `@nestjs/websockets` | Real-time events, chat, live dashboards, notifications | [websockets](../../packages/templates/recipes/websockets/README.md) |

## Architecture

NestJS WebSocket gateways are similar to controllers but handle persistent connections. They support rooms, namespaces, and bidirectional event-based communication.

```
Client <---> Socket.io <---> Gateway (NestJS) <---> Services
```

## Quick Start

```typescript
// events.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('message')
  handleMessage(@MessageBody() data: string, @ConnectedSocket() client: Socket) {
    this.server.emit('message', { sender: client.id, data });
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(@MessageBody() room: string, @ConnectedSocket() client: Socket) {
    client.join(room);
    client.to(room).emit('userJoined', { userId: client.id });
  }
}
```

```typescript
// events.module.ts
import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';

@Module({
  providers: [EventsGateway],
})
export class EventsModule {}
```

## Client Example

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

socket.on('connect', () => console.log('Connected'));
socket.emit('message', 'Hello from client');
socket.on('message', (data) => console.log('Received:', data));
```

## Authentication

Use a middleware or guard to authenticate WebSocket connections.

```typescript
@WebSocketGateway()
export class EventsGateway implements OnGatewayConnection {
  async handleConnection(client: Socket) {
    const token = client.handshake.auth.token;
    try {
      const user = await this.authService.validateToken(token);
      client.data.user = user;
    } catch {
      client.disconnect();
    }
  }
}
```

## External Documentation

- [NestJS WebSocket Gateways](https://docs.nestjs.com/websockets/gateways)
- [NestJS WebSocket Exception Filters](https://docs.nestjs.com/websockets/exception-filters)
- [Socket.io Documentation](https://socket.io/docs/v4/)
- [@nestjs/websockets](https://www.npmjs.com/package/@nestjs/websockets)
- [@nestjs/platform-socket.io](https://www.npmjs.com/package/@nestjs/platform-socket.io)

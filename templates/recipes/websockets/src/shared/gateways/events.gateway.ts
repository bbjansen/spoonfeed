import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/events',
})
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server: Server;

  afterInit(): void {
    this.logger.log('WebSocket gateway initialised');
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('ping')
  handlePing(
    @MessageBody() data: { timestamp: number },
    @ConnectedSocket() client: Socket,
  ): { event: string; data: { timestamp: number; serverTime: number } } {
    this.logger.debug(`Ping from ${client.id}: ${JSON.stringify(data)}`);

    return {
      event: 'pong',
      data: {
        timestamp: data.timestamp,
        serverTime: Date.now(),
      },
    };
  }

  broadcastEvent(event: string, payload: unknown): void {
    this.server.emit(event, payload);
  }
}

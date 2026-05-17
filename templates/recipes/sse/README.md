# Server-Sent Events

Lightweight real-time server-to-client streaming using the built-in NestJS `@Sse()` decorator.

## Links

- [NestJS Server-Sent Events](https://docs.nestjs.com/techniques/server-sent-events)

## Dependencies

None — SSE support is built into NestJS.

## Usage

```typescript
import { SseController } from '@/shared/gateways/events.sse.controller';

@Module({
  controllers: [SseController],
})
export class AppModule {}
```

Connect from a client:

```typescript
const source = new EventSource('http://localhost:3000/events/stream');
source.addEventListener('notification', (event) => {
  console.log(JSON.parse(event.data));
});
```

Push events from a service by injecting `SseController`:

```typescript
this.sseController.emit('notification', { message: 'Hello' });
```

## Generated Files

| File                                           | Description                               |
| ---------------------------------------------- | ----------------------------------------- |
| `src/shared/gateways/events.sse.controller.ts` | SSE controller with Subject-based emitter |

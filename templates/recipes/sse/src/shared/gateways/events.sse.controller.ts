import { Controller, Sse, MessageEvent } from '@nestjs/common';
import { Observable, Subject, map } from 'rxjs';

@Controller('events')
export class SseController {
  private readonly events$ = new Subject<{ type: string; data: unknown }>();

  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.events$.pipe(
      map((event) => ({
        type: event.type,
        data: JSON.stringify(event.data),
      })),
    );
  }

  emit(type: string, data: unknown): void {
    this.events$.next({ type, data });
  }
}

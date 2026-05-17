import { SseController } from '@/shared/gateways/events.sse.controller';

describe('SseController', () => {
  let controller: SseController;

  beforeEach(() => {
    controller = new SseController();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return an observable from stream()', () => {
    const stream$ = controller.stream();

    expect(stream$).toBeDefined();
    expect(typeof stream$.subscribe).toBe('function');
  });

  it('should emit events that are received by the stream', (done) => {
    const stream$ = controller.stream();

    stream$.subscribe((event) => {
      expect(event.type).toBe('user.created');
      expect(event.data).toBe(JSON.stringify({ id: 1 }));
      done();
    });

    controller.emit('user.created', { id: 1 });
  });
});

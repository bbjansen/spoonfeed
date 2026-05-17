import { EventsGateway } from '../../../../src/shared/gateways/events.gateway';

describe('EventsGateway', () => {
  let gateway: EventsGateway;

  beforeEach(() => {
    gateway = new EventsGateway();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('should have lifecycle hook methods', () => {
    expect(typeof gateway.afterInit).toBe('function');
    expect(typeof gateway.handleConnection).toBe('function');
    expect(typeof gateway.handleDisconnect).toBe('function');
  });

  it('should have a handlePing method', () => {
    expect(typeof gateway.handlePing).toBe('function');
  });
});

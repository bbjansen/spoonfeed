import { CircuitBreakerWrapper } from '@/shared/utils/circuit-breaker';

describe('CircuitBreakerWrapper', () => {
  it('should create an instance wrapping the provided action', () => {
    const action = jest.fn().mockResolvedValue('ok');
    const wrapper = new CircuitBreakerWrapper(action);

    expect(wrapper).toBeDefined();
    expect(wrapper.isOpen).toBe(false);
  });

  it('should delegate fire() to the underlying breaker and return the result', async () => {
    const action = jest.fn().mockResolvedValue('result');
    const wrapper = new CircuitBreakerWrapper(action);

    const result = await wrapper.fire('arg1');

    expect(result).toBe('result');
    expect(action).toHaveBeenCalledWith('arg1');
  });

  it('should return itself when registering a fallback', () => {
    const wrapper = new CircuitBreakerWrapper(jest.fn().mockResolvedValue('ok'));
    const result = wrapper.fallback(() => 'fallback');

    expect(result).toBe(wrapper);
  });
});

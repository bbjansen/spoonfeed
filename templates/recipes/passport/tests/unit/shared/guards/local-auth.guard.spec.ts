import { LocalAuthGuard } from '../../../../src/shared/guards/local-auth.guard';

describe('LocalAuthGuard', () => {
  let guard: LocalAuthGuard;

  beforeEach(() => {
    guard = new LocalAuthGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should be an instance of LocalAuthGuard', () => {
    expect(guard).toBeInstanceOf(LocalAuthGuard);
  });
});

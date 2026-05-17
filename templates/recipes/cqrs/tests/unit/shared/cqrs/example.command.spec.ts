import { CreateUserCommand, CreateUserHandler } from '../../../../src/shared/cqrs/example.command';

describe('CreateUserCommand', () => {
  it('should store email and name', () => {
    const command = new CreateUserCommand('user@example.com', 'Alice');
    expect(command.email).toBe('user@example.com');
    expect(command.name).toBe('Alice');
  });
});

describe('CreateUserHandler', () => {
  let handler: CreateUserHandler;

  beforeEach(() => {
    handler = new CreateUserHandler();
  });

  it('should return a user with a generated id', async () => {
    const command = new CreateUserCommand('bob@example.com', 'Bob');
    const result = await handler.execute(command);

    expect(result).toEqual(
      expect.objectContaining({
        email: 'bob@example.com',
        name: 'Bob',
      }),
    );
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe('string');
    expect(result.id.length).toBeGreaterThan(0);
  });

  it('should produce unique ids for different executions', async () => {
    const result1 = await handler.execute(new CreateUserCommand('a@b.com', 'A'));
    const result2 = await handler.execute(new CreateUserCommand('c@d.com', 'C'));
    expect(result1.id).not.toBe(result2.id);
  });
});

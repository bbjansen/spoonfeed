# CQRS

Command Query Responsibility Segregation pattern using the official NestJS CQRS module.

## Links

- [NestJS CQRS Recipe](https://docs.nestjs.com/recipes/cqrs)
- [@nestjs/cqrs on npm](https://www.npmjs.com/package/@nestjs/cqrs)
- [@nestjs/cqrs on GitHub](https://github.com/nestjs/cqrs)

## Dependencies

| Package        | Version  | Purpose                                               |
| -------------- | -------- | ----------------------------------------------------- |
| `@nestjs/cqrs` | `11.0.0` | CQRS module with commands, queries, events, and sagas |

## Usage

```typescript
import { CqrsModule } from '@nestjs/cqrs';
import { CreateUserCommand } from '@/shared/cqrs/example.command';

@Module({
  imports: [CqrsModule],
  providers: [CreateUserHandler],
})
export class UsersModule {}

// Dispatch a command
constructor(private readonly commandBus: CommandBus) {}

await this.commandBus.execute(new CreateUserCommand('alice@example.com', 'Alice'));
```

## Generated Files

| File                                 | Description                           |
| ------------------------------------ | ------------------------------------- |
| `src/shared/cqrs/example.command.ts` | Example command class and its handler |

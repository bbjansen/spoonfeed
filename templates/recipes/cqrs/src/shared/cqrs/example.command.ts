import { CommandHandler, ICommand, ICommandHandler } from '@nestjs/cqrs';
import { Logger } from '@nestjs/common';

export class CreateUserCommand implements ICommand {
  constructor(
    public readonly email: string,
    public readonly name: string,
  ) {}
}

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  private readonly logger = new Logger(CreateUserHandler.name);

  async execute(command: CreateUserCommand): Promise<{ id: string; email: string; name: string }> {
    this.logger.log(`Creating user: ${command.email}`);

    // Replace with actual persistence logic
    const user = {
      id: crypto.randomUUID(),
      email: command.email,
      name: command.name,
    };

    this.logger.log(`User created: ${user.id}`);

    return user;
  }
}

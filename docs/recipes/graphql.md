# GraphQL Recipes

GraphQL API layer for NestJS using Mercurius (Fastify-based) for high-performance schema execution.

## Available Recipes

| Recipe    | Engine              | Best For                           | Recipe README                                                                     |
| --------- | ------------------- | ---------------------------------- | --------------------------------------------------------------------------------- |
| Mercurius | Fastify + Mercurius | Performant GraphQL APIs on Fastify | [graphql-mercurius](../../packages/templates/recipes/graphql-mercurius/README.md) |

## Overview

Mercurius is a high-performance GraphQL adapter for Fastify. The NestJS integration supports both code-first and schema-first approaches, subscriptions, federation, and JIT compilation.

## Quick Start (Code-First)

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { MercuriusDriver, MercuriusDriverConfig } from '@nestjs/mercurius';

@Module({
  imports: [
    GraphQLModule.forRoot<MercuriusDriverConfig>({
      driver: MercuriusDriver,
      autoSchemaFile: true, // code-first: generates schema from decorators
      graphiql: true,
    }),
  ],
})
export class AppModule {}
```

```typescript
// users/user.model.ts
import { ObjectType, Field, ID } from '@nestjs/graphql';

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  email: string;

  @Field()
  name: string;
}
```

```typescript
// users/users.resolver.ts
import { Resolver, Query, Args, Mutation } from '@nestjs/graphql';
import { User } from './user.model';

@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  @Query(() => [User])
  users() {
    return this.usersService.findAll();
  }

  @Query(() => User)
  user(@Args('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Mutation(() => User)
  createUser(@Args('input') input: CreateUserInput) {
    return this.usersService.create(input);
  }
}
```

## Subscriptions

```typescript
@Resolver(() => Message)
export class MessagesResolver {
  @Subscription(() => Message)
  messageAdded() {
    return pubSub.asyncIterator('messageAdded');
  }
}
```

## External Documentation

- [NestJS GraphQL Quick Start](https://docs.nestjs.com/graphql/quick-start)
- [NestJS GraphQL Resolvers](https://docs.nestjs.com/graphql/resolvers)
- [Mercurius Documentation](https://mercurius.dev)
- [@nestjs/graphql](https://www.npmjs.com/package/@nestjs/graphql)
- [@nestjs/mercurius](https://www.npmjs.com/package/@nestjs/mercurius)

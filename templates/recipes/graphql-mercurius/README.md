# GraphQL with Mercurius

GraphQL API using Mercurius adapter for Fastify-based NestJS applications.

## Links

- [NestJS GraphQL Quick Start](https://docs.nestjs.com/graphql/quick-start)
- [Mercurius Documentation](https://mercurius.dev)
- [@nestjs/graphql on npm](https://www.npmjs.com/package/@nestjs/graphql)
- [@nestjs/mercurius on npm](https://www.npmjs.com/package/@nestjs/mercurius)
- [Mercurius on GitHub](https://github.com/mercurius-js/mercurius)

## Dependencies

| Package             | Version   | Purpose                      |
| ------------------- | --------- | ---------------------------- |
| `@nestjs/graphql`   | `13.0.4`  | NestJS GraphQL integration   |
| `@nestjs/mercurius` | `13.0.4`  | Mercurius adapter for NestJS |
| `mercurius`         | `15.1.0`  | Fastify GraphQL adapter      |
| `graphql`           | `16.10.0` | GraphQL runtime              |

## Usage

```typescript
import { GraphqlModule } from '@/infrastructure/graphql/graphql.module';

@Module({
  imports: [GraphqlModule],
})
export class AppModule {}
```

## Generated Files

| File                                           | Description                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| `src/infrastructure/graphql/graphql.module.ts` | GraphQL module configured with Mercurius and code-first approach |

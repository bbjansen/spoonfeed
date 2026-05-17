# Azure Cosmos DB

Azure Cosmos DB NoSQL database integration for NestJS.

## Documentation

- [Azure Cosmos DB Documentation](https://learn.microsoft.com/en-us/azure/cosmos-db/)
- [@azure/cosmos on npm](https://www.npmjs.com/package/@azure/cosmos)
- [@azure/identity on npm](https://www.npmjs.com/package/@azure/identity)

## Dependencies

| Package           | Version | Purpose                           |
| ----------------- | ------- | --------------------------------- |
| `@azure/cosmos`   | `4.2.0` | Azure Cosmos DB client            |
| `@azure/identity` | `4.5.0` | Azure identity and authentication |

## Environment Variables

| Variable          | Default | Description                |
| ----------------- | ------- | -------------------------- |
| `COSMOS_ENDPOINT` | —       | Cosmos DB account endpoint |
| `COSMOS_KEY`      | —       | Cosmos DB account key      |
| `COSMOS_DATABASE` | `app`   | Cosmos DB database name    |

## Usage

```typescript
import { CosmosDbService } from '@/azure/cosmos-db.service';

@Injectable()
export class UserRepository {
  constructor(private readonly cosmos: CosmosDbService) {}

  async findById(userId: string): Promise<User | undefined> {
    return this.cosmos.readItem<User>(
      this.configService.get('COSMOS_DATABASE'),
      'users',
      userId,
      userId,
    );
  }

  async save(user: User): Promise<void> {
    await this.cosmos.upsertItem(this.configService.get('COSMOS_DATABASE'), 'users', user);
  }

  async findByEmail(email: string): Promise<User[]> {
    return this.cosmos.queryItems<User>(
      this.configService.get('COSMOS_DATABASE'),
      'users',
      'SELECT * FROM c WHERE c.email = @email',
      [{ name: '@email', value: email }],
    );
  }
}
```

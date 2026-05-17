# AWS DynamoDB

Amazon DynamoDB NoSQL database integration for NestJS.

## Documentation

- [AWS DynamoDB Developer Guide](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/)
- [@aws-sdk/client-dynamodb on npm](https://www.npmjs.com/package/@aws-sdk/client-dynamodb)
- [@aws-sdk/lib-dynamodb on npm](https://www.npmjs.com/package/@aws-sdk/lib-dynamodb)

## Dependencies

| Package                    | Version   | Purpose                                    |
| -------------------------- | --------- | ------------------------------------------ |
| `@aws-sdk/client-dynamodb` | `3.712.0` | AWS SDK v3 DynamoDB client                 |
| `@aws-sdk/lib-dynamodb`    | `3.712.0` | Document client with automatic marshalling |

## Environment Variables

| Variable              | Default     | Description         |
| --------------------- | ----------- | ------------------- |
| `AWS_REGION`          | `eu-west-1` | AWS region          |
| `DYNAMODB_TABLE_NAME` | `app-table` | DynamoDB table name |

## Usage

```typescript
import { DynamoDbService } from '@/aws/dynamodb.service';

@Injectable()
export class UserRepository {
  constructor(private readonly dynamo: DynamoDbService) {}

  async findById(userId: string): Promise<User | undefined> {
    return this.dynamo.get({
      TableName: this.configService.get('DYNAMODB_TABLE_NAME'),
      Key: { PK: `USER#${userId}`, SK: `PROFILE` },
    });
  }

  async save(user: User): Promise<void> {
    await this.dynamo.put({
      TableName: this.configService.get('DYNAMODB_TABLE_NAME'),
      Item: { PK: `USER#${user.id}`, SK: 'PROFILE', ...user },
    });
  }
}
```

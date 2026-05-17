# AWS Cognito

AWS Cognito user pool authentication and authorization for NestJS.

## Documentation

- [AWS Cognito Developer Guide](https://docs.aws.amazon.com/cognito/latest/developerguide/)
- [@aws-sdk/client-cognito-identity-provider on npm](https://www.npmjs.com/package/@aws-sdk/client-cognito-identity-provider)
- [NestJS Authentication](https://docs.nestjs.com/security/authentication)

## Dependencies

| Package                                     | Version   | Purpose                   |
| ------------------------------------------- | --------- | ------------------------- |
| `@aws-sdk/client-cognito-identity-provider` | `3.712.0` | AWS SDK v3 Cognito client |

## Environment Variables

| Variable               | Default     | Description           |
| ---------------------- | ----------- | --------------------- |
| `AWS_REGION`           | `eu-west-1` | AWS region            |
| `COGNITO_USER_POOL_ID` | —           | Cognito user pool ID  |
| `COGNITO_CLIENT_ID`    | —           | Cognito app client ID |

## Usage

```typescript
import { CognitoAuthGuard } from '@/aws/cognito-auth.guard';
import { CurrentUser } from '@/auth/current-user.decorator';

@Controller('orders')
@UseGuards(CognitoAuthGuard)
export class OrdersController {
  @Get()
  findAll(@CurrentUser() user: CognitoUser) {
    return this.ordersService.findByUser(user.sub);
  }
}
```

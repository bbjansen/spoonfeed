# Azure Entra ID

Azure Entra ID (formerly Azure AD) authentication for NestJS.

## Documentation

- [Azure Entra ID Documentation](https://learn.microsoft.com/en-us/entra/identity/)
- [MSAL Node Documentation](https://learn.microsoft.com/en-us/entra/msal/node/)
- [@azure/msal-node on npm](https://www.npmjs.com/package/@azure/msal-node)
- [@azure/identity on npm](https://www.npmjs.com/package/@azure/identity)
- [NestJS Authentication](https://docs.nestjs.com/security/authentication)

## Dependencies

| Package            | Version  | Purpose                           |
| ------------------ | -------- | --------------------------------- |
| `@azure/msal-node` | `2.16.2` | Microsoft Authentication Library  |
| `@azure/identity`  | `4.5.0`  | Azure identity and authentication |

## Environment Variables

| Variable              | Default | Description                            |
| --------------------- | ------- | -------------------------------------- |
| `AZURE_TENANT_ID`     | —       | Azure Entra ID tenant ID               |
| `AZURE_CLIENT_ID`     | —       | Azure Entra ID client (application) ID |
| `AZURE_CLIENT_SECRET` | —       | Azure Entra ID client secret           |

## Usage

```typescript
import { EntraIdGuard } from '@/azure/entra-id.guard';
import { CurrentUser } from '@/auth/current-user.decorator';

@Controller('orders')
@UseGuards(EntraIdGuard)
export class OrdersController {
  @Get()
  findAll(@CurrentUser() user: EntraIdUser) {
    return this.ordersService.findByUser(user.oid);
  }
}
```

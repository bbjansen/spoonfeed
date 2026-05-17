# Azure Front Door

Azure Front Door CDN and global load balancer integration for NestJS.

## Documentation

- [Azure Front Door Documentation](https://learn.microsoft.com/en-us/azure/frontdoor/)
- [Restrict access to Azure Front Door origins](https://learn.microsoft.com/en-us/azure/frontdoor/origin-security)

## Dependencies

No additional npm dependencies are required. Front Door validation uses built-in NestJS guards.

## Environment Variables

| Variable                   | Default        | Description                                |
| -------------------------- | -------------- | ------------------------------------------ |
| `AZURE_FRONTDOOR_HOSTNAME` | —              | Azure Front Door hostname                  |
| `AZURE_FRONTDOOR_HEADER`   | `X-Azure-FDID` | Front Door ID header name                  |
| `AZURE_FRONTDOOR_ID`       | —              | Azure Front Door ID for request validation |

## Usage

```typescript
import { FrontDoorGuard } from '@/azure/front-door.guard';

@Controller()
@UseGuards(FrontDoorGuard)
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}

// Guard implementation
@Injectable()
export class FrontDoorGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const headerName = this.config.get('AZURE_FRONTDOOR_HEADER', 'X-Azure-FDID');
    const expectedId = this.config.get('AZURE_FRONTDOOR_ID');
    return request.headers[headerName.toLowerCase()] === expectedId;
  }
}
```

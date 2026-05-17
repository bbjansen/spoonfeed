# RBAC Authorization (CASL)

Role-based access control with CASL ability factory for NestJS.

## Resources

- [NestJS Authorization](https://docs.nestjs.com/security/authorization)
- [CASL Documentation](https://casl.js.org/v6/en/)

## Usage

### Role-based guard

Use the `@Roles()` decorator with the `RolesGuard` for simple role checks:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from '@/shared/decorators/roles.decorator';
import { RolesGuard } from '@/shared/guards/roles.guard';
import { Role } from '@/shared/auth/casl-ability.factory';

@Controller('admin')
@UseGuards(RolesGuard)
export class AdminController {
  @Get()
  @Roles(Role.Admin)
  findAll() {
    return 'Admin-only endpoint';
  }
}
```

### Policy-based guard

Use the `@CheckPolicies()` decorator with the `PoliciesGuard` for fine-grained CASL policies:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { CheckPolicies, PoliciesGuard, PolicyHandler } from '@/shared/guards/policies.guard';
import { AppAbility, Action } from '@/shared/auth/casl-ability.factory';

class ReadUserPolicy implements PolicyHandler {
  handle(ability: AppAbility): boolean {
    return ability.can(Action.Read, 'User');
  }
}

@Controller('users')
@UseGuards(PoliciesGuard)
export class UsersController {
  @Get()
  @CheckPolicies(new ReadUserPolicy())
  findAll() {
    return 'Users with read access';
  }
}
```

### Available roles

| Role         | Permissions                                       |
| ------------ | ------------------------------------------------- |
| `User`       | Read all, update own User record                  |
| `Admin`      | Read, create, and update all; cannot delete users |
| `SuperAdmin` | Full access to everything                         |

### Extending abilities

Add new subjects and conditions in `CaslAbilityFactory.createForUser()` to match your domain model.

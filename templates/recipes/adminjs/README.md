# AdminJS — Auto-Generated CRUD Admin Panel

An out-of-the-box admin panel powered by [AdminJS](https://adminjs.co/) that provides auto-generated CRUD interfaces for your entities.

## Links

- [AdminJS Website](https://adminjs.co/)
- [NestJS Plugin Docs](https://docs.adminjs.co/installation/plugins/nest-js)
- [npm — adminjs](https://www.npmjs.com/package/adminjs)

## Dependencies

| Package                  | Version |
| ------------------------ | ------- |
| `adminjs`                | 7.8.13  |
| `@adminjs/nestjs`        | 6.1.0   |
| `@adminjs/express`       | 6.1.0   |
| `express`                | 5.1.0   |
| `express-session`        | 1.18.1  |
| `express-formidable`     | 1.2.0   |
| `@types/express-session` | 1.18.1  |

## Environment Variables

| Variable         | Default             | Description            |
| ---------------- | ------------------- | ---------------------- |
| `ADMIN_EMAIL`    | `admin@example.com` | AdminJS login email    |
| `ADMIN_PASSWORD` | `changeme`          | AdminJS login password |

## Usage

### Registering a TypeORM Entity as a Resource

AdminJS uses ORM adapters to introspect your entities and generate CRUD interfaces automatically. Register the adapter once at startup, then add entities to the `resources` array in `AdminModule`.

```typescript
import AdminJS from 'adminjs';
import { Resource, Database } from '@adminjs/typeorm';

// Register the TypeORM adapter (do this once, e.g. in main.ts or admin.module.ts)
AdminJS.registerAdapter({ Resource, Database });
```

Then add your entity to the resources array in `admin.module.ts`:

```typescript
resources: [
  {
    resource: UserEntity,
    options: {
      properties: {
        password: { isVisible: false },
      },
    },
  },
],
```

### ORM Adapters

AdminJS supports multiple ORM adapters. Install the one matching your database layer:

| ORM       | Adapter Package      |
| --------- | -------------------- |
| TypeORM   | `@adminjs/typeorm`   |
| Prisma    | `@adminjs/prisma`    |
| Mongoose  | `@adminjs/mongoose`  |
| MikroORM  | `@adminjs/mikroorm`  |
| Sequelize | `@adminjs/sequelize` |

Each adapter follows the same pattern: install the package, call `AdminJS.registerAdapter()`, and pass your entities/models as resources.

## Generated Files

| File                                    | Description                         |
| --------------------------------------- | ----------------------------------- |
| `src/app/modules/admin/admin.module.ts` | AdminJS module with auth and config |

## Production Considerations

- **Change the session secret**: Replace `'secret-session-key-change-in-production'` in `admin.module.ts` with a strong, randomly generated secret stored as an environment variable.
- **Change admin credentials**: Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` to strong values. Consider integrating with your existing authentication system instead of env-var-based credentials.
- **Use a session store**: The default in-memory session store is not suitable for production. Use `connect-redis`, `connect-pg-simple`, or another persistent session store.

## Customization

### Custom Actions

Add custom actions to any resource:

```typescript
resources: [
  {
    resource: OrderEntity,
    options: {
      actions: {
        approve: {
          actionType: 'record',
          handler: async (request, response, context) => {
            const { record } = context;
            // custom approval logic
            return { record: record.toJSON(), msg: 'Order approved' };
          },
        },
      },
    },
  },
],
```

### Custom Components

Override default components with React-based custom components:

```typescript
const adminJsOptions = {
  branding: {
    companyName: 'My App',
    logo: '/logo.png',
  },
  dashboard: {
    component: AdminJS.bundle('./components/dashboard'),
  },
};
```

### Custom Dashboard

Create a custom dashboard by providing a React component:

```typescript
// components/dashboard.tsx
import React from 'react';
import { Box, H2 } from '@adminjs/design-system';

const Dashboard = () => (
  <Box>
    <H2>Welcome to the Admin Panel</H2>
  </Box>
);

export default Dashboard;
```

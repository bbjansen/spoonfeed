# Admin Panel Recipes

Auto-generated back-office administration panels for managing entities without building custom UIs.

## Available Recipes

| Recipe  | Library                                        | Best For                                            | Recipe README                                                 |
| ------- | ---------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------- |
| AdminJS | [AdminJS](https://adminjs.co/) + NestJS plugin | Internal tools, CRUD dashboards, content management | [adminjs](../../packages/templates/recipes/adminjs/README.md) |

## When to Use

- **Internal tools** — give ops/support staff a UI for managing users, orders, or content without a custom frontend.
- **Prototyping** — get a working admin panel in minutes during early development.
- **Content management** — lightweight CMS for entities that need manual editing.

AdminJS is **not** a replacement for a customer-facing UI. It is designed for internal, authenticated back-office use.

## Feature Overview

| Feature             | AdminJS                                 |
| ------------------- | --------------------------------------- |
| Auto-generated CRUD | Yes — reads entity metadata             |
| Custom actions      | Yes — register per-resource actions     |
| Dashboard           | Built-in, customisable with React       |
| Authentication      | Plugin-based (session, JWT)             |
| Database adapters   | TypeORM, MikroORM, Prisma, Mongoose     |
| Role-based access   | Via `accessFunction` per resource       |
| Theming             | CSS variables + custom React components |

## Quick Start

```typescript
import { Module } from '@nestjs/common';
import { AdminModule } from '@adminjs/nestjs';
import AdminJS from 'adminjs';
import { Database, Resource } from '@adminjs/typeorm';
import { User } from '@/users/user.entity';

AdminJS.registerAdapter({ Database, Resource });

@Module({
  imports: [
    AdminModule.createAdmin({
      adminJsOptions: {
        rootPath: '/admin',
        resources: [User],
        branding: { companyName: 'My App' },
      },
    }),
  ],
})
export class AppModule {}
```

## External Documentation

- [AdminJS Documentation](https://docs.adminjs.co/)
- [@adminjs/nestjs](https://www.npmjs.com/package/@adminjs/nestjs)
- [@adminjs/typeorm](https://www.npmjs.com/package/@adminjs/typeorm)
- [AdminJS Demo](https://demo.adminjs.co/)

# Mongoose

MongoDB integration using Mongoose ODM for NestJS applications.

## Links

- [NestJS MongoDB Documentation](https://docs.nestjs.com/techniques/mongodb)
- [Mongoose Documentation](https://mongoosejs.com)
- [@nestjs/mongoose on npm](https://www.npmjs.com/package/@nestjs/mongoose)
- [Mongoose on npm](https://www.npmjs.com/package/mongoose)
- [Mongoose on GitHub](https://github.com/Automattic/mongoose)

## Dependencies

| Package            | Version  | Purpose                             |
| ------------------ | -------- | ----------------------------------- |
| `@nestjs/mongoose` | `10.1.0` | NestJS Mongoose integration module  |
| `mongoose`         | `8.9.5`  | MongoDB object modeling for Node.js |

## Environment Variables

| Variable        | Default                     | Description            |
| --------------- | --------------------------- | ---------------------- |
| `MONGO_URI`     | `mongodb://localhost:27017` | MongoDB connection URI |
| `MONGO_DB_NAME` | —                           | Database name          |

## Usage

```typescript
import { DatabaseModule } from '@/infrastructure/database/database.module';

@Module({
  imports: [DatabaseModule],
})
export class AppModule {}
```

## Generated Files

| File                                             | Description                                             |
| ------------------------------------------------ | ------------------------------------------------------- |
| `src/infrastructure/database/database.module.ts` | MongooseModule configured with async connection factory |

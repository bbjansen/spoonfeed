# Input Sanitization

## Validation vs. Sanitization

| Concern          | Tool                                 | When                                               |
| ---------------- | ------------------------------------ | -------------------------------------------------- |
| **Validation**   | `class-validator` + `ValidationPipe` | Always -- reject invalid input                     |
| **Sanitization** | `class-transformer` + custom pipes   | When accepting rich text or user-generated content |
| **Encoding**     | Framework default                    | When rendering user input in responses             |

### Decision Tree

1. Can you reject the input entirely if it does not match an expected format? Use **validation**.
2. Must you accept free-form content but strip dangerous parts? Use **sanitization**.
3. Is the content stored and later rendered in HTML? Use **encoding** at the output boundary.

Always prefer validation over sanitization. Rejecting bad input is safer than trying to clean it.

## Global ValidationPipe Configuration

```typescript
import { ValidationPipe } from '@nestjs/common';

app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: false,
    },
    disableErrorMessages: process.env.NODE_ENV === 'production',
  }),
);
```

| Option                 | Purpose                                                |
| ---------------------- | ------------------------------------------------------ |
| `whitelist`            | Strips properties not in the DTO                       |
| `forbidNonWhitelisted` | Throws 400 if unknown properties are present           |
| `transform`            | Auto-transforms payloads into DTO class instances      |
| `disableErrorMessages` | Hides validation details in production error responses |

## SQL Injection Prevention

### Safe Patterns (Parameterized)

```typescript
// Repository methods -- always parameterized
const user = await repo.findOne({ where: { email } });

// Query builder with named parameters
const users = await repo
  .createQueryBuilder('user')
  .where('user.name = :name', { name })
  .andWhere('user.age > :minAge', { minAge: 18 })
  .getMany();

// Raw query with parameter binding
const results = await repo.query('SELECT * FROM users WHERE email = $1 AND status = $2', [
  email,
  'active',
]);
```

### Dangerous Patterns (Never Use)

```typescript
// String interpolation -- direct SQL injection vector
const users = await repo.query(`SELECT * FROM users WHERE name = '${name}'`);

// Template literal in where clause
const users = await repo.createQueryBuilder('user').where(`user.role = '${role}'`).getMany();

// Dynamic column/table names without allowlist
const users = await repo.query(`SELECT * FROM ${tableName} ORDER BY ${column}`);
```

### Safe Dynamic Column Names

When column names must come from user input, validate against an allowlist:

```typescript
const ALLOWED_SORT_COLUMNS = new Set(['name', 'email', 'created_at']);

function buildSortQuery(column: string, direction: 'ASC' | 'DESC') {
  if (!ALLOWED_SORT_COLUMNS.has(column)) {
    throw new BadRequestException(`Invalid sort column: ${column}`);
  }
  return repo.createQueryBuilder('user').orderBy(`user.${column}`, direction).getMany();
}
```

### Common SQL Injection Payloads to Guard Against

| Payload                            | Attack Type                 |
| ---------------------------------- | --------------------------- |
| `' OR '1'='1`                      | Authentication bypass       |
| `'; DROP TABLE users; --`          | Destructive query           |
| `' UNION SELECT * FROM secrets --` | Data exfiltration via UNION |
| `' AND 1=CONVERT(int,(SELECT..))`  | Error-based extraction      |
| `'; WAITFOR DELAY '0:0:10'; --`    | Time-based blind injection  |

All of these are neutralized by parameterized queries.

## NoSQL Injection Prevention (MongoDB)

### Operator Injection

MongoDB query operators like `$gt`, `$ne`, `$regex`, and `$where` can be injected through JSON payloads:

```typescript
// DANGEROUS -- attacker sends { "username": { "$ne": "" }, "password": { "$ne": "" } }
// This matches any document where both fields are non-empty
const user = await model.findOne({
  username: req.body.username,
  password: req.body.password,
});

// SAFE -- validate types before querying
if (typeof req.body.username !== 'string' || typeof req.body.password !== 'string') {
  throw new BadRequestException('Invalid credentials format');
}
const user = await model.findOne({
  username: req.body.username,
});
```

### Protecting Against $where and $regex

```typescript
// DANGEROUS -- allows arbitrary JavaScript execution
const results = await model.find({
  $where: `this.name === '${userInput}'`,
});

// DANGEROUS -- ReDoS via crafted regex
const results = await model.find({
  name: { $regex: userInput },
});

// SAFE -- escape special regex characters if regex search is needed
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const results = await model.find({
  name: { $regex: `^${escapeRegex(userInput)}$`, $options: 'i' },
});
```

### DTO-Level Protection

Use class-validator to enforce types before they reach the database layer:

```typescript
import { IsString, IsEmail, Length, Matches } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsEmail()
  email: string;

  @IsString()
  @Length(8, 128)
  password: string;
}

export class SearchDto {
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-zA-Z0-9\s\-]+$/, { message: 'Search query contains invalid characters' })
  query: string;
}
```

## XSS Prevention

### For APIs Returning User-Generated Content

APIs are less susceptible to XSS than server-rendered HTML, but stored XSS can still occur when API responses are rendered by frontend applications.

```typescript
import { Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class SanitizeHtmlPipe implements PipeTransform {
  transform(value: string): string {
    if (typeof value !== 'string') return value;
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
}
```

### Response Headers

Set security headers to instruct browsers to treat responses safely:

```typescript
import helmet from 'helmet';

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
      },
    },
    xContentTypeOptions: true, // X-Content-Type-Options: nosniff
  }),
);
```

### Content-Type Enforcement

Always return `application/json` for API responses. Never return `text/html` with user-supplied content:

```typescript
// The NestJS default is application/json -- do not override it with text/html
// If you must return HTML, sanitize with a library like DOMPurify (server-side via jsdom)
```

## Custom class-validator Decorators

### No HTML Tags

```typescript
import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export function NoHtmlTags(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'noHtmlTags',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return true;
          return !/<[^>]*>/g.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must not contain HTML tags`;
        },
      },
    });
  };
}
```

### Safe String (No Control Characters)

```typescript
export function IsSafeString(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isSafeString',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return true;
          // Allow printable ASCII, spaces, and common Unicode -- block control characters
          return !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} contains invalid control characters`;
        },
      },
    });
  };
}
```

### Usage in DTOs

```typescript
export class CreateArticleDto {
  @IsString()
  @Length(1, 200)
  @NoHtmlTags({ message: 'Title must not contain HTML' })
  @IsSafeString()
  title: string;

  @IsString()
  @Length(1, 10000)
  @IsSafeString()
  body: string;
}
```

## Checklist

- [ ] `ValidationPipe` is configured globally with `whitelist` and `forbidNonWhitelisted`
- [ ] All endpoints use DTOs with class-validator decorators
- [ ] No raw string interpolation in SQL or NoSQL queries
- [ ] Dynamic column/table names are validated against allowlists
- [ ] Security headers are set via `helmet`
- [ ] User-generated content is sanitized or encoded before storage
- [ ] File upload names are sanitized (strip path traversal characters)
- [ ] Request body size is limited (`app.use(json({ limit: '1mb' }))`)

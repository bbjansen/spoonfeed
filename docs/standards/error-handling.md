# Error Handling

## Exception Hierarchy

NestJS provides built-in HTTP exceptions. Use them directly or extend for domain-specific errors.

```
HttpException
  ├── BadRequestException        (400)
  ├── UnauthorizedException      (401)
  ├── ForbiddenException         (403)
  ├── NotFoundException          (404)
  ├── ConflictException          (409)
  ├── UnprocessableEntityException (422)
  ├── InternalServerErrorException (500)
  └── ServiceUnavailableException  (503)
```

### Custom Domain Exceptions

Extend `HttpException` for domain-specific errors that carry additional context:

```typescript
import { HttpException, HttpStatus } from '@nestjs/common';

export class InsufficientStockException extends HttpException {
  constructor(productId: string, requested: number, available: number) {
    super(
      {
        errorCode: 'INSUFFICIENT_STOCK',
        message: `Product ${productId} has ${available} units available, ${requested} requested`,
        details: { productId, requested, available },
      },
      HttpStatus.CONFLICT,
    );
  }
}
```

## Error Codes and Trace Codes

### Error Codes

Use uppercase snake_case error codes that are stable and machine-readable:

| Code                  | HTTP Status | Description                     |
| --------------------- | ----------- | ------------------------------- |
| `VALIDATION_ERROR`    | 400         | Request body/params invalid     |
| `UNAUTHORIZED`        | 401         | Missing or invalid credentials  |
| `FORBIDDEN`           | 403         | Authenticated but not permitted |
| `NOT_FOUND`           | 404         | Resource does not exist         |
| `CONFLICT`            | 409         | Resource state conflict         |
| `INSUFFICIENT_STOCK`  | 409         | Not enough inventory            |
| `RATE_LIMITED`        | 429         | Too many requests               |
| `INTERNAL_ERROR`      | 500         | Unexpected server error         |
| `SERVICE_UNAVAILABLE` | 503         | Downstream dependency failure   |

### Trace Codes

Every error response includes a unique `traceId` for correlating logs and support tickets:

```typescript
import { randomUUID } from 'node:crypto';

const traceId = randomUUID();
```

## Error Response Format

All error responses comply with [RFC 9457 — Problem Details for HTTP APIs](https://datatracker.ietf.org/doc/html/rfc9457) and are served with Content-Type `application/problem+json`.

### Standard RFC 9457 fields

| Field      | Description                                                    |
| ---------- | -------------------------------------------------------------- |
| `type`     | URN identifying the problem type (`urn:error:{error-code}`)    |
| `title`    | Short human-readable summary derived from the HTTP status code |
| `status`   | HTTP status code (number)                                      |
| `detail`   | Human-readable explanation specific to this occurrence         |
| `instance` | The request path where the error occurred                      |

### Extension fields

| Field              | Description                                           |
| ------------------ | ----------------------------------------------------- |
| `errorCode`        | Machine-readable error code (uppercase snake_case)    |
| `traceCode`        | Unique trace identifier for log correlation           |
| `timestamp`        | ISO 8601 timestamp of the error                       |
| `debugInformation` | Debug details (non-production only, `null` otherwise) |

### Example response

```json
{
  "type": "urn:error:insufficient-stock",
  "title": "Conflict",
  "status": 409,
  "detail": "Product abc-123 has 2 units available, 5 requested",
  "instance": "/api/orders",
  "traceCode": "A_ST_00001",
  "errorCode": "INSUFFICIENT_STOCK",
  "timestamp": "2026-05-11T14:30:00.000Z",
  "debugInformation": null
}
```

### Global Exception Filter

The global filter (`GlobalExceptionFilter` in `src/shared/filters/http-exception.filter.ts`) maps all exceptions to RFC 9457 problem details and sets the `application/problem+json` Content-Type. It handles three cases:

1. **`ApplicationError`** subclasses -- uses the error's own `errorCode`, `traceCode`, and `debugInfo`.
2. **`HttpException`** instances -- derives the `errorCode` from the HTTP status and generates a trace code.
3. **Unknown exceptions** -- treated as 500 Internal Server Error with a generated trace code.

The `type` field uses the `urn:error:{error-code}` scheme (e.g. `urn:error:not-found`). Teams can customize this to an HTTPS URI if a problem type registry is available.

## When to Throw vs. When to Return

### Throw an Exception When

- The operation cannot continue (missing resource, invalid state)
- The caller made an error (bad input, unauthorized)
- A downstream service is unavailable
- A business rule is violated

```typescript
async findOne(id: string): Promise<Order> {
  const order = await this.orderRepo.findOne({ where: { id } });
  if (!order) {
    throw new NotFoundException(`Order ${id} not found`);
  }
  return order;
}
```

### Return a Result When

- The outcome is expected and the caller needs to branch on it
- You are building a shared utility where exceptions would be surprising
- Performance-critical paths where exception overhead matters

```typescript
async tryReserveStock(productId: string, quantity: number): Promise<{ success: boolean; available: number }> {
  const stock = await this.stockRepo.findOne({ where: { productId } });
  if (!stock || stock.quantity < quantity) {
    return { success: false, available: stock?.quantity ?? 0 };
  }
  stock.quantity -= quantity;
  await this.stockRepo.save(stock);
  return { success: true, available: stock.quantity };
}
```

### General Rule

- Services that serve HTTP controllers: throw `HttpException` subclasses
- Services called by other services (internal): prefer returning results or throwing domain exceptions
- Never silently swallow errors -- either handle, rethrow, or log them

## Logging Errors

### What to Log

| Severity | Log Level | What to Include                       |
| -------- | --------- | ------------------------------------- |
| 5xx      | `error`   | Stack trace, traceId, request context |
| 4xx      | `warn`    | Error code, traceId, request path     |
| Expected | `debug`   | Business rule violation details       |

### What NOT to Log

- Passwords, tokens, API keys
- Full request bodies with PII
- Credit card numbers or sensitive financial data

```typescript
// correct
this.logger.error({
  traceId,
  errorCode: 'PAYMENT_FAILED',
  orderId: order.id,
  message: error.message,
  stack: error.stack,
});

// wrong -- leaks sensitive data
this.logger.error({
  creditCard: dto.cardNumber,
  password: dto.password,
});
```

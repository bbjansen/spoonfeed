# Seq

Structured log shipping to Seq via the seq-logging transport.

## Links

- [Seq Overview](https://docs.datalust.co/docs/an-overview-of-seq)
- [seq-logging on npm](https://www.npmjs.com/package/seq-logging)
- [seq-logging on GitHub](https://github.com/datalust/seq-logging)

## Dependencies

| Package       | Version | Purpose                                 |
| ------------- | ------- | --------------------------------------- |
| `seq-logging` | `2.0.1` | HTTP transport for shipping logs to Seq |

## Environment Variables

| Variable         | Description                    | Example                 |
| ---------------- | ------------------------------ | ----------------------- |
| `SEQ_SERVER_URL` | Seq server ingestion endpoint  | `http://localhost:5341` |
| `SEQ_API_KEY`    | Seq API key for authentication | `abcdef1234567890`      |

## Usage

```typescript
import { SeqTransport } from '@/infrastructure/logging/seq.transport';

const seq = new SeqTransport({
  serverUrl: 'http://localhost:5341',
  apiKey: 'your-api-key',
});

seq.log('Information', 'User {UserId} logged in', { UserId: 42 });
```

## Generated Files

| File                                          | Description                            |
| --------------------------------------------- | -------------------------------------- |
| `src/infrastructure/logging/seq.transport.ts` | Seq log transport wrapping seq-logging |

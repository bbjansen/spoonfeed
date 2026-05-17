# Worker Threads

Offload CPU-intensive tasks to worker threads using the Node.js built-in `worker_threads` module.

## When to Use

Worker threads are appropriate for **CPU-intensive** operations that would block the event loop:

- Image processing and resizing
- PDF generation
- Cryptographic operations (hashing, encryption)
- Data compression
- Heavy mathematical computations
- Parsing large files (CSV, XML)

## When NOT to Use

Do **not** use worker threads for I/O-bound work. Node.js already handles these asynchronously:

- Database queries
- HTTP requests
- File system reads/writes
- Message queue operations

## Usage

Inject `WorkerPool` and call `run<T>(script, data)`:

```typescript
import { WorkerPool } from '@/shared/utils/worker-pool';

@Injectable()
export class ImageProcessor {
  constructor(private readonly workerPool: WorkerPool) {}

  async resize(imagePath: string, width: number): Promise<Buffer> {
    return this.workerPool.run<Buffer>(path.join(__dirname, 'workers/resize.worker.js'), {
      imagePath,
      width,
    });
  }
}
```

### Worker Script

Worker scripts receive data via `workerData` and return results via `parentPort.postMessage()`:

```typescript
import { parentPort, workerData } from 'node:worker_threads';

const { imagePath, width } = workerData;

// ... perform CPU-intensive work ...

parentPort?.postMessage(result);
```

## Pool Configuration

The pool automatically sizes itself to `os.cpus().length - 1`, reserving one core for the main event loop. Tasks that exceed the pool size are queued and processed as workers become available.

## Dependencies

None. Uses the Node.js built-in `worker_threads` module.

## Generated Files

| File                              | Description                                  |
| --------------------------------- | -------------------------------------------- |
| `src/shared/utils/worker-pool.ts` | Injectable worker pool with automatic sizing |

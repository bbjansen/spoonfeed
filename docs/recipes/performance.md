# Performance Recipes

Patterns for improving throughput, resilience, and response times in NestJS applications.

## Available Recipes

| Recipe          | Pattern / Tool                 | Best For                                        | Recipe README                                                                 |
| --------------- | ------------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------- |
| Worker Threads  | Node.js `worker_threads`       | CPU-intensive tasks (image processing, hashing) | [worker-threads](../../packages/templates/recipes/worker-threads/README.md)   |
| Circuit Breaker | Opossum circuit breaker        | Fault tolerance for external service calls      | [circuit-breaker](../../packages/templates/recipes/circuit-breaker/README.md) |
| HTTP Caching    | RFC 9111 Cache-Control headers | Reducing redundant responses, CDN integration   | [http-caching](../../packages/templates/recipes/http-caching/README.md)       |

## When to Use Each

- **Worker Threads** — when a synchronous CPU-bound operation (PDF generation, image resizing, cryptographic hashing) blocks the event loop and degrades throughput for other requests.
- **Circuit Breaker** — when your service calls an external dependency (third-party API, downstream microservice) that may become slow or unresponsive, risking cascading failures.
- **HTTP Caching** — when responses are cacheable and you want clients or CDNs to serve them from cache, reducing server load and improving perceived latency.

## Comparison

| Feature          | Worker Threads            | Circuit Breaker                           | HTTP Caching                  |
| ---------------- | ------------------------- | ----------------------------------------- | ----------------------------- |
| Primary concern  | CPU offloading            | Fault tolerance                           | Response caching              |
| Where it runs    | Server (separate thread)  | Server (wrapper around calls)             | Client / CDN / proxy          |
| Performance gain | Unblocks event loop       | Prevents cascade failures                 | Eliminates server round-trips |
| Complexity       | Medium (thread lifecycle) | Low (decorator / wrapper)                 | Low (headers)                 |
| Dependencies     | Node.js built-in          | opossum                                   | None (HTTP standard)          |
| Observability    | Worker error events       | State transitions (open/closed/half-open) | Cache hit/miss headers        |

## Quick Start: Circuit Breaker

```typescript
import { Injectable } from '@nestjs/common';
import CircuitBreaker from 'opossum';

@Injectable()
export class PaymentGateway {
  private breaker: CircuitBreaker;

  constructor(private readonly httpService: HttpService) {
    this.breaker = new CircuitBreaker((payload: ChargeDto) => this.callProvider(payload), {
      timeout: 3000, // 3s per call
      errorThresholdPercentage: 50,
      resetTimeout: 30_000, // try again after 30s
    });

    this.breaker.on('open', () => console.warn('Circuit OPEN — calls will be rejected'));
    this.breaker.on('halfOpen', () => console.info('Circuit HALF-OPEN — testing'));
    this.breaker.on('close', () => console.info('Circuit CLOSED — recovered'));
  }

  charge(payload: ChargeDto) {
    return this.breaker.fire(payload);
  }

  private async callProvider(payload: ChargeDto) {
    const { data } = await this.httpService.axiosRef.post('/charge', payload);
    return data;
  }
}
```

## Decision Guide

| Symptom                                     | Recipe          |
| ------------------------------------------- | --------------- |
| Event loop lag spikes during heavy requests | Worker Threads  |
| Downstream service outages cascade upstream | Circuit Breaker |
| Identical GET responses served repeatedly   | HTTP Caching    |

## External Documentation

- [Node.js Worker Threads](https://nodejs.org/api/worker_threads.html)
- [Opossum Circuit Breaker](https://nodeshift.dev/opossum/)
- [RFC 9111 — HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111)
- [NestJS Performance (FAQ)](https://docs.nestjs.com/faq/performance)

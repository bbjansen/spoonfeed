# ADR-013: Fastify as Default HTTP Adapter

## Status

Accepted

## Date

2026-04-01

## Context

NestJS supports two HTTP adapters: Express (`@nestjs/platform-express`) and Fastify (`@nestjs/platform-fastify`). The choice of adapter affects request throughput, plugin architecture, and middleware compatibility across all scaffolded projects.

## Decision

Use Fastify as the default HTTP adapter for all project types that handle HTTP traffic (HTTP API, Full-Stack, Lambda). Provide an `express-adapter` recipe for teams that require Express middleware compatibility.

The base template configures Fastify in `main.ts`:

```ts
const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
```

## Consequences

### Positive

- 2-3x higher throughput than Express in synthetic benchmarks (JSON serialization, route matching)
- Schema-based request validation via Fastify's built-in JSON Schema support
- Encapsulated plugin system prevents global state leaks between modules
- First-class TypeScript support with typed request/reply objects
- Fastify v5 lifecycle hooks align well with NestJS interceptors and guards

### Negative

- Express middleware packages (e.g., `express-session`, `passport` strategies using `req`/`res` directly) require the `@fastify/middie` compatibility layer or Fastify-native alternatives
- Smaller plugin ecosystem compared to Express — some niche middleware has no Fastify equivalent
- Developers familiar only with Express face a minor learning curve for Fastify's plugin model

### Risks

- Breaking changes in Fastify major versions — mitigated by exact version pinning and the scaffolder's dependency audit workflow

## Alternatives Considered

### Express (default)

- **Pros:** Largest middleware ecosystem, most developer familiarity
- **Cons:** Slower request handling, callback-oriented internals, no built-in schema validation
- **Why not:** Performance cost is measurable at scale; available as the `express-adapter` recipe for teams that need it

### Koa / Hono

- **Pros:** Lightweight, modern API design
- **Cons:** No official NestJS adapter, no DI integration
- **Why not:** NestJS only ships adapters for Express and Fastify

## References

- [Fastify Benchmarks](https://fastify.dev/benchmarks/)
- [NestJS Performance (Fastify)](https://docs.nestjs.com/techniques/performance)
- Recipe: `express-adapter`

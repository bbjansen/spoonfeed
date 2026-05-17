# ADR-020: Frontend Framework Support for Full-Stack Projects

## Status

Accepted

## Date

2026-04-01

## Context

The Full-Stack project type (ADR-019) requires a frontend framework alongside the NestJS API. Teams have strong preferences for their frontend stack, and prescribing a single framework would limit adoption.

## Decision

Support four frontend frameworks as sub-selections within the Full-Stack project type:

| Framework      | Package                      | Rendering       | Use Case                      |
| -------------- | ---------------------------- | --------------- | ----------------------------- |
| **Next.js**    | `next`, `react`, `react-dom` | SSR / SSG / ISR | SEO-critical apps, dashboards |
| **Vite React** | `vite`, `react`, `react-dom` | SPA (CSR)       | Internal tools, admin panels  |
| **Nuxt**       | `nuxt`, `vue`                | SSR / SSG       | Vue-based teams               |
| **SvelteKit**  | `@sveltejs/kit`, `svelte`    | SSR / SSG       | Performance-focused apps      |

Each framework selection generates:

- **Proxy configuration:** API calls from the frontend dev server proxy to the NestJS API (e.g., Vite's `server.proxy`, Next.js rewrites)
- **Directory structure:** `apps/web/` for the frontend, `apps/api/` for the NestJS backend
- **AI context:** Framework-specific CLAUDE.md sections, `.cursor/rules`, and `.github/copilot-instructions.md`
- **Build integration:** Unified `pnpm build` that compiles both frontend and API
- **Docker configuration:** Multi-stage Dockerfile serving the frontend via the NestJS API or a separate container

## Consequences

### Positive

- Teams use their preferred frontend framework without ejecting from the boilerplate
- Proxy configuration eliminates CORS issues during local development
- AI context per framework improves code generation quality in Cursor, Copilot, and Claude
- Shared TypeScript types between frontend and API via monorepo workspace packages

### Negative

- Four frontend frameworks quadruple the frontend template maintenance burden
- Framework-specific build quirks (Next.js standalone output, SvelteKit adapters) require per-framework Docker configs
- Keeping AI context accurate across framework version updates is ongoing work

### Risks

- Framework deprecation or major API changes — mitigated by supporting only actively maintained frameworks with large communities

## References

- ADR-019: Project Type Design
- ADR-010: AI Context Generation
- ADR-012: Monorepo Strategy

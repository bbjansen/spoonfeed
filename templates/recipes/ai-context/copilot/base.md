# GitHub Copilot Instructions

## Project Overview

This is a NestJS application using Fastify, built with TypeScript and managed with pnpm.

## Code Conventions

### Imports

- Use `@/*` path alias for all internal imports (maps to `src/*`)
- Never use relative paths like `../../`

### Architecture

- 3-layer architecture: Controller -> Service -> Repository
- Controllers: HTTP concerns only, delegate to services
- Services: business logic, max 200 lines, no private methods
- Extract helpers into separate injectable classes

### File Naming

- Services: `<name>.service.ts`
- Controllers: `<name>.controller.ts`
- Modules: `<name>.module.ts`
- Entities: `<name>.entity.ts`
- DTOs: `<name>.dto.ts` inside `dto/` subdirectory
- Use descriptive suffixes for non-standard classes: `.processor.ts`, `.importer.ts`, `.scheduler.ts`

### DTOs and Validation

- Use `class-validator` decorators on all request DTOs
- Use `class-transformer` for response serialization
- Add `@ApiProperty()` to every DTO property for Swagger

### Modules

- Organize by feature domain, not by technical layer
- Each feature gets its own module directory under `src/`
- Export only what other modules need

### Error Handling

- Use NestJS built-in exceptions (`NotFoundException`, `BadRequestException`, etc.)
- Let the global exception filter handle unexpected errors
- Never catch exceptions just to rethrow them

## Testing

- Tests live in `tests/` at the project root, mirroring `src/` structure
- Unit tests: `tests/unit/` with `.spec.ts` suffix
- Integration tests: `tests/integration/` with `.integration.spec.ts` suffix
- E2E tests: `tests/e2e/` with `.e2e-spec.ts` suffix
- Mock only external dependencies — never mock code you own
- Use `Test.createTestingModule()` from `@nestjs/testing`
- Test factories go in `tests/factories/`

## Commands

- `pnpm start:dev` — start with file watching
- `pnpm build` — compile to `dist/`
- `pnpm test` — run unit tests
- `pnpm test:integration` — run integration tests
- `pnpm test:e2e` — run e2e tests
- `pnpm test:cov` — run tests with coverage

## Commits

Use Conventional Commits: `<type>(<scope>): <description>`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`

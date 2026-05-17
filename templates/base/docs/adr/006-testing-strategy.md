# ADR-006: Three-Layer Testing with Testcontainers

## Status

Accepted

## Date

2026-02-20

## Context

Effective testing requires different layers: fast unit tests for business logic, integration tests with real databases, and E2E tests for the HTTP boundary. Mocking databases in integration tests leads to false confidence.

## Decision

Use a three-layer testing strategy:

- **Unit tests** (`tests/unit/`) — Mock external dependencies only, fast execution
- **Integration tests** (`tests/integration/`) — Real databases via Testcontainers, test module wiring
- **E2E tests** (`tests/e2e/`) — Full app via Supertest, test HTTP boundary

Tests live in `tests/` at the project root, mirroring the `src/` structure.

## Consequences

### Positive

- Integration tests catch real database issues that mocks miss
- Testcontainers provide disposable, isolated database instances
- Three layers give confidence at different granularities

### Negative

- Integration tests are slower (container startup)
- Requires Docker for integration tests
- CI pipeline needs Docker-in-Docker or service containers

### Risks

- Flaky tests from container timeouts — mitigated by 30s timeout and health checks

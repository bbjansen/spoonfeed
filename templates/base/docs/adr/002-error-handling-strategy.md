# ADR-002: RFC 9457 Problem Details for Error Responses

## Status

Accepted

## Date

2026-01-15

## Context

APIs need a standardized error response format that is machine-readable, extensible, and compatible with industry tooling. Custom error formats require consumers to learn a bespoke schema.

## Decision

Use RFC 9457 (Problem Details for HTTP APIs) as the error response format. All error responses use `Content-Type: application/problem+json` with the required fields: `type`, `title`, `status`, `detail`, `instance`.

Custom extensions: `traceCode` (static, grep-searchable error identifier), `errorCode` (machine-readable error type), `timestamp`, and `debugInformation` (non-production only).

## Consequences

### Positive

- Industry standard format recognized by API gateways, monitoring tools, and client libraries
- `traceCode` enables instant error location via grep
- `debugInformation` separated from production responses prevents information leakage

### Negative

- Slightly larger response payload than a minimal custom format
- Consumers unfamiliar with RFC 9457 may need documentation

### Risks

- Breaking change if migrating from a custom error format — mitigated by versioned API rollout

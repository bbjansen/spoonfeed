# ADR-008: Composable Recipe System

## Status

Accepted

## Date

2026-03-01

## Context

A general-purpose boilerplate needs to support many optional features (databases, auth, caching, cloud providers, deployment). Shipping everything in one monolithic template would create bloated projects with unused dependencies.

## Decision

Implement a composable recipe system where each feature is an independent recipe with:

- Dependencies (exact versions, no ranges)
- Template files (source code, config)
- Environment variables
- Conflict declarations (mutually exclusive recipes)
- Dependency declarations (required prerequisites)
- AI context (CLAUDE.md sections, Cursor rules, Copilot instructions)
- README documentation with links

Recipes are selected interactively during project scaffolding and merged into the base template.

## Consequences

### Positive

- Projects only include what they need — no unused dependencies
- Recipes are independently maintainable and testable
- Conflict detection prevents incompatible combinations (e.g., Pino + Winston)
- Smart defaults per project type reduce decision fatigue
- Cloud-aware defaults auto-select relevant services

### Negative

- Recipe count (100+) can be overwhelming in the CLI prompt
- Some recipes interact in ways not captured by simple conflict/requires declarations
- Recipe template files may conflict with each other when writing to the same directory

### Risks

- Version drift between recipe dependencies — mitigated by exact version pinning and periodic dependency audits

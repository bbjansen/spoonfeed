# ADR-010: AI Assistant Context Generation

## Status

Accepted

## Date

2026-03-15

## Context

Modern development teams use AI coding assistants (Claude Code, Cursor, GitHub Copilot). These tools perform better when given project-specific context about patterns, conventions, and available APIs.

## Decision

Generate AI context files for three assistants as part of project scaffolding:

- **CLAUDE.md** — Project-level instructions for Claude Code (package manager, imports, testing, commands, active recipes)
- **.cursor/rules/\*.mdc** — Cursor rules for framework-specific patterns (NestJS backend, React/Vue/Svelte frontend)
- **.github/copilot-instructions.md** — GitHub Copilot project instructions

Context is assembled from:

1. Base instructions (common to all projects)
2. Recipe-specific sections (each recipe contributes its own context)
3. Frontend framework rules (for full-stack projects)

## Consequences

### Positive

- AI assistants understand project conventions immediately
- Recipe-specific context prevents AI from suggesting patterns that conflict with selected tools
- Frontend-specific rules guide AI on framework idioms (Server Components in Next.js, Composition API in Vue, etc.)

### Negative

- Context files add ~20-30 lines per recipe to CLAUDE.md
- Teams using other AI tools (Windsurf, Cody) don't benefit without manual adaptation

### Risks

- AI context becoming stale as patterns evolve — mitigated by keeping context co-located with recipe templates

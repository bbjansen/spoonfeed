# Code Review Guidelines

## PR Size Limits

| Size   | Lines Changed | Review Expectation         |
| ------ | ------------- | -------------------------- |
| Small  | < 100         | Quick review, same day     |
| Medium | 100 -- 400    | Standard review, 1 day SLA |
| Large  | 400+          | Split into smaller PRs     |

**Recommended maximum: 400 lines changed.** PRs exceeding this threshold should be split unless the changes are mechanical (e.g., a rename, a migration, generated code).

## What Reviewers Should Check

### Correctness

- Does the code do what the PR description claims?
- Are edge cases handled (null, empty, boundary values)?
- Are error paths covered with appropriate exceptions?
- Do database queries perform well at scale?

### Design

- Does the change follow existing patterns in the codebase?
- Is the responsibility properly placed (controller vs. service vs. utility)?
- Are services under 200 lines with a single responsibility?
- Are there unnecessary abstractions or premature optimizations?

### Security

- No secrets, tokens, or credentials in code
- Input validation on all endpoints (`class-validator` DTOs)
- Authorization checks for protected resources
- SQL injection prevention (parameterized queries)

### Testing

- Are unit tests included for new logic?
- Do tests cover happy path, edge cases, and error paths?
- Are only external dependencies mocked?
- Do existing tests still pass?

### Readability

- Are names descriptive and consistent with the codebase?
- Is the code self-documenting, or are comments needed for complex logic?
- Are `@/` import aliases used instead of relative paths?
- Is dead code removed?

## Approval Requirements

| Change Type           | Required Approvals | Additional Rules             |
| --------------------- | ------------------ | ---------------------------- |
| Feature / enhancement | 1                  | Must include tests           |
| Bug fix               | 1                  | Must include regression test |
| Security fix          | 2                  | Fast-track review            |
| Breaking change       | 2                  | Migration guide required     |
| Infrastructure / CI   | 1                  | Ops team member              |
| Documentation only    | 1                  | Any team member              |

## Review SLA Expectations

| Priority | First Review Within | Final Decision Within |
| -------- | ------------------- | --------------------- |
| Critical | 2 hours             | 4 hours               |
| High     | 4 hours             | 1 business day        |
| Normal   | 1 business day      | 2 business days       |
| Low      | 2 business days     | 3 business days       |

### Requesting Urgent Review

- Add the `urgent` label to the PR
- Post in the team channel with a link and context
- Tag specific reviewers in the PR description

## Common Anti-Patterns to Flag

### Architecture

- **God service** -- A service with too many responsibilities or exceeding 200 lines. Suggest splitting by domain.
- **Circular dependencies** -- Modules importing each other. Refactor to extract shared logic into a separate module.
- **Business logic in controllers** -- Controllers should delegate to services, not contain logic.
- **Private methods in services** -- Extract to a separate class that can be tested independently.

### Code Quality

- **Magic numbers/strings** -- Extract to named constants or configuration.
- **Deeply nested conditionals** -- Refactor using early returns or guard clauses.
- **Copy-paste duplication** -- Extract shared logic to a utility or base class.
- **Unused imports or variables** -- Remove or the linter should catch them.

### Testing

- **Mocking internal code** -- Only mock external dependencies (databases, HTTP, SDKs).
- **Testing implementation details** -- Test behavior and outcomes, not internal method calls.
- **No assertion in test** -- Every test must assert something meaningful.
- **Snapshot overuse** -- Prefer explicit assertions over snapshot tests for logic.

### Security

- **Hardcoded credentials** -- Use environment variables or secret managers.
- **Missing validation** -- All DTOs must use `class-validator` decorators.
- **Overly permissive CORS** -- Avoid `origin: '*'` in production.
- **Logging sensitive data** -- Never log passwords, tokens, or PII.

## Review Etiquette

- Be specific: point to the line, explain the concern, suggest an alternative
- Distinguish between blocking issues and suggestions (use "nit:" prefix for non-blocking)
- Approve with minor comments when changes are trivial
- If requesting changes, explain what needs to change and why
- Avoid bikeshedding on style issues that the linter already handles

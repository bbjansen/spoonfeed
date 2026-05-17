# Security Audit Practices

## npm Audit Workflow

### Regular Auditing

```bash
# Check for known vulnerabilities
pnpm audit

# JSON output for CI pipelines
pnpm audit --json

# Production dependencies only
pnpm audit --prod
```

### Fixing Vulnerabilities

```bash
# Check what's outdated
pnpm outdated

# Update a specific package to a patched version (always exact)
pnpm add -E package-name@patched-version

# Verify the fix
pnpm audit

# Commit both files
git add package.json pnpm-lock.yaml
git commit -m "fix(security): update package-name to x.y.z

Fixes CVE-2024-XXXX"
```

### CI Integration

Add an audit step to your pipeline that fails on high/critical vulnerabilities:

```yaml
- name: Security audit
  run: pnpm audit --audit-level=high
```

### Handling False Positives

When a vulnerability does not affect your usage, document it in `.pnpmaudit.json` or add a pipeline exception with a comment explaining why.

## Gitleaks for Secret Scanning

### Installation

```bash
brew install gitleaks
```

### Usage

```bash
# Scan the entire git history
gitleaks detect --source . -v

# Scan only staged changes (pre-commit)
gitleaks protect --staged -v

# Generate a report
gitleaks detect --source . --report-format json --report-path gitleaks-report.json
```

### Pre-commit Hook

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
```

### Allowlist Configuration

Create `.gitleaks.toml` for false positives:

```toml
[allowlist]
description = "Allowlisted items"
paths = [
  '''tests/fixtures/.*''',
  '''.*\.example\.env''',
]
```

## OWASP Top 10 Checklist for NestJS

| #   | Risk                          | NestJS Mitigation                                           |
| --- | ----------------------------- | ----------------------------------------------------------- |
| 1   | Broken Access Control         | Guards (`@UseGuards`), RBAC decorators, ownership checks    |
| 2   | Cryptographic Failures        | Use `bcrypt` for passwords, TLS in transit, encrypt at rest |
| 3   | Injection                     | Parameterized queries (TypeORM/Prisma), `class-validator`   |
| 4   | Insecure Design               | Input validation on all endpoints, rate limiting            |
| 5   | Security Misconfiguration     | Helmet middleware, disable `x-powered-by`, strict CORS      |
| 6   | Vulnerable Components         | `pnpm audit`, exact versions, regular updates               |
| 7   | Auth Failures                 | JWT with short expiry, refresh token rotation, MFA          |
| 8   | Data Integrity Failures       | Verify package checksums, sign releases, use lockfile       |
| 9   | Logging & Monitoring Failures | Structured logging, audit trails, alerting                  |
| 10  | SSRF                          | Validate/allowlist outbound URLs, block internal ranges     |

### NestJS-Specific Security Setup

```typescript
// main.ts
import helmet from '@fastify/helmet';

const app = await NestFactory.create(AppModule, new FastifyAdapter());

// Security headers
await app.register(helmet);

// CORS
app.enableCors({
  origin: process.env.CORS_ORIGINS?.split(',') ?? [],
  credentials: true,
});

// Global validation
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true, // Strip unknown properties
    forbidNonWhitelisted: true, // Reject unknown properties
    transform: true,
  }),
);

// Rate limiting
app.useGlobalGuards(new ThrottlerGuard());
```

## Dependency Update Strategy

### Frequency

| Category         | Frequency   | Automation         |
| ---------------- | ----------- | ------------------ |
| Security patches | Immediately | Dependabot alerts  |
| Patch versions   | Weekly      | Dependabot PRs     |
| Minor versions   | Bi-weekly   | Manual review      |
| Major versions   | Quarterly   | Manual + changelog |

### Process

1. Review the changelog for breaking changes
2. Update one package at a time with exact version
3. Run the full test suite
4. Test in a staging environment before production
5. Commit `package.json` and `pnpm-lock.yaml` together

### Dependabot Configuration

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 10
    versioning-strategy: increase
```

## Container Image Scanning

### Trivy

```bash
# Scan a local image
trivy image my-app:latest

# Scan with severity filter
trivy image --severity HIGH,CRITICAL my-app:latest

# Output as JSON for CI
trivy image --format json --output trivy-report.json my-app:latest

# Scan filesystem (without building image)
trivy fs --security-checks vuln,config .
```

### CI Integration

```yaml
- name: Scan container image
  run: |
    trivy image --exit-code 1 --severity HIGH,CRITICAL ${{ env.IMAGE_TAG }}
```

### Dockerfile Best Practices for Security

```dockerfile
# Use specific digest, not just tag
FROM node:20-alpine@sha256:abc123...

# Run as non-root
RUN addgroup -S app && adduser -S app -G app
USER app

# Copy only production artifacts
COPY --chown=app:app dist/ ./dist/
COPY --chown=app:app node_modules/ ./node_modules/

# No shell access in production
RUN rm -rf /bin/sh
```

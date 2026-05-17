# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

**Do NOT open a public issue.**

Instead, send an email to **security@example.com** with:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Response Timeline

- **Acknowledgement:** Within 48 hours
- **Initial assessment:** Within 5 business days
- **Fix timeline:** Depends on severity (critical: 24-72 hours, high: 1 week, medium: 2 weeks)

## Supported Versions

| Version | Supported |
| ------- | --------- |
| Latest  | Yes       |

## Security Best Practices

This project follows:

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- Dependency scanning via `pnpm audit`
- Secret scanning via Gitleaks (pre-commit hook)
- Pinned dependency versions (no version ranges)

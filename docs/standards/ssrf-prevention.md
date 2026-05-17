# SSRF Prevention

## Overview

Server-Side Request Forgery (SSRF) occurs when an attacker can make the server send HTTP requests to unintended destinations, potentially accessing internal services, cloud metadata endpoints (e.g., `169.254.169.254`), or other resources behind the firewall.

## Prevention Patterns

### 1. URL Allowlist

Only allow requests to known, trusted domains:

```typescript
const ALLOWED_HOSTS = new Set(['api.example.com', 'cdn.example.com']);

function validateUrl(url: string): boolean {
  const parsed = new URL(url);
  return ALLOWED_HOSTS.has(parsed.hostname);
}
```

### 2. URL Scheme Restriction

Block dangerous URL schemes. Only `http://` and `https://` should be allowed:

```typescript
const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

function validateScheme(url: string): void {
  const parsed = new URL(url);
  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    throw new ForbiddenException(
      `Blocked URL scheme: ${parsed.protocol}. Only HTTP and HTTPS are allowed.`,
    );
  }
}
```

Schemes to block explicitly:

| Scheme      | Risk                                              |
| ----------- | ------------------------------------------------- |
| `file://`   | Read local files from the server filesystem       |
| `gopher://` | Craft arbitrary TCP payloads to internal services |
| `ftp://`    | Access internal FTP servers                       |
| `data:`     | Embed and execute arbitrary data                  |
| `dict://`   | Probe internal DICT services                      |
| `ldap://`   | Query internal LDAP directories                   |

### 3. Block Private IP Ranges

Prevent requests to internal networks:

```typescript
import { isIP } from 'node:net';

const PRIVATE_RANGES = [
  /^127\./, // Loopback
  /^10\./, // Class A private
  /^172\.(1[6-9]|2\d|3[01])\./, // Class B private
  /^192\.168\./, // Class C private
  /^0\./, // Current network
  /^169\.254\./, // Link-local / cloud metadata
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // Carrier-grade NAT
  /^::1$/, // IPv6 loopback
  /^fc00:/, // IPv6 unique local
  /^fe80:/, // IPv6 link-local
  /^::ffff:127\./, // IPv4-mapped IPv6 loopback
  /^::ffff:10\./, // IPv4-mapped IPv6 private
  /^::ffff:192\.168\./, // IPv4-mapped IPv6 private
];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_RANGES.some((range) => range.test(ip));
}
```

### 4. DNS Resolution Validation

Resolve the hostname and check the resulting IP before making the request. This is critical because an attacker-controlled domain can resolve to a private IP:

```typescript
import { resolve4, resolve6 } from 'node:dns/promises';

async function resolveAndValidate(hostname: string): Promise<string[]> {
  const addresses: string[] = [];

  try {
    const ipv4 = await resolve4(hostname);
    addresses.push(...ipv4);
  } catch {
    // No A records
  }

  try {
    const ipv6 = await resolve6(hostname);
    addresses.push(...ipv6);
  } catch {
    // No AAAA records
  }

  if (addresses.length === 0) {
    throw new BadRequestException('Could not resolve hostname');
  }

  const privateAddresses = addresses.filter((addr) => isPrivateIp(addr));
  if (privateAddresses.length > 0) {
    throw new ForbiddenException('Request to internal network blocked');
  }

  return addresses;
}
```

### 5. DNS Rebinding Protection

DNS rebinding is an attack where the attacker's DNS server returns a public IP on the first lookup (passing validation) and a private IP on subsequent lookups (reaching the internal target). To prevent this:

1. **Resolve DNS once and pin the IP** -- pass the resolved IP directly to the HTTP client instead of letting it re-resolve.
2. **Set a short DNS TTL check** -- re-validate if the TTL has expired.
3. **Disable HTTP redirects** or re-validate the target after each redirect.

```typescript
import { Agent } from 'node:http';
import { lookup } from 'node:dns/promises';

async function fetchWithPinnedDns(url: string, options?: RequestInit): Promise<Response> {
  const parsed = new URL(url);
  const { address } = await lookup(parsed.hostname);

  if (isPrivateIp(address)) {
    throw new ForbiddenException('DNS resolved to private IP');
  }

  // Pin the resolved IP by replacing the hostname
  const pinnedUrl = new URL(url);
  pinnedUrl.hostname = address;

  return fetch(pinnedUrl.toString(), {
    ...options,
    headers: {
      ...Object.fromEntries(new Headers(options?.headers).entries()),
      Host: parsed.hostname, // Preserve original Host header
    },
    redirect: 'manual', // Do not follow redirects automatically
    signal: AbortSignal.timeout(10_000),
  });
}
```

## Complete SafeHttpClient Implementation

```typescript
import { Injectable, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { isIP } from 'node:net';
import { resolve4, resolve6 } from 'node:dns/promises';

interface SafeHttpClientOptions {
  allowedHosts?: Set<string>;
  allowedSchemes?: Set<string>;
  timeoutMs?: number;
  maxRedirects?: number;
}

@Injectable()
export class SafeHttpClient {
  private readonly logger = new Logger(SafeHttpClient.name);
  private readonly allowedHosts: Set<string> | null;
  private readonly allowedSchemes: Set<string>;
  private readonly timeoutMs: number;
  private readonly maxRedirects: number;

  constructor(options: SafeHttpClientOptions = {}) {
    this.allowedHosts = options.allowedHosts ?? null;
    this.allowedSchemes = options.allowedSchemes ?? new Set(['http:', 'https:']);
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.maxRedirects = options.maxRedirects ?? 0;
  }

  async fetch(url: string, options?: RequestInit): Promise<Response> {
    await this.validateUrl(url);

    const parsed = new URL(url);
    const resolvedIps = await this.resolveAndValidate(parsed.hostname);

    // Pin the first resolved IP to prevent DNS rebinding
    const pinnedUrl = new URL(url);
    pinnedUrl.hostname = resolvedIps[0];

    let response = await fetch(pinnedUrl.toString(), {
      ...options,
      headers: {
        ...Object.fromEntries(new Headers(options?.headers).entries()),
        Host: parsed.hostname,
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    // Handle redirects with re-validation
    let redirectCount = 0;
    while (this.isRedirect(response.status) && redirectCount < this.maxRedirects) {
      const location = response.headers.get('location');
      if (!location) break;

      const redirectUrl = new URL(location, url).toString();
      this.logger.warn(`Following redirect to ${redirectUrl}`);

      await this.validateUrl(redirectUrl);
      const redirectParsed = new URL(redirectUrl);
      const redirectIps = await this.resolveAndValidate(redirectParsed.hostname);

      const pinnedRedirect = new URL(redirectUrl);
      pinnedRedirect.hostname = redirectIps[0];

      response = await fetch(pinnedRedirect.toString(), {
        ...options,
        headers: {
          ...Object.fromEntries(new Headers(options?.headers).entries()),
          Host: redirectParsed.hostname,
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      redirectCount++;
    }

    return response;
  }

  private async validateUrl(url: string): Promise<void> {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Invalid URL');
    }

    if (!this.allowedSchemes.has(parsed.protocol)) {
      throw new ForbiddenException(`Blocked URL scheme: ${parsed.protocol}`);
    }

    if (this.allowedHosts && !this.allowedHosts.has(parsed.hostname)) {
      throw new ForbiddenException(`Host not in allowlist: ${parsed.hostname}`);
    }

    // Block credentials in URL
    if (parsed.username || parsed.password) {
      throw new ForbiddenException('URLs with embedded credentials are not allowed');
    }
  }

  private async resolveAndValidate(hostname: string): Promise<string[]> {
    if (isIP(hostname)) {
      if (isPrivateIp(hostname)) {
        throw new ForbiddenException('Request to private IP blocked');
      }
      return [hostname];
    }

    const addresses: string[] = [];

    try {
      addresses.push(...(await resolve4(hostname)));
    } catch {
      // No A records
    }

    try {
      addresses.push(...(await resolve6(hostname)));
    } catch {
      // No AAAA records
    }

    if (addresses.length === 0) {
      throw new BadRequestException(`Could not resolve hostname: ${hostname}`);
    }

    for (const addr of addresses) {
      if (isPrivateIp(addr)) {
        this.logger.warn(`Blocked request: ${hostname} resolved to private IP ${addr}`);
        throw new ForbiddenException('Request to internal network blocked');
      }
    }

    return addresses;
  }

  private isRedirect(status: number): boolean {
    return [301, 302, 303, 307, 308].includes(status);
  }
}

function isPrivateIp(ip: string): boolean {
  const PRIVATE_RANGES = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^0\./,
    /^169\.254\./,
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/,
    /^::ffff:127\./,
    /^::ffff:10\./,
    /^::ffff:192\.168\./,
  ];
  return PRIVATE_RANGES.some((range) => range.test(ip));
}
```

## Integration with NestJS HttpModule

Wrap the NestJS `HttpService` to apply SSRF validation:

```typescript
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SafeHttpService {
  constructor(
    private readonly httpService: HttpService,
    private readonly safeHttpClient: SafeHttpClient,
  ) {}

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    await this.safeHttpClient['validateUrl'](url);
    const parsed = new URL(url);
    const ips = await this.safeHttpClient['resolveAndValidate'](parsed.hostname);

    // Replace hostname with resolved IP to prevent DNS rebinding
    const pinnedUrl = new URL(url);
    pinnedUrl.hostname = ips[0];

    return firstValueFrom(
      this.httpService.get<T>(pinnedUrl.toString(), {
        ...config,
        headers: { ...config?.headers, Host: parsed.hostname },
        maxRedirects: 0,
        timeout: 10_000,
      }),
    );
  }

  async post<T>(
    url: string,
    data: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    await this.safeHttpClient['validateUrl'](url);
    const parsed = new URL(url);
    const ips = await this.safeHttpClient['resolveAndValidate'](parsed.hostname);

    const pinnedUrl = new URL(url);
    pinnedUrl.hostname = ips[0];

    return firstValueFrom(
      this.httpService.post<T>(pinnedUrl.toString(), data, {
        ...config,
        headers: { ...config?.headers, Host: parsed.hostname },
        maxRedirects: 0,
        timeout: 10_000,
      }),
    );
  }
}
```

## Testing SSRF Prevention

```typescript
import { SafeHttpClient } from './safe-http-client';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

describe('SafeHttpClient', () => {
  let client: SafeHttpClient;

  beforeEach(() => {
    client = new SafeHttpClient({
      allowedSchemes: new Set(['https:']),
    });
  });

  describe('URL scheme validation', () => {
    it('should block file:// URLs', async () => {
      await expect(client.fetch('file:///etc/passwd')).rejects.toThrow(ForbiddenException);
    });

    it('should block gopher:// URLs', async () => {
      await expect(client.fetch('gopher://internal:25/')).rejects.toThrow(ForbiddenException);
    });

    it('should block data: URLs', async () => {
      await expect(client.fetch('data:text/html,<script>alert(1)</script>')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('private IP blocking', () => {
    it('should block localhost', async () => {
      await expect(client.fetch('https://127.0.0.1/admin')).rejects.toThrow(ForbiddenException);
    });

    it('should block cloud metadata endpoint', async () => {
      await expect(client.fetch('https://169.254.169.254/latest/meta-data')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should block 10.x.x.x range', async () => {
      await expect(client.fetch('https://10.0.0.1/internal')).rejects.toThrow(ForbiddenException);
    });

    it('should block 192.168.x.x range', async () => {
      await expect(client.fetch('https://192.168.1.1/')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('URL validation', () => {
    it('should reject invalid URLs', async () => {
      await expect(client.fetch('not-a-url')).rejects.toThrow(BadRequestException);
    });

    it('should block URLs with embedded credentials', async () => {
      await expect(client.fetch('https://admin:password@example.com')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('allowlist', () => {
    it('should block hosts not in the allowlist', async () => {
      const restrictedClient = new SafeHttpClient({
        allowedHosts: new Set(['api.trusted.com']),
      });
      await expect(restrictedClient.fetch('https://evil.com/callback')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
```

## Checklist

- [ ] All outbound HTTP calls go through `SafeHttpClient` or `SafeHttpService`
- [ ] Private IP ranges are blocked by default (including IPv4-mapped IPv6)
- [ ] DNS resolution is validated before making requests (prevents DNS rebinding)
- [ ] Request timeouts are enforced
- [ ] URL schemes are restricted to `http:` and `https:`
- [ ] URLs with embedded credentials are rejected
- [ ] HTTP redirects are either disabled or re-validated at each hop
- [ ] Cloud metadata endpoints (`169.254.169.254`) are explicitly blocked
- [ ] SSRF prevention is covered by automated tests

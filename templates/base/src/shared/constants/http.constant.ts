/**
 * Standard HTTP and API constants.
 * Override via environment variables or ConfigService where noted.
 */

// ─── Rate Limiting ───────────────────────────────────────────────────────────

/** Default requests per window for global rate limiting */
export const RATE_LIMIT_DEFAULT = 100;

/** Default rate limit window in seconds */
export const RATE_LIMIT_WINDOW_SECONDS = 60;

/** Rate limit for authentication endpoints (stricter) */
export const RATE_LIMIT_AUTH = 10;

/** Rate limit window for auth endpoints in seconds */
export const RATE_LIMIT_AUTH_WINDOW_SECONDS = 300;

// ─── Caching ─────────────────────────────────────────────────────────────────

/** Default cache TTL in seconds */
export const CACHE_TTL_DEFAULT = 300;

/** Short-lived cache TTL (frequently changing data) */
export const CACHE_TTL_SHORT = 30;

/** Long-lived cache TTL (static/rarely changing data) */
export const CACHE_TTL_LONG = 3600;

/** Cache TTL for user sessions in seconds */
export const CACHE_TTL_SESSION = 1800;

// ─── Timeouts ────────────────────────────────────────────────────────────────

/** Default request timeout in milliseconds */
export const REQUEST_TIMEOUT_MS = 30_000;

/** Database query timeout in milliseconds */
export const DB_QUERY_TIMEOUT_MS = 10_000;

/** External HTTP call timeout in milliseconds */
export const HTTP_CLIENT_TIMEOUT_MS = 15_000;

/** Lambda/serverless function timeout in milliseconds */
export const LAMBDA_TIMEOUT_MS = 29_000;

// ─── Pagination ──────────────────────────────────────────────────────────────

/** Default page size for paginated endpoints */
export const PAGE_SIZE_DEFAULT = 20;

/** Maximum allowed page size */
export const PAGE_SIZE_MAX = 100;

/** Minimum allowed page size */
export const PAGE_SIZE_MIN = 1;

// ─── Request Limits ──────────────────────────────────────────────────────────

/** Maximum request body size in bytes (10 MB) */
export const MAX_BODY_SIZE_BYTES = 10 * 1024 * 1024;

/** Maximum file upload size in bytes (50 MB) */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

/** Maximum number of files per upload */
export const MAX_FILES_PER_UPLOAD = 10;

// ─── Security ────────────────────────────────────────────────────────────────

/** JWT access token expiration */
export const JWT_ACCESS_TOKEN_EXPIRY = '15m';

/** JWT refresh token expiration */
export const JWT_REFRESH_TOKEN_EXPIRY = '7d';

/** Password hash rounds (bcrypt) */
export const PASSWORD_HASH_ROUNDS = 12;

/** Maximum failed login attempts before lockout */
export const MAX_LOGIN_ATTEMPTS = 5;

/** Account lockout duration in minutes */
export const ACCOUNT_LOCKOUT_MINUTES = 15;

// ─── Retry & Circuit Breaker ─────────────────────────────────────────────────

/** Default retry attempts for external calls */
export const RETRY_MAX_ATTEMPTS = 3;

/** Initial retry delay in milliseconds */
export const RETRY_INITIAL_DELAY_MS = 200;

/** Retry backoff multiplier */
export const RETRY_BACKOFF_MULTIPLIER = 2;

/** Circuit breaker failure threshold (percentage) */
export const CIRCUIT_BREAKER_THRESHOLD = 50;

/** Circuit breaker reset timeout in milliseconds */
export const CIRCUIT_BREAKER_RESET_MS = 30_000;

// ─── Health Checks ───────────────────────────────────────────────────────────

/** Memory heap threshold for health check (200 MB) */
export const HEALTH_MEMORY_HEAP_THRESHOLD = 200 * 1024 * 1024;

/** Memory RSS threshold for health check (300 MB) */
export const HEALTH_MEMORY_RSS_THRESHOLD = 300 * 1024 * 1024;

/** Disk storage threshold for health check (90%) */
export const HEALTH_DISK_THRESHOLD_PERCENT = 0.9;

// ─── Connection Pools ────────────────────────────────────────────────────────

/** Default database connection pool size */
export const DB_POOL_MAX = 20;

/** Minimum database pool connections */
export const DB_POOL_MIN = 5;

/** Idle connection timeout in milliseconds */
export const DB_POOL_IDLE_TIMEOUT_MS = 30_000;

/** Connection acquisition timeout in milliseconds */
export const DB_POOL_ACQUIRE_TIMEOUT_MS = 5_000;

// ─── HTTP Headers ────────────────────────────────────────────────────────────

export const HEADER_CORRELATION_ID = 'x-correlation-id';
export const HEADER_REQUEST_ID = 'x-request-id';
export const HEADER_IDEMPOTENCY_KEY = 'idempotency-key';
export const HEADER_API_VERSION = 'x-api-version';

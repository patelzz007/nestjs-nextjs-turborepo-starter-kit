// ============================================
// github.constants.ts - Fixed facts of the GitHub integration
// ============================================
// Operator-tunable values (token, repositories, timeout, cache lifetime) are
// env config (`TypedConfigService.github`); these are the values that only
// change together with the code that relies on them.

/** GitHub's REST API root. */
export const GITHUB_REST_API_URL = "https://api.github.com";

/** GitHub's GraphQL endpoint — one request answers a summary or a commit page with line counts. */
export const GITHUB_GRAPHQL_API_URL = `${GITHUB_REST_API_URL}/graphql`;

/** The REST API version this client is written against (`X-GitHub-Api-Version`). */
export const GITHUB_REST_API_VERSION = "2022-11-28";

/** GitHub's JSON media type (`Accept`). */
export const GITHUB_JSON_MEDIA_TYPE = "application/vnd.github+json";

const MS_PER_HOUR = 60 * 60 * 1_000;

/**
 * How long after its cache lifetime an answer may still be served when GitHub
 * is unreachable, slow or rate-limited — a stale profile beats an error.
 */
export const GITHUB_STALE_FALLBACK_MS = MS_PER_HOUR;

/**
 * Most cached answers per kind (summary, commit page, contributors) per API
 * instance. Commit pages are keyed by cursor, so this bounds memory however
 * far back clients page; the oldest answer is evicted first.
 */
export const GITHUB_CACHE_MAX_ENTRIES = 500;

/** The `Retry-After` / `X-RateLimit-Remaining` headers GitHub sets when a rate limit is used up. */
export const GITHUB_RETRY_AFTER_HEADER = "retry-after";
export const GITHUB_RATE_LIMIT_REMAINING_HEADER = "x-ratelimit-remaining";

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

/** Asks GitHub's contents API for a file's own bytes instead of its JSON description. */
export const GITHUB_RAW_MEDIA_TYPE = "application/vnd.github.raw+json";

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

/**
 * Most cached commit answers per API instance. A commit carries its diff (up
 * to `GITHUB_COMMIT_DIFF_MAX_LENGTH` characters), so far fewer are kept than
 * of the small answers.
 */
export const GITHUB_COMMIT_CACHE_MAX_ENTRIES = 50;

/** GitHub's largest GraphQL history page — contribution history is read in pages this size. */
export const GITHUB_HISTORY_PAGE_MAX = 100;

/** GitHub's `Link` header: a commit with more files than one page names the next page `rel="next"`. */
export const GITHUB_LINK_HEADER = "link";

/** The `Retry-After` / `X-RateLimit-Remaining` headers GitHub sets when a rate limit is used up. */
export const GITHUB_RETRY_AFTER_HEADER = "retry-after";
export const GITHUB_RATE_LIMIT_REMAINING_HEADER = "x-ratelimit-remaining";

import { ApiError } from "@workspace/client/lib/api/use-api";
import { resolveAuthErrorMessage } from "@workspace/client/lib/auth/errors";

// ============================================
// lib/query/query-policy.ts - named freshness and retry rules for merchant queries
// ============================================
// The QueryClient defaults (packages/client query-provider) apply unless a
// query's freshness genuinely differs; every override names its reason here
// instead of repeating an unexplained number at the call site.

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

/** Memberships change only when an owner edits the team — one minute is fresh enough, and stops refetch storms across the shell's observers. */
export const MEMBERSHIPS_STALE_TIME_MS = SECONDS_PER_MINUTE * MS_PER_SECOND;

/** The rewards catalog is edited in this portal (mutations update the cache), so it stays fresh for half a minute between navigations. */
export const REWARDS_STALE_TIME_MS = 30 * MS_PER_SECOND;

/** A team-invite preview does not change while the page is open; it is read once per token. */
export const TEAM_INVITE_PREVIEW_STALE_TIME_MS = Number.POSITIVE_INFINITY;

/** Transient failures (network, 5xx) get one more attempt. */
export const MAX_TRANSIENT_RETRIES = 1;

const HTTP_SERVER_ERROR_MIN = 500;

/**
 * Whether a failed query is worth another attempt: only a transient failure —
 * the API was unreachable or answered 5xx. A 4xx is the API's answer (401 is
 * refreshed by the transport, 403/404 are final, 429 means "slow down"), so
 * repeating it only adds load — retrying a 429 is exactly what feeds a rate limit.
 */
export function isTransientQueryFailure(error: Error): boolean {
	if (!(error instanceof ApiError)) {
		return true;
	}
	return error.statusCode === undefined || error.statusCode >= HTTP_SERVER_ERROR_MIN;
}

/** TanStack Query `retry` predicate: transient failures only, at most {@link MAX_TRANSIENT_RETRIES} times. */
export function retryTransientFailures(failureCount: number, error: Error): boolean {
	return failureCount < MAX_TRANSIENT_RETRIES && isTransientQueryFailure(error);
}

/**
 * A message safe to show for a failed request: the API's own answer for a
 * client error (4xx — written for users, mapped through the shared catalog),
 * otherwise `fallback`. Transport failures and 5xx never show their raw text
 * (it can carry URLs, hostnames or stack details).
 */
export function userSafeErrorMessage(error: Error, fallback: string): string {
	if (error instanceof ApiError && error.statusCode !== undefined && error.statusCode < HTTP_SERVER_ERROR_MIN) {
		return resolveAuthErrorMessage(error);
	}
	return fallback;
}

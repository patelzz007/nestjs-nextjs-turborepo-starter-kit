import { getApiConfig } from "../../../../../config/api-config";

/**
 * Named rate-limit policies (migration plan §10).
 *
 * Decorators take one of these. They do not carry raw `{ ttl, limit }` literals.
 * Windows come from `rateLimits.throttleTtlMs`. Credential and session limits stay
 * at today's tighter numbers (`CREDENTIAL_LOW_LIMIT`, `LOGIN_ATTEMPT_LIMIT`,
 * `SESSION_ISSUE_LIMIT`) because those routes were already stricter than
 * `throttleStrictLimit`. Authenticated mutations use `throttleDefaultLimit`.
 */

/** Signup, forgot-password, resend-verification, verify-email. */
export const CREDENTIAL_LOW_LIMIT = 3;

/** Login, reset-password, and the two-factor challenge posts. */
export const LOGIN_ATTEMPT_LIMIT = 5;

/** Refresh-adjacent and step-up posts that were limited to 10 per window. */
export const SESSION_ISSUE_LIMIT = 10;

/** Terminal pairing attempts per window. */
export const TERMINAL_PAIRING_LIMIT = 5;

/** Merchant onboarding status posts per window. */
export const ONBOARDING_STATUS_LIMIT = 30;

/** Milliseconds in one minute. */
const MS_PER_MINUTE = 60_000;

/**
 * The webhook window. `WEBHOOK_RATE_LIMIT_PER_MINUTE` (`email.webhookRateLimitPerMinute`)
 * is a per-minute limit, so the window is one minute whatever `THROTTLE_TTL_MS` says.
 */
export const WEBHOOK_WINDOW_MS = MS_PER_MINUTE;

/** Admin security mutations (roles, permissions, impersonation) per principal per minute. */
export const ADMIN_SECURITY_MUTATION_LIMIT = 10;

/** `POST /auth/refresh` per client IP per minute (no access token yet, so no principal). */
export const SESSION_REFRESH_LIMIT = 10;

/** The window of the per-minute security policies above. */
export const SECURITY_POLICY_WINDOW_MS = MS_PER_MINUTE;

/**
 * The coarse pre-authentication throttler: requests per client IP per
 * `throttleTtlMs`, counted BEFORE `AuthGuard`, so a flood of bad credentials on
 * a protected route is limited too. A multiple of `throttleDefaultLimit`, so one
 * busy user (whose own mutations are limited at the default) never trips it.
 */
export const PRE_AUTH_LIMIT_MULTIPLIER = 5;

/** Name of the pre-authentication throttler. Only `PreAuthThrottlerGuard` evaluates it. */
export const PRE_AUTH_THROTTLER = "preAuth";

export type RateLimitTracker = "ip" | "principal";

export type RateLimitThrottlerName = "strict" | "default" | "webhook";

/** Throttlers that count every route unless the route skips them. */
export const ALWAYS_ON_THROTTLERS: ["strict", "default"] = ["strict", "default"];

export interface RateLimitPolicy {
	readonly name: string;
	readonly throttler: RateLimitThrottlerName;
	readonly tracker: RateLimitTracker;
	readonly limit: number;
	readonly ttlMs: number;
}

function windowMs(): number {
	return getApiConfig().rateLimits.throttleTtlMs;
}

function policy(name: string, throttler: RateLimitThrottlerName, tracker: RateLimitTracker, limit: number, ttlMs: number = windowMs()): RateLimitPolicy {
	return { name, throttler, tracker, limit, ttlMs };
}

export const RATE_LIMIT_POLICY: {
	readonly credential: RateLimitPolicy;
	readonly login: RateLimitPolicy;
	readonly sessionIssue: RateLimitPolicy;
	readonly authenticatedMutation: RateLimitPolicy;
	readonly terminalPairing: RateLimitPolicy;
	readonly onboardingStatus: RateLimitPolicy;
	readonly webhook: RateLimitPolicy;
	readonly adminSecurityMutation: RateLimitPolicy;
	readonly sessionRefresh: RateLimitPolicy;
} = {
	get credential(): RateLimitPolicy {
		return policy("CREDENTIAL", "strict", "ip", CREDENTIAL_LOW_LIMIT);
	},
	get login(): RateLimitPolicy {
		return policy("LOGIN", "strict", "ip", LOGIN_ATTEMPT_LIMIT);
	},
	get sessionIssue(): RateLimitPolicy {
		return policy("SESSION_ISSUE", "strict", "ip", SESSION_ISSUE_LIMIT);
	},
	get authenticatedMutation(): RateLimitPolicy {
		return policy("AUTHENTICATED_MUTATION", "default", "principal", getApiConfig().rateLimits.throttleDefaultLimit);
	},
	get terminalPairing(): RateLimitPolicy {
		return policy("TERMINAL_PAIRING", "strict", "ip", TERMINAL_PAIRING_LIMIT);
	},
	get onboardingStatus(): RateLimitPolicy {
		return policy("ONBOARDING_STATUS", "strict", "ip", ONBOARDING_STATUS_LIMIT);
	},
	get webhook(): RateLimitPolicy {
		// `WEBHOOK_RATE_LIMIT_PER_MINUTE=0` turns the webhook throttler off (see throttler-options.factory.ts).
		return policy("WEBHOOK", "webhook", "ip", getApiConfig().email.webhookRateLimitPerMinute, WEBHOOK_WINDOW_MS);
	},
	get adminSecurityMutation(): RateLimitPolicy {
		return policy("ADMIN_SECURITY_MUTATION", "default", "principal", ADMIN_SECURITY_MUTATION_LIMIT, SECURITY_POLICY_WINDOW_MS);
	},
	get sessionRefresh(): RateLimitPolicy {
		return policy("SESSION_REFRESH", "strict", "ip", SESSION_REFRESH_LIMIT, SECURITY_POLICY_WINDOW_MS);
	},
};

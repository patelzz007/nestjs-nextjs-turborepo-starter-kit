import { describe, expect, it } from "vitest";

import {
	CREDENTIAL_LOW_LIMIT,
	LOGIN_ATTEMPT_LIMIT,
	ONBOARDING_STATUS_LIMIT,
	RATE_LIMIT_POLICY,
	SESSION_ISSUE_LIMIT,
	TERMINAL_PAIRING_LIMIT,
	WEBHOOK_WINDOW_MS,
	ADMIN_SECURITY_MUTATION_LIMIT,
	SESSION_REFRESH_LIMIT,
	SECURITY_POLICY_WINDOW_MS,
	PRE_AUTH_LIMIT_MULTIPLIER,
} from "../rate-limit-policy";
import { getApiConfig } from "../../../../../../config/api-config";

describe("rate limit policies", () => {
	const policies = [
		RATE_LIMIT_POLICY.credential,
		RATE_LIMIT_POLICY.login,
		RATE_LIMIT_POLICY.sessionIssue,
		RATE_LIMIT_POLICY.authenticatedMutation,
		RATE_LIMIT_POLICY.terminalPairing,
		RATE_LIMIT_POLICY.onboardingStatus,
		RATE_LIMIT_POLICY.webhook,
		RATE_LIMIT_POLICY.adminSecurityMutation,
		RATE_LIMIT_POLICY.sessionRefresh,
	];

	it("uses a positive integer limit and window on every policy", () => {
		for (const policy of policies) {
			expect(Number.isInteger(policy.limit)).toBe(true);
			expect(policy.limit).toBeGreaterThan(0);
			expect(Number.isInteger(policy.ttlMs)).toBe(true);
			expect(policy.ttlMs).toBeGreaterThan(0);
		}
	});

	it("keeps the credential and pairing numbers that were already tighter than the config", () => {
		expect(RATE_LIMIT_POLICY.credential.limit).toBe(CREDENTIAL_LOW_LIMIT);
		expect(CREDENTIAL_LOW_LIMIT).toBe(3);
		expect(RATE_LIMIT_POLICY.login.limit).toBe(LOGIN_ATTEMPT_LIMIT);
		expect(LOGIN_ATTEMPT_LIMIT).toBe(5);
		expect(RATE_LIMIT_POLICY.sessionIssue.limit).toBe(SESSION_ISSUE_LIMIT);
		expect(SESSION_ISSUE_LIMIT).toBe(10);
		expect(RATE_LIMIT_POLICY.terminalPairing.limit).toBe(TERMINAL_PAIRING_LIMIT);
		expect(RATE_LIMIT_POLICY.onboardingStatus.limit).toBe(ONBOARDING_STATUS_LIMIT);
		expect(RATE_LIMIT_POLICY.credential.tracker).toBe("ip");
		expect(RATE_LIMIT_POLICY.authenticatedMutation.tracker).toBe("principal");
	});

	it("takes the webhook limit from WEBHOOK_RATE_LIMIT_PER_MINUTE, per client IP per minute, on the opt-in webhook throttler", () => {
		expect(RATE_LIMIT_POLICY.webhook.limit).toBe(getApiConfig().email.webhookRateLimitPerMinute);
		expect(RATE_LIMIT_POLICY.webhook.ttlMs).toBe(WEBHOOK_WINDOW_MS);
		expect(WEBHOOK_WINDOW_MS).toBe(60_000);
		expect(RATE_LIMIT_POLICY.webhook.throttler).toBe("webhook");
		expect(RATE_LIMIT_POLICY.webhook.tracker).toBe("ip");
	});

	it("limits admin security mutations per principal and session refresh per IP, 10 per minute each", () => {
		expect(RATE_LIMIT_POLICY.adminSecurityMutation).toMatchObject({
			throttler: "default",
			tracker: "principal",
			limit: ADMIN_SECURITY_MUTATION_LIMIT,
			ttlMs: SECURITY_POLICY_WINDOW_MS,
		});
		expect(RATE_LIMIT_POLICY.sessionRefresh).toMatchObject({ throttler: "strict", tracker: "ip", limit: SESSION_REFRESH_LIMIT, ttlMs: SECURITY_POLICY_WINDOW_MS });
		expect(ADMIN_SECURITY_MUTATION_LIMIT).toBe(10);
		expect(SESSION_REFRESH_LIMIT).toBe(10);
		expect(SECURITY_POLICY_WINDOW_MS).toBe(60_000);
	});

	it("sets the pre-authentication limit at a positive multiple of the default limit", () => {
		expect(Number.isInteger(PRE_AUTH_LIMIT_MULTIPLIER)).toBe(true);
		expect(PRE_AUTH_LIMIT_MULTIPLIER).toBe(5);
	});
});

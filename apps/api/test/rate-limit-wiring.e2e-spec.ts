import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX, apiPath } from "@workspace/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ThrottlerStorage } from "@nestjs/throttler";

import { getApiConfig } from "../src/config/api-config";
import { RedisThrottlerStorage } from "../src/platform/infrastructure/throttling/redis-throttler.storage";
import { LOGIN_ATTEMPT_LIMIT, PRE_AUTH_LIMIT_MULTIPLIER } from "../src/platform/presentation/http/security/throttling/rate-limit-policy";
import { createE2eApp, mutationHeaders, uniqueClientIp, type InjectResponse } from "./e2e-helpers";

/**
 * Proves the global `ThrottlerGuard` runs on the ONE throttler registration
 * (`strict`, `default`, `webhook`) and honours each route's named policy.
 *
 * Regression for review finding 1: a second global `ThrottlerModule`
 * (the notifications webhook one) used to win `THROTTLER_OPTIONS` resolution
 * for the app-level guard, so the strict credential limits never applied.
 */

const LOGIN_URL = `${API_VERSION_PREFIX}/auth/login`;
const EMAIL_WEBHOOK_URL = "/notifications/email-webhook";
const GITHUB_WEBHOOK_URL = apiPath("/github/webhook");
/** A protected route: every request below carries a bad bearer token, so `AuthGuard` rejects it. */
const PROTECTED_URL = `${API_VERSION_PREFIX}/auth/me`;
const UNAUTHORIZED = 401;
/** The flood sends `5 × THROTTLE_DEFAULT_LIMIT` requests: more time than the default 30 s test timeout. */
const PRE_AUTH_FLOOD_TIMEOUT_MS = 120_000;
const TOO_MANY_REQUESTS = 429;

/** The rate-limit header the guard sets for one named throttler (`default` has no suffix). */
function limitHeader(throttlerName: "strict" | "webhook"): string {
	return `x-ratelimit-limit-${throttlerName}`;
}

describe("Rate-limit wiring (e2e)", () => {
	let app: NestFastifyApplication;

	beforeAll(async () => {
		app = await createE2eApp();
	});

	afterAll(async () => {
		await app.close();
	});

	async function badLogin(clientIp: string): Promise<InjectResponse> {
		return app.inject({
			method: "POST",
			url: LOGIN_URL,
			headers: mutationHeaders({ "x-forwarded-for": clientIp }),
			// A fresh unknown address every time, so no per-account lockout can answer first.
			payload: { email: `rate-limit-${randomUUID()}@example.com`, password: "not-the-password-1A!" },
		});
	}

	async function unsignedEmailWebhook(clientIp: string): Promise<InjectResponse> {
		// A JSON body, as the provider sends it (a body without a content type is refused by Fastify before any guard).
		return app.inject({ method: "POST", url: EMAIL_WEBHOOK_URL, headers: { "x-forwarded-for": clientIp, "content-type": "application/json" }, payload: "{}" });
	}

	it("counts every throttler in the one Redis-backed storage", () => {
		expect(app.get(ThrottlerStorage, { strict: false })).toBeInstanceOf(RedisThrottlerStorage);
	});

	it("answers 429 on the strict LOGIN policy at limit + 1, keyed by client IP", async () => {
		const clientIp: string = uniqueClientIp();
		for (let attempt = 1; attempt <= LOGIN_ATTEMPT_LIMIT; attempt += 1) {
			const response: InjectResponse = await badLogin(clientIp);
			expect(response.statusCode).not.toBe(TOO_MANY_REQUESTS);
			expect(response.headers[limitHeader("strict")]).toBe(String(LOGIN_ATTEMPT_LIMIT));
		}
		const throttled: InjectResponse = await badLogin(clientIp);
		expect(throttled.statusCode).toBe(TOO_MANY_REQUESTS);

		// Another client address has its own strict bucket.
		const otherClient: InjectResponse = await badLogin(uniqueClientIp());
		expect(otherClient.statusCode).not.toBe(TOO_MANY_REQUESTS);
	});

	it("keeps the email webhook on its own webhook limit, not the strict credential limit", async () => {
		const webhookLimit: number = getApiConfig().email.webhookRateLimitPerMinute;
		expect(webhookLimit).toBeGreaterThan(getApiConfig().rateLimits.throttleStrictLimit);
		const clientIp: string = uniqueClientIp();
		const statuses: number[] = [];
		for (let attempt = 1; attempt <= webhookLimit; attempt += 1) {
			const response: InjectResponse = await unsignedEmailWebhook(clientIp);
			statuses.push(response.statusCode);
			expect(response.headers[limitHeader("webhook")]).toBe(String(webhookLimit));
			expect(response.headers[limitHeader("strict")]).toBeUndefined();
		}
		expect(statuses).not.toContain(TOO_MANY_REQUESTS);
		const throttled: InjectResponse = await unsignedEmailWebhook(clientIp);
		expect(throttled.statusCode).toBe(TOO_MANY_REQUESTS);
	});

	it("applies the same webhook throttler to the GitHub webhook route", async () => {
		const response: InjectResponse = await app.inject({
			method: "POST",
			url: GITHUB_WEBHOOK_URL,
			headers: { "x-forwarded-for": uniqueClientIp(), "content-type": "application/json" },
			payload: "{}",
		});
		expect(response.statusCode).not.toBe(TOO_MANY_REQUESTS);
		expect(response.headers[limitHeader("webhook")]).toBe(String(getApiConfig().email.webhookRateLimitPerMinute));
		expect(response.headers[limitHeader("strict")]).toBeUndefined();
	});

	it(
		"throttles an unauthenticated flood of bad bearer tokens per IP before AuthGuard rejects it",
		async () => {
			const preAuthLimit: number = getApiConfig().rateLimits.throttleDefaultLimit * PRE_AUTH_LIMIT_MULTIPLIER;
			const clientIp: string = uniqueClientIp();
			const statuses: number[] = [];
			for (let attempt = 1; attempt <= preAuthLimit; attempt += 1) {
				const response: InjectResponse = await app.inject({
					method: "GET",
					url: PROTECTED_URL,
					headers: { "x-forwarded-for": clientIp, authorization: `Bearer not-a-token-${String(attempt)}` },
				});
				statuses.push(response.statusCode);
			}
			expect(new Set(statuses)).toEqual(new Set([UNAUTHORIZED]));
			const throttled: InjectResponse = await app.inject({ method: "GET", url: PROTECTED_URL, headers: { "x-forwarded-for": clientIp, authorization: "Bearer not-a-token" } });
			expect(throttled.statusCode).toBe(TOO_MANY_REQUESTS);
		},
		PRE_AUTH_FLOOD_TIMEOUT_MS,
	);
});

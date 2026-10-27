import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { getApiConfig } from "../src/config/api-config";
import {
	ADMIN_SECURITY_MUTATION_LIMIT,
	CREDENTIAL_LOW_LIMIT,
	ONBOARDING_STATUS_LIMIT,
	SESSION_ISSUE_LIMIT,
	SESSION_REFRESH_LIMIT,
	TERMINAL_PAIRING_LIMIT,
} from "../src/platform/presentation/http/security/throttling/rate-limit-policy";
import { createE2eApp, extractCookie, mutationHeaders, uniqueClientIp, type InjectResponse } from "./e2e-helpers";

/**
 * The limits this file's app runs with. The floods below send the `default` limit's worth of requests
 * (five times as many for the pre-auth limit) one after another, each a full request with its audit
 * row: at the configured value (300, or a developer's own `.env`) they took over half a minute. What is
 * proven, a 429 exactly at limit + 1, does not depend on the number. The `default` throttler also counts
 * every request to a route with a policy of its own, so it must stay above every such policy's limit
 * (the largest is ONBOARDING_STATUS_LIMIT, 30), or it would answer the 429 first: the first test checks
 * that. Set before the app's config is parsed (`vi.hoisted` runs ahead of the imports; every e2e file
 * has its own module graph), and restored after the file so later files see the usual environment.
 */
vi.hoisted((): void => {
	// Inside the hoisted callback: it runs before any module-level constant is initialised.
	const throttleDefaultLimitForFloods = "40";
	vi.stubEnv("THROTTLE_DEFAULT_LIMIT", throttleDefaultLimitForFloods);
});
afterAll((): void => {
	vi.unstubAllEnvs();
});

/**
 * One limit + 1 → 429 proof per named rate-limit policy (LOGIN, WEBHOOK and the pre-auth flood are in
 * rate-limit-wiring.e2e-spec.ts). Every request is invalid on purpose — a bad body, token or code — so
 * nothing changes state: the throttler runs before validation and authorization, so a rejected request
 * still counts. IP-keyed policies use a fresh client address per case; principal-keyed ones a fresh
 * account, so no seeded user's bucket is touched.
 */

const TOO_MANY_REQUESTS = 429;
const HTTP_CREATED = 201;
const PASSWORD = "Rate-limit-e2e-1A!";
/** The limit header of the `strict` throttler; the `default` throttler's header has no suffix. */
const STRICT_LIMIT_HEADER = "x-ratelimit-limit-strict";
const DEFAULT_LIMIT_HEADER = "x-ratelimit-limit";

interface PolicyCase {
	readonly name: string;
	readonly limit: number;
	readonly limitHeader: string;
	/** One throttled request from `clientIp` (and the principal's bearer token, when the policy is principal-keyed). */
	readonly send: (clientIp: string) => Promise<InjectResponse>;
	/** A principal-keyed policy: every request comes from a new address, so only the principal's bucket can fill. */
	readonly principalKeyed?: boolean;
}

describe("Rate-limit policies (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	const accounts: string[] = [];

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: process.env.DATABASE_URL });
	});

	afterAll(async () => {
		// Soft delete, as everywhere: the accounts stay as rows, out of every list.
		await pool.query(`UPDATE public."User" SET "isDeleted" = true, "deletedAt" = $1 WHERE email = ANY($2)`, [Date.now(), accounts]);
		await pool.end();
		await app.close();
	});

	function post(url: string, clientIp: string, payload: object, extra: Record<string, string> = {}): Promise<InjectResponse> {
		return app.inject({ method: "POST", url, headers: mutationHeaders({ "x-forwarded-for": clientIp, ...extra }), payload });
	}

	/** A fresh verified account, signed in on the admin client; returns its access token. */
	async function freshAccessToken(): Promise<string> {
		const email = `rate-limit-${randomUUID()}@example.com`;
		accounts.push(email);
		const signup = await post(`${API_VERSION_PREFIX}/auth/signup`, uniqueClientIp(), { email, password: PASSWORD, fullName: "Rate Limit E2E" });
		expect(signup.statusCode, signup.body).toBe(HTTP_CREATED);
		await pool.query(`UPDATE public."User" SET "emailVerifiedAt" = $1 WHERE email = $2`, [Date.now(), email]);
		const signIn = await post(`${API_VERSION_PREFIX}/auth/login`, uniqueClientIp(), { email, password: PASSWORD });
		expect(signIn.statusCode, signIn.body).toBe(HTTP_CREATED);
		const accessToken = extractCookie(signIn.headers["set-cookie"], "accessToken");
		if (accessToken === undefined) {
			throw new Error(`Sign-in set no access token: ${signIn.body}`);
		}
		return accessToken;
	}

	async function expectThrottledAfterLimit(policy: PolicyCase): Promise<void> {
		const clientIp = uniqueClientIp();
		const addressFor = (): string => (policy.principalKeyed === true ? uniqueClientIp() : clientIp);
		for (let attempt = 1; attempt <= policy.limit; attempt += 1) {
			const response = await policy.send(addressFor());
			expect(response.statusCode, `${policy.name} attempt ${String(attempt)}: ${response.body}`).not.toBe(TOO_MANY_REQUESTS);
			expect(response.headers[policy.limitHeader]).toBe(String(policy.limit));
		}
		const throttled = await policy.send(addressFor());
		expect(throttled.statusCode, policy.name).toBe(TOO_MANY_REQUESTS);
	}

	it("runs with a default limit above every policy limit tested here, so each 429 below is the policy's own", () => {
		const policyLimits: readonly number[] = [
			CREDENTIAL_LOW_LIMIT,
			SESSION_ISSUE_LIMIT,
			SESSION_REFRESH_LIMIT,
			TERMINAL_PAIRING_LIMIT,
			ONBOARDING_STATUS_LIMIT,
			ADMIN_SECURITY_MUTATION_LIMIT,
		];
		expect(getApiConfig().rateLimits.throttleDefaultLimit).toBeGreaterThan(Math.max(...policyLimits));
	});

	const ipKeyedPolicies: readonly PolicyCase[] = [
		{
			name: "CREDENTIAL — forgot password",
			limit: CREDENTIAL_LOW_LIMIT,
			limitHeader: STRICT_LIMIT_HEADER,
			send: (ip) => post(`${API_VERSION_PREFIX}/auth/forgot-password`, ip, { email: `nobody-${randomUUID()}@example.com` }),
		},
		{
			name: "CREDENTIAL — verify email",
			limit: CREDENTIAL_LOW_LIMIT,
			limitHeader: STRICT_LIMIT_HEADER,
			send: (ip) => post(`${API_VERSION_PREFIX}/auth/verify-email`, ip, { token: randomUUID() }),
		},
		{
			name: "SESSION_ISSUE — validate reset token",
			limit: SESSION_ISSUE_LIMIT,
			limitHeader: STRICT_LIMIT_HEADER,
			send: (ip) => post(`${API_VERSION_PREFIX}/auth/validate-reset-token`, ip, { token: randomUUID() }),
		},
		{
			name: "SESSION_REFRESH — refresh without a token",
			limit: SESSION_REFRESH_LIMIT,
			limitHeader: STRICT_LIMIT_HEADER,
			send: (ip) => post(`${API_VERSION_PREFIX}/auth/refresh`, ip, {}),
		},
		{
			name: "TERMINAL_PAIRING — unknown pairing code",
			limit: TERMINAL_PAIRING_LIMIT,
			limitHeader: STRICT_LIMIT_HEADER,
			send: (ip) => post(`${API_VERSION_PREFIX}/integration/terminals/pair`, ip, {}),
		},
		{
			name: "ONBOARDING_STATUS — unknown invite token",
			limit: ONBOARDING_STATUS_LIMIT,
			limitHeader: STRICT_LIMIT_HEADER,
			send: (ip) => post(`${API_VERSION_PREFIX}/tenants/onboarding/documents/status`, ip, {}),
		},
	];

	for (const policy of ipKeyedPolicies) {
		it(`answers 429 on ${policy.name} at limit + 1, per client IP`, async () => {
			await expectThrottledAfterLimit(policy);
		});
	}

	it("answers 429 on CREDENTIAL — change password at limit + 1", async () => {
		const accessToken = await freshAccessToken();
		await expectThrottledAfterLimit({
			name: "CREDENTIAL — change password",
			limit: CREDENTIAL_LOW_LIMIT,
			limitHeader: STRICT_LIMIT_HEADER,
			send: (ip) => post(`${API_VERSION_PREFIX}/auth/change-password`, ip, {}, { authorization: `Bearer ${accessToken}` }),
		});
	});

	it("answers 429 on ADMIN_SECURITY_MUTATION at limit + 1, per principal", async () => {
		const accessToken = await freshAccessToken();
		await expectThrottledAfterLimit({
			name: "ADMIN_SECURITY_MUTATION — create role",
			principalKeyed: true,
			limit: ADMIN_SECURITY_MUTATION_LIMIT,
			limitHeader: DEFAULT_LIMIT_HEADER,
			send: (ip) => post(`${API_VERSION_PREFIX}/admin/roles`, ip, {}, { authorization: `Bearer ${accessToken}` }),
		});
	});

	it("answers 429 on AUTHENTICATED_MUTATION at limit + 1, per principal", async () => {
		const accessToken = await freshAccessToken();
		await expectThrottledAfterLimit({
			name: "AUTHENTICATED_MUTATION — role assignment preview",
			principalKeyed: true,
			limit: getApiConfig().rateLimits.throttleDefaultLimit,
			limitHeader: DEFAULT_LIMIT_HEADER,
			send: (ip) => post(`${API_VERSION_PREFIX}/admin/roles/preview`, ip, {}, { authorization: `Bearer ${accessToken}` }),
		});
	});
});

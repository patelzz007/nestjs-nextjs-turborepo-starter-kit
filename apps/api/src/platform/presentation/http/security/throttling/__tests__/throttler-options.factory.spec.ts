import { Controller, ForbiddenException, Get, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { APP_GUARD, HttpAdapterHost } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test, type TestingModule } from "@nestjs/testing";
import { SkipThrottle, ThrottlerModule } from "@nestjs/throttler";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createAuditTrailDouble } from "../../../../../../../test/support/audit-trail-double";
import { RecordingRateLimiter } from "../../../../../../../test/support/recording-rate-limiter";
import { createTestTypedConfig } from "../../../../../../../test/support/test-api-env";
import { RequestContextService } from "../../../../../infrastructure/context/request-context";
import { LogService } from "../../../../../infrastructure/logging/logs.service";
import { RateLimitExemptions } from "../../../../../infrastructure/rate-limiting/rate-limit-exemptions";
import { RateLimitRefusalLog } from "../../../../../infrastructure/rate-limiting/rate-limit-refusal-log";
import { SECURITY_STRIKE_THRESHOLD, SECURITY_PENALTY_STEPS_MS } from "../../../../../infrastructure/rate-limiting/security-penalty";
import { LoadTestTrafficKeys } from "../../../../../infrastructure/throttling/load-test-traffic-keys";
import { RateLimiterThrottlerStorage } from "../../../../../infrastructure/throttling/rate-limiter-throttler.storage";
import { GlobalExceptionFilter } from "../../../errors/global-exception.filter";
import { PRE_AUTH_LIMIT_MULTIPLIER, RATE_LIMIT_POLICY, type RateLimitPolicy } from "../rate-limit-policy";
import { RateLimit } from "../rate-limit.decorator";
import { PreAuthThrottlerGuard, PrincipalThrottlerGuard } from "../scoped-throttler.guards";
import { THROTTLED_MESSAGE, throttlerOptionsFactory, WEBHOOK_THROTTLED_MESSAGE } from "../throttler-options.factory";

/** Header the probe principal guard reads to play an authenticated user. */
const TEST_USER_HEADER = "x-test-user";

/** The strict limit the probe config uses, low so the suite stays fast. */
const STRICT_LIMIT = 2;
/** The default limit the probe config uses. */
const DEFAULT_LIMIT = 3;
/** The probe webhook policy's limit: above strict + default, so a cap by either would show. */
const WEBHOOK_PROBE_LIMIT = STRICT_LIMIT + DEFAULT_LIMIT + 1;
/** Any non-zero `WEBHOOK_RATE_LIMIT_PER_MINUTE` turns the webhook throttler on. */
const WEBHOOK_ENABLED_LIMIT = WEBHOOK_PROBE_LIMIT;
const TOO_MANY_REQUESTS = 429;
const OK = 200;
const FORBIDDEN = 403;

const ThrottledBodySchema = z.object({ error: z.object({ code: z.literal("RATE_LIMITED"), message: z.string() }) });
const TestUserHeaderSchema = z.object({ headers: z.object({ [TEST_USER_HEADER]: z.string().min(1) }) });

/**
 * Plays `AuthGuard`: a request carrying `x-test-user` gets `request.user`, so
 * the principal tracker has someone to key on. Registered before `ThrottlerGuard`,
 * the same order as `APP_GUARD_ORDER`.
 */
class ProbePrincipalGuard implements CanActivate {
	public canActivate(context: ExecutionContext): boolean {
		const request: object = context.switchToHttp().getRequest<object>();
		const parsed = TestUserHeaderSchema.safeParse(request);
		if (parsed.success) {
			Object.assign(request, { user: { id: parsed.data.headers[TEST_USER_HEADER] } });
		}
		return true;
	}
}

/**
 * Probe routes, one per policy shape. Decorators are applied as calls because
 * the spec transformer does not support decorator syntax.
 */
class ProbeController {
	public webhook(): { readonly ok: true } {
		return { ok: true };
	}

	/** Mimics a signature-rejected webhook: the handler throws 403 after the guard counted the request. */
	public rejectedWebhook(): void {
		throw new ForbiddenException("Invalid webhook signature");
	}

	public login(): { readonly ok: true } {
		return { ok: true };
	}

	public mutation(): { readonly ok: true } {
		return { ok: true };
	}

	public plain(): { readonly ok: true } {
		return { ok: true };
	}

	/** Skips every principal throttler, so only the pre-auth throttler can answer 429. */
	public open(): { readonly ok: true } {
		return { ok: true };
	}
}

function decorateMethod(target: object, key: string, decorators: readonly MethodDecorator[]): void {
	const descriptor = Object.getOwnPropertyDescriptor(target, key);
	if (descriptor === undefined) {
		throw new Error(`Missing method ${key}`);
	}
	for (const decorator of [...decorators].reverse()) {
		decorator(target, key, descriptor);
	}
}

/** A strict policy on the probe's own low limit (tracker IP, like every credential policy). */
function strictProbePolicy(): RateLimitPolicy {
	return { ...RATE_LIMIT_POLICY.login, limit: STRICT_LIMIT };
}

/** The webhook policy on the probe's own limit (the real one reads `WEBHOOK_RATE_LIMIT_PER_MINUTE` at import). */
function webhookProbePolicy(): RateLimitPolicy {
	return { ...RATE_LIMIT_POLICY.webhook, limit: WEBHOOK_PROBE_LIMIT };
}

/** A default-throttler policy on the probe's own low limit (tracker principal). */
function mutationProbePolicy(): RateLimitPolicy {
	return { ...RATE_LIMIT_POLICY.authenticatedMutation, limit: DEFAULT_LIMIT };
}

Injectable()(ProbePrincipalGuard);
Controller("probe")(ProbeController);
decorateMethod(ProbeController.prototype, "webhook", [RateLimit(webhookProbePolicy()), Get("webhook")]);
decorateMethod(ProbeController.prototype, "rejectedWebhook", [RateLimit(webhookProbePolicy()), Get("webhook/rejected")]);
decorateMethod(ProbeController.prototype, "login", [RateLimit(strictProbePolicy()), Get("login")]);
decorateMethod(ProbeController.prototype, "mutation", [RateLimit(mutationProbePolicy()), Get("mutation")]);
decorateMethod(ProbeController.prototype, "plain", [Get("plain")]);
decorateMethod(ProbeController.prototype, "open", [SkipThrottle({ strict: true, default: true }), Get("open")]);

interface ProbeOptions {
	readonly webhookLimit: number;
	readonly trustedProxies?: false | string[];
	/** `RATE_LIMIT_EXEMPT_CIDRS` for the probe. */
	readonly exemptCidrs?: string;
}

const MS_PER_SECOND = 1_000;

/**
 * Boots the probe with the real options factory, the real storage and the real in-process limiter
 * (recording its decisions), and the real error filter, as the app runs them.
 */
async function buildApp({ webhookLimit, trustedProxies = false, exemptCidrs }: ProbeOptions): Promise<NestFastifyApplication> {
	const config = createTestTypedConfig({
		WEBHOOK_RATE_LIMIT_PER_MINUTE: String(webhookLimit),
		THROTTLE_STRICT_LIMIT: String(STRICT_LIMIT),
		THROTTLE_DEFAULT_LIMIT: String(DEFAULT_LIMIT),
		...(exemptCidrs === undefined ? {} : { RATE_LIMIT_EXEMPT_CIDRS: exemptCidrs }),
	});
	const limiter = new RecordingRateLimiter();
	const storage = new RateLimiterThrottlerStorage(limiter);
	const moduleFixture: TestingModule = await Test.createTestingModule({
		imports: [ThrottlerModule.forRoot(throttlerOptionsFactory(config, storage))],
		controllers: [ProbeController],
		providers: [
			{ provide: RecordingRateLimiter, useValue: limiter },
			// Exemptions: the load-test traffic keys (none issued here) and `RATE_LIMIT_EXEMPT_CIDRS`.
			{ provide: RateLimitExemptions, useValue: new RateLimitExemptions(config, new LoadTestTrafficKeys(config, null)) },
			{ provide: RateLimitRefusalLog, useValue: new RateLimitRefusalLog(config, null) },
			// The production order: pre-auth IP throttler, authentication, principal throttlers.
			{ provide: APP_GUARD, useClass: PreAuthThrottlerGuard },
			{ provide: APP_GUARD, useClass: ProbePrincipalGuard },
			{ provide: APP_GUARD, useClass: PrincipalThrottlerGuard },
		],
	}).compile();
	const app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter({ trustProxy: trustedProxies }));
	const requestContext = new RequestContextService();
	app.useGlobalFilters(new GlobalExceptionFilter(app.get(HttpAdapterHost), new LogService(requestContext), requestContext, createAuditTrailDouble().auditTrail, config));
	await app.init();
	return app;
}

/** The probe's recording limiter. */
function limiterOf(app: NestFastifyApplication): RecordingRateLimiter {
	return app.get(RecordingRateLimiter);
}

async function statusesOf(app: NestFastifyApplication, count: number, request: Parameters<NestFastifyApplication["inject"]>[0]): Promise<number[]> {
	const statuses: number[] = [];
	for (let attempt = 0; attempt < count; attempt += 1) {
		const response = await app.inject(request);
		statuses.push(response.statusCode);
	}
	return statuses;
}

describe("throttlerOptionsFactory: webhook throttler", () => {
	it("rejects the request after the per-IP webhook limit with 429 and the webhook message", async () => {
		const app = await buildApp({ webhookLimit: WEBHOOK_ENABLED_LIMIT });
		try {
			// Above the strict and default limits: neither always-on throttler caps a webhook route.
			const statuses = await statusesOf(app, WEBHOOK_PROBE_LIMIT, { method: "GET", url: "/probe/webhook" });
			expect(statuses).not.toContain(TOO_MANY_REQUESTS);
			limiterOf(app).clear();
			const throttled = await app.inject({ method: "GET", url: "/probe/webhook" });
			expect(throttled.statusCode).toBe(TOO_MANY_REQUESTS);
			expect(limiterOf(app).policiesCounted()).not.toContain("SECURITY_ROUTES");
			expect(ThrottledBodySchema.parse(throttled.json()).error.message).toBe(WEBHOOK_THROTTLED_MESSAGE);
		} finally {
			await app.close();
		}
	});

	it("gives every client address its own bucket", async () => {
		const app = await buildApp({ webhookLimit: WEBHOOK_ENABLED_LIMIT });
		try {
			await statusesOf(app, WEBHOOK_PROBE_LIMIT, { method: "GET", url: "/probe/webhook", remoteAddress: "203.0.113.1" });
			const otherClient = await app.inject({ method: "GET", url: "/probe/webhook", remoteAddress: "203.0.113.2" });
			expect(otherClient.statusCode).toBe(OK);
		} finally {
			await app.close();
		}
	});

	it("cannot be bypassed by rotating spoofed forwarding headers from an untrusted peer", async () => {
		const app = await buildApp({ webhookLimit: WEBHOOK_ENABLED_LIMIT });
		try {
			const statuses: number[] = [];
			for (let attempt = 0; attempt <= WEBHOOK_PROBE_LIMIT; attempt += 1) {
				const spoofed = `198.51.100.${String(attempt + 1)}`;
				const response = await app.inject({
					method: "GET",
					url: "/probe/webhook",
					remoteAddress: "203.0.113.77",
					headers: { "cf-connecting-ip": spoofed, "x-forwarded-for": spoofed },
				});
				statuses.push(response.statusCode);
			}
			expect(statuses.at(-1)).toBe(TOO_MANY_REQUESTS);
		} finally {
			await app.close();
		}
	});

	it("honours X-Forwarded-For only from a trusted proxy", async () => {
		const app = await buildApp({ webhookLimit: WEBHOOK_ENABLED_LIMIT, trustedProxies: ["10.0.0.0/8"] });
		try {
			const viaProxy = (client: string): ReturnType<NestFastifyApplication["inject"]> =>
				app.inject({ method: "GET", url: "/probe/webhook", remoteAddress: "10.0.0.5", headers: { "x-forwarded-for": client } });
			for (let attempt = 0; attempt < WEBHOOK_PROBE_LIMIT; attempt += 1) {
				expect((await viaProxy("198.51.100.1")).statusCode).toBe(OK);
			}
			expect((await viaProxy("198.51.100.2")).statusCode).toBe(OK);
			expect((await viaProxy("198.51.100.1")).statusCode).toBe(TOO_MANY_REQUESTS);
		} finally {
			await app.close();
		}
	});

	it("passes every webhook request when WEBHOOK_RATE_LIMIT_PER_MINUTE is 0", async () => {
		const app = await buildApp({ webhookLimit: 0 });
		try {
			const statuses = await statusesOf(app, WEBHOOK_PROBE_LIMIT + 1, { method: "GET", url: "/probe/webhook" });
			expect(statuses).not.toContain(TOO_MANY_REQUESTS);
		} finally {
			await app.close();
		}
	});

	it("counts signature-rejected requests, because the guard runs before the handler", async () => {
		const app = await buildApp({ webhookLimit: WEBHOOK_ENABLED_LIMIT });
		try {
			const statuses = await statusesOf(app, WEBHOOK_PROBE_LIMIT + 1, { method: "GET", url: "/probe/webhook/rejected", remoteAddress: "203.0.113.50" });
			expect(statuses.slice(0, WEBHOOK_PROBE_LIMIT).every((status: number): boolean => status === FORBIDDEN)).toBe(true);
			expect(statuses.at(-1)).toBe(TOO_MANY_REQUESTS);
		} finally {
			await app.close();
		}
	});

	it("does not count routes that did not opt in to the webhook throttler", async () => {
		const app = await buildApp({ webhookLimit: WEBHOOK_ENABLED_LIMIT });
		try {
			await app.inject({ method: "GET", url: "/probe/plain" });
			expect(limiterOf(app).policiesCounted()).not.toContain("WEBHOOK");
			expect(limiterOf(app).lastDecisionOf("SECURITY_ROUTES")?.limit).toBe(STRICT_LIMIT);
		} finally {
			await app.close();
		}
	});
});

describe("throttlerOptionsFactory: trackers per throttler", () => {
	it("keys the strict throttler on the client IP, not the signed-in user", async () => {
		const app = await buildApp({ webhookLimit: WEBHOOK_ENABLED_LIMIT });
		try {
			const statuses: number[] = [];
			for (const user of ["user-a", "user-b", "user-c"]) {
				const response = await app.inject({ method: "GET", url: "/probe/login", remoteAddress: "203.0.113.60", headers: { [TEST_USER_HEADER]: user } });
				statuses.push(response.statusCode);
			}
			// Rotating the account does not reset the per-source bucket.
			expect(statuses).toEqual([OK, OK, TOO_MANY_REQUESTS]);
			const throttled = await app.inject({ method: "GET", url: "/probe/login", remoteAddress: "203.0.113.60", headers: { [TEST_USER_HEADER]: "user-d" } });
			expect(ThrottledBodySchema.parse(throttled.json()).error.message).toBe(THROTTLED_MESSAGE);
		} finally {
			await app.close();
		}
	});

	it("keys the default throttler on the principal, so one user is limited across addresses", async () => {
		const app = await buildApp({ webhookLimit: WEBHOOK_ENABLED_LIMIT });
		try {
			const statuses: number[] = [];
			for (const ip of ["203.0.113.71", "203.0.113.72", "203.0.113.73", "203.0.113.74"]) {
				const response = await app.inject({ method: "GET", url: "/probe/mutation", remoteAddress: ip, headers: { [TEST_USER_HEADER]: "user-roaming" } });
				statuses.push(response.statusCode);
			}
			expect(statuses).toEqual([OK, OK, OK, TOO_MANY_REQUESTS]);
			// Another user behind the same address keeps their own bucket.
			const otherUser = await app.inject({ method: "GET", url: "/probe/mutation", remoteAddress: "203.0.113.74", headers: { [TEST_USER_HEADER]: "user-other" } });
			expect(otherUser.statusCode).toBe(OK);
		} finally {
			await app.close();
		}
	});
});

describe("throttlerOptionsFactory: pre-authentication throttler", () => {
	const preAuthLimit = DEFAULT_LIMIT * PRE_AUTH_LIMIT_MULTIPLIER;

	it("limits every request per client IP at the multiple of the default limit, whoever claims to be signed in", async () => {
		const app = await buildApp({ webhookLimit: WEBHOOK_ENABLED_LIMIT });
		try {
			const statuses: number[] = [];
			for (let attempt = 0; attempt <= preAuthLimit; attempt += 1) {
				const response = await app.inject({ method: "GET", url: "/probe/open", remoteAddress: "203.0.113.90", headers: { [TEST_USER_HEADER]: `user-${String(attempt)}` } });
				statuses.push(response.statusCode);
			}
			expect(statuses.at(-1)).toBe(TOO_MANY_REQUESTS);
			expect(statuses.slice(0, preAuthLimit)).not.toContain(TOO_MANY_REQUESTS);
		} finally {
			await app.close();
		}
	});

	it("shares one bucket per client IP across routes", async () => {
		const app = await buildApp({ webhookLimit: WEBHOOK_ENABLED_LIMIT });
		try {
			await app.inject({ method: "GET", url: "/probe/plain", remoteAddress: "203.0.113.92" });
			await app.inject({ method: "GET", url: "/probe/open", remoteAddress: "203.0.113.92" });
			expect(limiterOf(app).lastDecisionOf("PRE_AUTH")?.remaining).toBe(preAuthLimit - 2);
		} finally {
			await app.close();
		}
	});

	it("is evaluated by the pre-auth guard only: one preAuth count per request", async () => {
		const app = await buildApp({ webhookLimit: WEBHOOK_ENABLED_LIMIT });
		try {
			await app.inject({ method: "GET", url: "/probe/plain", remoteAddress: "203.0.113.91" });
			expect(
				limiterOf(app)
					.policiesCounted()
					.filter((policy: string): boolean => policy === "PRE_AUTH"),
			).toHaveLength(1);
			expect(limiterOf(app).lastDecisionOf("PRE_AUTH")).toMatchObject({ limit: preAuthLimit, remaining: preAuthLimit - 1 });
		} finally {
			await app.close();
		}
	});
});

describe("ADR 071: refusals, headers, exemptions and penalties", () => {
	it("answers a refusal with the RATE_LIMITED envelope and Retry-After in whole seconds", async () => {
		const app = await buildApp({ webhookLimit: WEBHOOK_ENABLED_LIMIT });
		try {
			await statusesOf(app, STRICT_LIMIT, { method: "GET", url: "/probe/login", remoteAddress: "203.0.113.110" });
			const refused = await app.inject({ method: "GET", url: "/probe/login", remoteAddress: "203.0.113.110" });
			expect(refused.statusCode).toBe(TOO_MANY_REQUESTS);
			expect(ThrottledBodySchema.parse(refused.json()).error.message).toBe(THROTTLED_MESSAGE);
			const retryAfterSeconds = Number(refused.headers["retry-after"]);
			expect(Number.isInteger(retryAfterSeconds)).toBe(true);
			expect(retryAfterSeconds).toBeGreaterThan(0);
			expect(retryAfterSeconds * MS_PER_SECOND).toBeLessThanOrEqual(createTestTypedConfig().rateLimits.throttleTtlMs);
		} finally {
			await app.close();
		}
	});

	it("sends the RateLimit headers to an authenticated caller, for the policy nearest its limit", async () => {
		const app = await buildApp({ webhookLimit: WEBHOOK_ENABLED_LIMIT });
		try {
			// A credential route is counted by `strict` (per IP) and the `default` backstop (per user).
			const response = await app.inject({ method: "GET", url: "/probe/login", remoteAddress: "203.0.113.120", headers: { [TEST_USER_HEADER]: "user-headers" } });
			expect(response.statusCode).toBe(OK);
			// After one request: strict 1 of 2 is nearer its limit than default 1 of 3.
			expect(response.headers["ratelimit-policy"]).toBe(
				`"SECURITY_ROUTES";q=${String(STRICT_LIMIT)};w=${String(createTestTypedConfig().rateLimits.throttleTtlMs / MS_PER_SECOND)}`,
			);
			expect(response.headers.ratelimit).toMatch(new RegExp(`^"SECURITY_ROUTES";r=${String(STRICT_LIMIT - 1)};t=\\d+$`));
		} finally {
			await app.close();
		}
	});

	it("counts a per-user policy's route per user only: never also capped per client IP by the credential throttler", async () => {
		const app = await buildApp({ webhookLimit: WEBHOOK_ENABLED_LIMIT });
		try {
			// One user, one address: past the strict limit (2) the route still answers, up to its own limit (3).
			const statuses = await statusesOf(app, DEFAULT_LIMIT + 1, {
				method: "GET",
				url: "/probe/mutation",
				remoteAddress: "203.0.113.122",
				headers: { [TEST_USER_HEADER]: "user-busy" },
			});
			expect(statuses).toEqual([OK, OK, OK, TOO_MANY_REQUESTS]);
			expect(limiterOf(app).policiesCounted()).not.toContain("SECURITY_ROUTES");
			const response = await app.inject({ method: "GET", url: "/probe/mutation", remoteAddress: "203.0.113.123", headers: { [TEST_USER_HEADER]: "user-fresh" } });
			expect(response.headers["ratelimit-policy"]).toMatch(new RegExp(`^"AUTHENTICATED_ROUTES";q=${String(DEFAULT_LIMIT)};`));
		} finally {
			await app.close();
		}
	});

	it("sends no RateLimit headers before authentication, so attempts left are never disclosed", async () => {
		const app = await buildApp({ webhookLimit: WEBHOOK_ENABLED_LIMIT });
		try {
			const response = await app.inject({ method: "GET", url: "/probe/login", remoteAddress: "203.0.113.121" });
			expect(response.statusCode).toBe(OK);
			expect(response.headers["ratelimit-policy"]).toBeUndefined();
			expect(response.headers.ratelimit).toBeUndefined();
			expect(Object.keys(response.headers).some((name: string): boolean => name.startsWith("x-ratelimit"))).toBe(false);
		} finally {
			await app.close();
		}
	});

	it("counts traffic from an exempt CIDR but never refuses it", async () => {
		const app = await buildApp({ webhookLimit: WEBHOOK_ENABLED_LIMIT, exemptCidrs: "198.51.100.0/24" });
		try {
			const statuses = await statusesOf(app, STRICT_LIMIT + 2, { method: "GET", url: "/probe/login", remoteAddress: "198.51.100.7" });
			expect(statuses).not.toContain(TOO_MANY_REQUESTS);
			expect(limiterOf(app).lastDecisionOf("SECURITY_ROUTES")?.allowed).toBe(false);
			const outside = await statusesOf(app, STRICT_LIMIT + 1, { method: "GET", url: "/probe/login", remoteAddress: "203.0.113.130" });
			expect(outside.at(-1)).toBe(TOO_MANY_REQUESTS);
		} finally {
			await app.close();
		}
	});

	it("turns repeated refusals on a security policy into the first penalty step", async () => {
		const app = await buildApp({ webhookLimit: WEBHOOK_ENABLED_LIMIT });
		const warn = vi.spyOn(RateLimitRefusalLog.prototype, "record");
		try {
			await statusesOf(app, STRICT_LIMIT + SECURITY_STRIKE_THRESHOLD, { method: "GET", url: "/probe/login", remoteAddress: "203.0.113.140" });
			const penalized = await app.inject({ method: "GET", url: "/probe/login", remoteAddress: "203.0.113.140" });
			expect(penalized.statusCode).toBe(TOO_MANY_REQUESTS);
			const [firstStepMs = 0] = SECURITY_PENALTY_STEPS_MS;
			expect(Number(penalized.headers["retry-after"])).toBe(firstStepMs / MS_PER_SECOND);
			expect(limiterOf(app).lastDecisionOf("SECURITY_ROUTES")?.penalized).toBe(true);
			expect(warn).toHaveBeenLastCalledWith(expect.objectContaining({ policyName: "SECURITY_ROUTES", penalized: true }));
		} finally {
			warn.mockRestore();
			await app.close();
		}
	});
});

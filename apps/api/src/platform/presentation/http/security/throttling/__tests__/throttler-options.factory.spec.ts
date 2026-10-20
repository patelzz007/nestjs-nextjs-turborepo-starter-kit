import { Controller, ForbiddenException, Get, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test, type TestingModule } from "@nestjs/testing";
import { SkipThrottle, ThrottlerModule } from "@nestjs/throttler";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { createTestTypedConfig } from "../../../../../../../test/support/test-api-env";
import { RedisThrottlerStorage } from "../../../../../infrastructure/throttling/redis-throttler.storage";
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

const ThrottledBodySchema = z.object({ message: z.string() });
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
}

/** Boots the probe with the real options factory and the real storage (memory fallback, no Redis). */
async function buildApp({ webhookLimit, trustedProxies = false }: ProbeOptions): Promise<NestFastifyApplication> {
	const config = createTestTypedConfig({
		WEBHOOK_RATE_LIMIT_PER_MINUTE: String(webhookLimit),
		THROTTLE_STRICT_LIMIT: String(STRICT_LIMIT),
		THROTTLE_DEFAULT_LIMIT: String(DEFAULT_LIMIT),
	});
	const storage = new RedisThrottlerStorage(config, null);
	const moduleFixture: TestingModule = await Test.createTestingModule({
		imports: [ThrottlerModule.forRoot(throttlerOptionsFactory(config, storage))],
		controllers: [ProbeController],
		providers: [
			// The production order: pre-auth IP throttler, authentication, principal throttlers.
			{ provide: APP_GUARD, useClass: PreAuthThrottlerGuard },
			{ provide: APP_GUARD, useClass: ProbePrincipalGuard },
			{ provide: APP_GUARD, useClass: PrincipalThrottlerGuard },
		],
	}).compile();
	const app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter({ trustProxy: trustedProxies }));
	await app.init();
	return app;
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
			const throttled = await app.inject({ method: "GET", url: "/probe/webhook" });
			expect(throttled.statusCode).toBe(TOO_MANY_REQUESTS);
			expect(throttled.headers["x-ratelimit-limit-strict"]).toBeUndefined();
			expect(ThrottledBodySchema.parse(throttled.json()).message).toBe(WEBHOOK_THROTTLED_MESSAGE);
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
			const response = await app.inject({ method: "GET", url: "/probe/plain" });
			expect(response.headers["x-ratelimit-limit-webhook"]).toBeUndefined();
			expect(response.headers["x-ratelimit-limit-strict"]).toBe(String(STRICT_LIMIT));
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
			expect(ThrottledBodySchema.parse(throttled.json()).message).toBe(THROTTLED_MESSAGE);
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
			const response = await app.inject({ method: "GET", url: "/probe/open", remoteAddress: "203.0.113.92" });
			expect(response.headers["x-ratelimit-remaining-preauth"]).toBe(String(preAuthLimit - 2));
		} finally {
			await app.close();
		}
	});

	it("is evaluated by the pre-auth guard only: the principal guard sets no preAuth headers", async () => {
		const app = await buildApp({ webhookLimit: WEBHOOK_ENABLED_LIMIT });
		try {
			const response = await app.inject({ method: "GET", url: "/probe/plain", remoteAddress: "203.0.113.91" });
			expect(response.headers["x-ratelimit-limit-preauth"]).toBe(String(preAuthLimit));
			expect(response.headers["x-ratelimit-remaining-preauth"]).toBe(String(preAuthLimit - 1));
		} finally {
			await app.close();
		}
	});
});

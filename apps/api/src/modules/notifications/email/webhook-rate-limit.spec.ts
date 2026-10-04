import { Controller, ForbiddenException, Get, UseGuards } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { ThrottlerGuard, ThrottlerModule, type ThrottlerModuleOptions } from "@nestjs/throttler";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { ConfigModule } from "../../../config/config.module";
import { TypedConfigService } from "../../../config/typed-config.service";
import { throttleTrackerFor } from "../../../common/http/client-ip";
import { webhookThrottlerOptionsFactory } from "./webhook-throttler";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";

/**
 * Test-only controller wired into a throwaway TestingModule to exercise
 * `ThrottlerGuard`. Decorators are applied as calls because the spec
 * transformer does not support decorator syntax.
 */
class ProbeController {
	public ping(): { readonly ok: true } {
		return { ok: true };
	}

	/**
	 * Mimics a signature-rejected request: the handler throws 403 like the real
	 * webhook does on a bad signature. The guard runs BEFORE the handler, so
	 * these requests still consume the per-IP bucket — proving that a flood of
	 * invalid requests is throttled too (brute-force protection).
	 */
	public forbidden(): void {
		throw new ForbiddenException("Invalid webhook signature");
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

Controller("probe")(ProbeController);
decorateMethod(ProbeController.prototype, "ping", [UseGuards(ThrottlerGuard), Get()]);
decorateMethod(ProbeController.prototype, "forbidden", [UseGuards(ThrottlerGuard), Get("forbidden")]);

/** The part of the 429 body this suite asserts on (the throttler adds status fields around it). */
const ThrottledBodySchema = z.object({ message: z.string() });

describe("throttleTrackerFor", () => {
	it("tracks by Fastify's request.ip — never by a forwarding header", () => {
		expect(throttleTrackerFor({ ip: "203.0.113.9", headers: { "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" } })).toBe("203.0.113.9");
	});

	it("normalizes an IPv4-mapped address and falls back to 'unknown' without an ip", () => {
		expect(throttleTrackerFor({ ip: "::ffff:127.0.0.1" })).toBe("127.0.0.1");
		expect(throttleTrackerFor({ headers: {} })).toBe("unknown");
	});
});

/** Real config service (parsed through the real schema) with WEBHOOK_RATE_LIMIT_PER_MINUTE set. */
function fakeConfig(limit: number): TypedConfigService {
	return createTestTypedConfig({ WEBHOOK_RATE_LIMIT_PER_MINUTE: String(limit) });
}

async function buildApp(limit: number, trustedProxies: false | string[] = false): Promise<NestFastifyApplication> {
	const moduleFixture: TestingModule = await Test.createTestingModule({
		imports: [
			ThrottlerModule.forRootAsync({
				imports: [],
				useFactory: (): ThrottlerModuleOptions => webhookThrottlerOptionsFactory(fakeConfig(limit)),
			}),
		],
		controllers: [ProbeController],
	}).compile();
	const app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter({ trustProxy: trustedProxies }));
	await app.init();
	return app;
}

describe("Webhook per-IP rate limiting (ThrottlerGuard)", () => {
	it("rejects the request that exceeds the per-IP limit with 429 + a clear message", async () => {
		const app: NestFastifyApplication = await buildApp(3);
		try {
			for (let i = 0; i < 3; i += 1) {
				const ok = await app.inject({ method: "GET", url: "/probe" });
				expect(ok.statusCode).toBe(200);
			}
			const throttled = await app.inject({ method: "GET", url: "/probe" });
			expect(throttled.statusCode).toBe(429);
			expect(ThrottledBodySchema.parse(throttled.json()).message).toContain("rate-limited per IP");
		} finally {
			await app.close();
		}
	});

	it("counts per client address: different IPs do not share a bucket", async () => {
		const app: NestFastifyApplication = await buildApp(2);
		try {
			for (const ip of ["203.0.113.1", "203.0.113.2", "203.0.113.3", "203.0.113.4"]) {
				const response = await app.inject({ method: "GET", url: "/probe", remoteAddress: ip });
				expect(response.statusCode).toBe(200);
			}
		} finally {
			await app.close();
		}
	});

	it("shares a bucket when the SAME client address sends repeatedly", async () => {
		const app: NestFastifyApplication = await buildApp(2);
		try {
			const first = await app.inject({ method: "GET", url: "/probe", remoteAddress: "203.0.113.9" });
			expect(first.statusCode).toBe(200);
			const second = await app.inject({ method: "GET", url: "/probe", remoteAddress: "203.0.113.9" });
			expect(second.statusCode).toBe(200);
			const throttled = await app.inject({ method: "GET", url: "/probe", remoteAddress: "203.0.113.9" });
			expect(throttled.statusCode).toBe(429);
		} finally {
			await app.close();
		}
	});

	it("cannot be bypassed by rotating spoofed cf-connecting-ip / x-forwarded-for headers from an untrusted peer", async () => {
		const app: NestFastifyApplication = await buildApp(2);
		try {
			const statuses: number[] = [];
			for (const spoofed of ["1.1.1.1", "2.2.2.2", "3.3.3.3", "4.4.4.4"]) {
				const response = await app.inject({
					method: "GET",
					url: "/probe",
					remoteAddress: "203.0.113.77",
					headers: { "cf-connecting-ip": spoofed, "x-forwarded-for": spoofed },
				});
				statuses.push(response.statusCode);
			}
			expect(statuses).toEqual([200, 200, 429, 429]);
		} finally {
			await app.close();
		}
	});

	it("honours X-Forwarded-For only from a trusted proxy (real client behind it gets its own bucket)", async () => {
		const app: NestFastifyApplication = await buildApp(1, ["10.0.0.0/8"]);
		try {
			const viaProxy = (client: string): ReturnType<NestFastifyApplication["inject"]> =>
				app.inject({ method: "GET", url: "/probe", remoteAddress: "10.0.0.5", headers: { "x-forwarded-for": client } });
			expect((await viaProxy("198.51.100.1")).statusCode).toBe(200);
			expect((await viaProxy("198.51.100.2")).statusCode).toBe(200);
			expect((await viaProxy("198.51.100.1")).statusCode).toBe(429);
		} finally {
			await app.close();
		}
	});

	it("passes everything when the limit is 0 (disabled)", async () => {
		const app: NestFastifyApplication = await buildApp(0);
		try {
			for (let i = 0; i < 6; i += 1) {
				const response = await app.inject({ method: "GET", url: "/probe" });
				expect(response.statusCode).toBe(200);
			}
		} finally {
			await app.close();
		}
	});

	it("counts signature-rejected requests toward the limit (guard runs before the handler)", async () => {
		const app: NestFastifyApplication = await buildApp(2);
		try {
			// Two requests that 403 in the handler (like a bad webhook signature)…
			const rejectedA = await app.inject({ method: "GET", url: "/probe/forbidden", remoteAddress: "203.0.113.50" });
			expect(rejectedA.statusCode).toBe(403);
			const rejectedB = await app.inject({ method: "GET", url: "/probe/forbidden", remoteAddress: "203.0.113.50" });
			expect(rejectedB.statusCode).toBe(403);
			// …exhaust the bucket, so the NEXT request to the same route is throttled.
			// (Note: the throttler key is per-IP AND per-handler, so the third hit on
			// THIS route is the one that trips the limiter.)
			const throttled = await app.inject({ method: "GET", url: "/probe/forbidden", remoteAddress: "203.0.113.50" });
			expect(throttled.statusCode).toBe(429);
		} finally {
			await app.close();
		}
	});

	it("resolves TypedConfigService through the REAL DI path (ConfigModule + inject), like production", async () => {
		// Regression test for the boot-time `UnknownDependenciesException`:
		// `ThrottlerModule.forRootAsync({ inject: [TypedConfigService] })` resolves
		// inside the dynamic module's context, so the config provider must come
		// from a @Global module (ConfigModule) — a locally-provided
		// TypedConfigService in NotificationsModule is NOT visible there.
		// The isGlobal assertion guards against someone later dropping the
		// @Global() decorator (which would re-break boot while the boot test
		// below would still pass, since it imports ConfigModule directly).
		// Nest's @Global() decorator writes GLOBAL_MODULE_METADATA = "__module:global__".
		expect(Reflect.getMetadata("__module:global__", ConfigModule)).toBe(true);
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [
				ConfigModule,
				ThrottlerModule.forRootAsync({
					imports: [ConfigModule],
					inject: [TypedConfigService],
					useFactory: webhookThrottlerOptionsFactory,
				}),
			],
			controllers: [ProbeController],
		}).compile();
		const app: NestFastifyApplication = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
		try {
			await app.init();
			// Boot succeeded = the DI graph resolved. Default limit is 120, so one
			// request passes.
			const response = await app.inject({ method: "GET", url: "/probe" });
			expect(response.statusCode).toBe(200);
		} finally {
			await app.close();
		}
	});
});

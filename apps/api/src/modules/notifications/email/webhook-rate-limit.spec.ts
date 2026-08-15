import { type INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { ThrottlerModule, type ThrottlerModuleOptions } from "@nestjs/throttler";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { ConfigModule } from "../../../config/config.module";
import { TypedConfigService } from "../../../config/typed-config.service";
import { resolveClientIp, webhookThrottlerOptionsFactory } from "./webhook-throttler";
import { ProbeController } from "./webhook-rate-limit.probe";

describe("resolveClientIp", () => {
	it("prefers cf-connecting-ip (set by Cloudflare's edge, forwarded by cloudflared)", () => {
		expect(
			resolveClientIp({
				headers: { "cf-connecting-ip": "203.0.113.9", "x-forwarded-for": "198.51.100.1, 10.0.0.1" },
				ip: "127.0.0.1",
			}),
		).toBe("203.0.113.9");
	});

	it("falls back to the first x-forwarded-for hop when cf-connecting-ip is absent", () => {
		expect(resolveClientIp({ headers: { "x-forwarded-for": "198.51.100.1, 10.0.0.1" }, ip: "127.0.0.1" })).toBe("198.51.100.1");
	});

	it("falls back to req.ip for direct localhost traffic", () => {
		expect(resolveClientIp({ headers: {}, ip: "127.0.0.1" })).toBe("127.0.0.1");
	});

	it("returns 'unknown' when no IP information exists", () => {
		expect(resolveClientIp({ headers: {} })).toBe("unknown");
	});

	it("ignores empty/whitespace cf-connecting-ip values", () => {
		expect(resolveClientIp({ headers: { "cf-connecting-ip": "   " }, ip: "10.0.0.5" })).toBe("10.0.0.5");
	});
});

function fakeConfig(limit: number): TypedConfigService {
	return { webhookRateLimitPerMinute: limit } as unknown as TypedConfigService;
}

async function buildApp(limit: number): Promise<INestApplication> {
	const moduleFixture: TestingModule = await Test.createTestingModule({
		imports: [
			ThrottlerModule.forRootAsync({
				useFactory: (): ThrottlerModuleOptions => webhookThrottlerOptionsFactory(fakeConfig(limit)),
			}),
		],
		controllers: [ProbeController],
	}).compile();
	const app = moduleFixture.createNestApplication();
	await app.init();
	return app;
}

describe("Webhook per-IP rate limiting (ThrottlerGuard)", () => {
	it("rejects the request that exceeds the per-IP limit with 429 + a clear message", async () => {
		const app: INestApplication = await buildApp(3);
		try {
			const server = app.getHttpServer();
			await request(server).get("/probe").expect(200);
			await request(server).get("/probe").expect(200);
			await request(server).get("/probe").expect(200);
			const throttled = await request(server).get("/probe").expect(429);
			expect(throttled.body.message).toContain("rate-limited per IP");
		} finally {
			await app.close();
		}
	});

	it("counts per cf-connecting-ip: different IPs do not share a bucket", async () => {
		const app: INestApplication = await buildApp(2);
		try {
			const server = app.getHttpServer();
			for (const ip of ["203.0.113.1", "203.0.113.2", "203.0.113.3", "203.0.113.4"]) {
				await request(server).get("/probe").set("cf-connecting-ip", ip).expect(200);
			}
		} finally {
			await app.close();
		}
	});

	it("shares a bucket when the SAME cf-connecting-ip sends repeatedly", async () => {
		const app: INestApplication = await buildApp(2);
		try {
			const server = app.getHttpServer();
			await request(server).get("/probe").set("cf-connecting-ip", "203.0.113.9").expect(200);
			await request(server).get("/probe").set("cf-connecting-ip", "203.0.113.9").expect(200);
			await request(server).get("/probe").set("cf-connecting-ip", "203.0.113.9").expect(429);
		} finally {
			await app.close();
		}
	});

	it("passes everything when the limit is 0 (disabled)", async () => {
		const app: INestApplication = await buildApp(0);
		try {
			const server = app.getHttpServer();
			for (let i = 0; i < 6; i += 1) {
				await request(server).get("/probe").expect(200);
			}
		} finally {
			await app.close();
		}
	});

	it("counts signature-rejected requests toward the limit (guard runs before the handler)", async () => {
		const app: INestApplication = await buildApp(2);
		try {
			const server = app.getHttpServer();
			// Two requests that 403 in the handler (like a bad webhook signature)…
			await request(server).get("/probe/forbidden").set("cf-connecting-ip", "203.0.113.50").expect(403);
			await request(server).get("/probe/forbidden").set("cf-connecting-ip", "203.0.113.50").expect(403);
			// …exhaust the bucket, so the NEXT request to the same route is throttled.
			// (Note: the throttler key is per-IP AND per-handler, so the third hit on
			// THIS route is the one that trips the limiter.)
			await request(server).get("/probe/forbidden").set("cf-connecting-ip", "203.0.113.50").expect(429);
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
					inject: [TypedConfigService],
					useFactory: webhookThrottlerOptionsFactory,
				}),
			],
			controllers: [ProbeController],
		}).compile();
		const app: INestApplication = moduleFixture.createNestApplication();
		try {
			await app.init();
			// Boot succeeded = the DI graph resolved. Default limit is 120, so one
			// request passes.
			await request(app.getHttpServer()).get("/probe").expect(200);
		} finally {
			await app.close();
		}
	});
});

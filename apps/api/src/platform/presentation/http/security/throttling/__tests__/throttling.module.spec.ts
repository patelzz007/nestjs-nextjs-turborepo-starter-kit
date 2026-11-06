import { Controller, Get, Global, Module, type DynamicModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test, type TestingModule } from "@nestjs/testing";
import { ThrottlerStorage } from "@nestjs/throttler";
import { describe, expect, it } from "vitest";

import { RecordingRateLimiter } from "../../../../../../../e2e/support/recording-rate-limiter";
import { ConfigModule } from "../../../../../../config/config.module";
import { RATE_LIMITER } from "../../../../../application/ports/rate-limiter.port";
import { FailoverRateLimiter } from "../../../../../infrastructure/rate-limiting/failover-rate-limiter";
import { RateLimitingModule } from "../../../../../infrastructure/rate-limiting/rate-limiting.module";
import { REDIS_PUBLISHER } from "../../../../../infrastructure/redis/redis.tokens";
import { RateLimiterThrottlerStorage } from "../../../../../infrastructure/throttling/rate-limiter-throttler.storage";
import { PreAuthThrottlerGuard, PrincipalThrottlerGuard } from "../scoped-throttler.guards";
import { ThrottlingModule } from "../throttling.module";

/** Stands in for the global `RedisModule` when Redis is not configured. */
class NoRedisModule {
	public static create(): DynamicModule {
		return { module: NoRedisModule, providers: [{ provide: REDIS_PUBLISHER, useValue: null }], exports: [REDIS_PUBLISHER] };
	}
}

/** Decorators are applied as calls because the spec transformer does not support decorator syntax. */
class ProbeController {
	public ping(): { readonly ok: true } {
		return { ok: true };
	}
}

Global()(NoRedisModule);
Module({})(NoRedisModule);
Controller("probe")(ProbeController);
const pingDescriptor = Object.getOwnPropertyDescriptor(ProbeController.prototype, "ping");
if (pingDescriptor === undefined) {
	throw new Error("ProbeController.ping is missing");
}
Get()(ProbeController.prototype, "ping", pingDescriptor);

async function boot(limiter: RecordingRateLimiter | null): Promise<{ readonly app: NestFastifyApplication; readonly moduleRef: TestingModule }> {
	const builder = Test.createTestingModule({
		imports: [ConfigModule, NoRedisModule.create(), RateLimitingModule, ThrottlingModule],
		controllers: [ProbeController],
		providers: [
			{ provide: APP_GUARD, useClass: PreAuthThrottlerGuard },
			{ provide: APP_GUARD, useClass: PrincipalThrottlerGuard },
		],
	});
	const moduleRef: TestingModule = await (limiter === null ? builder : builder.overrideProvider(RATE_LIMITER).useValue(limiter)).compile();
	const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
	await app.init();
	return { app, moduleRef };
}

describe("ThrottlingModule wiring", () => {
	it("hands ThrottlerGuard the one storage, which counts every throttler through the shared RATE_LIMITER", async () => {
		const limiter = new RecordingRateLimiter();
		const { app, moduleRef } = await boot(limiter);
		try {
			const storage: ThrottlerStorage = moduleRef.get(ThrottlerStorage, { strict: false });
			expect(storage).toBeInstanceOf(RateLimiterThrottlerStorage);
			// One instance: the options' `storage` IS the provider every custom guard injects.
			expect(storage).toBe(moduleRef.get(RateLimiterThrottlerStorage, { strict: false }));

			const response = await app.inject({ method: "GET", url: "/probe" });
			expect(response.statusCode).toBe(200);
			expect(limiter.policiesCounted()).toEqual(expect.arrayContaining(["PRE_AUTH", "SECURITY_ROUTES", "AUTHENTICATED_ROUTES"]));
		} finally {
			await app.close();
		}
	});

	it("counts in the local fallback limiter when Redis is not configured", async () => {
		const { app, moduleRef } = await boot(null);
		try {
			expect(moduleRef.get(RATE_LIMITER, { strict: false })).toBeInstanceOf(FailoverRateLimiter);
			const response = await app.inject({ method: "GET", url: "/probe" });
			expect(response.statusCode).toBe(200);
		} finally {
			await app.close();
		}
	});
});

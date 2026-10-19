import { Controller, Get, Global, Module, type DynamicModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test, type TestingModule } from "@nestjs/testing";
import { ThrottlerStorage } from "@nestjs/throttler";
import { describe, expect, it } from "vitest";

import { ConfigModule } from "../../../../../../config/config.module";
import { REDIS_PUBLISHER } from "../../../../../infrastructure/redis/redis.tokens";
import { RedisThrottlerStorage, type ThrottleCounterClient } from "../../../../../infrastructure/throttling/redis-throttler.storage";
import { PreAuthThrottlerGuard, PrincipalThrottlerGuard } from "../scoped-throttler.guards";
import { ThrottlingModule } from "../throttling.module";

/** A real in-memory counter with Redis' INCR / PEXPIRE / PTTL semantics, recording every key it counted. */
class RecordingCounterClient implements ThrottleCounterClient {
	public readonly incrementedKeys: string[] = [];
	private readonly counts: Map<string, number> = new Map<string, number>();
	private readonly expiries: Map<string, number> = new Map<string, number>();

	public incr(key: string): Promise<number> {
		this.incrementedKeys.push(key);
		const next: number = (this.counts.get(key) ?? 0) + 1;
		this.counts.set(key, next);
		return Promise.resolve(next);
	}

	public pexpire(key: string, milliseconds: number): Promise<number> {
		this.expiries.set(key, milliseconds);
		return Promise.resolve(1);
	}

	public pttl(key: string): Promise<number> {
		return Promise.resolve(this.expiries.get(key) ?? -1);
	}
}

/** Stands in for the global `RedisModule`: the shared publisher, or `null` when Redis is not configured. */
class FakeRedisModule {
	public static with(client: ThrottleCounterClient | null): DynamicModule {
		return { module: FakeRedisModule, providers: [{ provide: REDIS_PUBLISHER, useValue: client }], exports: [REDIS_PUBLISHER] };
	}
}

/** Decorators are applied as calls because the spec transformer does not support decorator syntax. */
class ProbeController {
	public ping(): { readonly ok: true } {
		return { ok: true };
	}
}

Global()(FakeRedisModule);
Module({})(FakeRedisModule);
Controller("probe")(ProbeController);
const pingDescriptor = Object.getOwnPropertyDescriptor(ProbeController.prototype, "ping");
if (pingDescriptor === undefined) {
	throw new Error("ProbeController.ping is missing");
}
Get()(ProbeController.prototype, "ping", pingDescriptor);

async function bootWith(client: ThrottleCounterClient | null): Promise<{ readonly app: NestFastifyApplication; readonly moduleRef: TestingModule }> {
	const moduleRef: TestingModule = await Test.createTestingModule({
		imports: [ConfigModule, FakeRedisModule.with(client), ThrottlingModule],
		controllers: [ProbeController],
		providers: [
			{ provide: APP_GUARD, useClass: PreAuthThrottlerGuard },
			{ provide: APP_GUARD, useClass: PrincipalThrottlerGuard },
		],
	}).compile();
	const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
	await app.init();
	return { app, moduleRef };
}

describe("ThrottlingModule wiring", () => {
	it("hands ThrottlerGuard the Redis storage when Redis is configured, and counts in Redis", async () => {
		const client = new RecordingCounterClient();
		const { app, moduleRef } = await bootWith(client);
		try {
			const storage: ThrottlerStorage = moduleRef.get(ThrottlerStorage, { strict: false });
			expect(storage).toBeInstanceOf(RedisThrottlerStorage);
			// One instance: the options' `storage` IS the provider every custom guard injects.
			expect(storage).toBe(moduleRef.get(RedisThrottlerStorage, { strict: false }));

			const response = await app.inject({ method: "GET", url: "/probe" });
			expect(response.statusCode).toBe(200);
			expect(client.incrementedKeys.some((key: string): boolean => key.includes("throttle:strict:"))).toBe(true);
			expect(client.incrementedKeys.some((key: string): boolean => key.includes("throttle:default:"))).toBe(true);
			expect(client.incrementedKeys.some((key: string): boolean => key.includes("throttle:preAuth:"))).toBe(true);
		} finally {
			await app.close();
		}
	});

	it("keeps the same storage (memory fallback) when Redis is not configured", async () => {
		const { app, moduleRef } = await bootWith(null);
		try {
			expect(moduleRef.get(ThrottlerStorage, { strict: false })).toBeInstanceOf(RedisThrottlerStorage);
			const response = await app.inject({ method: "GET", url: "/probe" });
			expect(response.statusCode).toBe(200);
			expect(response.headers["x-ratelimit-remaining-strict"]).toBeDefined();
		} finally {
			await app.close();
		}
	});
});

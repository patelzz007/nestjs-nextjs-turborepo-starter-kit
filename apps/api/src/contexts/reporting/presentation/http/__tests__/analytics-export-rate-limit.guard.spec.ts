import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host";
import type { ThrottlerStorage } from "@nestjs/throttler";
import type { ThrottlerStorageRecord } from "@nestjs/throttler/dist/throttler-storage-record.interface";
import { ANALYTICS_EXPORT_RATE_LIMIT, ANALYTICS_EXPORT_RATE_LIMIT_WINDOW_MS } from "@workspace/shared";
import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";

import { captureFastifyRequest } from "../../../../../../test/support/fastify-request";
import type { ActorContext } from "../../../../../platform/application/actor-context";
import { anonymousActor, apiKeyActor, userActor } from "../../../application/__tests__/fakes/analytics-actors";
import {
	AnalyticsExportCallerMissingError,
	AnalyticsExportRateLimitGuard,
	AnalyticsExportRateLimitedError,
	exportCallerKey,
	type HttpActorResolver,
} from "../analytics-export-rate-limit.guard";

/** How far into the window the in-memory store says each hit landed. */
const ELAPSED_IN_WINDOW_MS = 1_500;
const MS_PER_SECOND = 1_000;

/** An in-memory throttler store: hits per key within one window. */
class CountingStorage implements ThrottlerStorage {
	public readonly hits = new Map<string, number>();
	public readonly windows: number[] = [];

	public increment(key: string, ttl: number): Promise<ThrottlerStorageRecord> {
		const totalHits = (this.hits.get(key) ?? 0) + 1;
		this.hits.set(key, totalHits);
		this.windows.push(ttl);
		return Promise.resolve({ totalHits, timeToExpire: ttl - ELAPSED_IN_WINDOW_MS, isBlocked: false, timeToBlockExpire: 0 });
	}
}

/** Resolves every request to one fixed actor (the security kit's factory reads it from the request). */
class FixedActorResolver implements HttpActorResolver {
	public readonly requests: FastifyRequest[] = [];

	public constructor(private readonly actor: ActorContext) {}

	public fromHttpRequest(request: FastifyRequest): ActorContext {
		this.requests.push(request);
		return this.actor;
	}
}

async function httpContext(): Promise<ExecutionContextHost> {
	const request = await captureFastifyRequest({ headers: {} });
	return new ExecutionContextHost([request]);
}

describe("exportCallerKey", () => {
	it("keys by the authenticated user, else by the API key — never by IP", () => {
		expect(exportCallerKey(userActor("user-1"))).toBe("user:user-1");
		expect(exportCallerKey(apiKeyActor("key-1", "org-1"))).toBe("api-key:key-1");
		expect(() => exportCallerKey(anonymousActor())).toThrow(AnalyticsExportCallerMissingError);
	});
});

describe("AnalyticsExportRateLimitGuard", () => {
	it(`allows ${String(ANALYTICS_EXPORT_RATE_LIMIT)} exports per window per user, then answers 429 with Retry-After`, async () => {
		const storage = new CountingStorage();
		const guard = new AnalyticsExportRateLimitGuard(storage, new FixedActorResolver(userActor("user-1")));
		const context = await httpContext();

		for (let attempt = 0; attempt < ANALYTICS_EXPORT_RATE_LIMIT; attempt += 1) {
			await expect(guard.canActivate(context)).resolves.toBe(true);
		}
		const refused = guard.canActivate(context);
		await expect(refused).rejects.toBeInstanceOf(AnalyticsExportRateLimitedError);
		await expect(refused).rejects.toMatchObject({
			code: "ANALYTICS_EXPORT_RATE_LIMITED",
			details: { retryAfterSeconds: Math.ceil((ANALYTICS_EXPORT_RATE_LIMIT_WINDOW_MS - ELAPSED_IN_WINDOW_MS) / MS_PER_SECOND) },
		});
		expect(storage.windows.every((window) => window === ANALYTICS_EXPORT_RATE_LIMIT_WINDOW_MS)).toBe(true);
	});

	it("counts each user separately", async () => {
		const storage = new CountingStorage();
		storage.hits.set("analytics-export:user:busy", ANALYTICS_EXPORT_RATE_LIMIT);
		const guard = new AnalyticsExportRateLimitGuard(storage, new FixedActorResolver(userActor("other")));

		await expect(guard.canActivate(await httpContext())).resolves.toBe(true);
	});

	it("refuses a caller that is neither a user nor an API key before counting anything", async () => {
		const storage = new CountingStorage();
		const guard = new AnalyticsExportRateLimitGuard(storage, new FixedActorResolver(anonymousActor()));

		await expect(guard.canActivate(await httpContext())).rejects.toBeInstanceOf(AnalyticsExportCallerMissingError);
		expect(storage.hits.size).toBe(0);
	});
});

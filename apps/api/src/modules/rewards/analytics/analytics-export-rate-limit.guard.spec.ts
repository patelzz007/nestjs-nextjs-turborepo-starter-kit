import type { ThrottlerStorage } from "@nestjs/throttler";
import type { ThrottlerStorageRecord } from "@nestjs/throttler/dist/throttler-storage-record.interface";
import { ANALYTICS_EXPORT_RATE_LIMIT, ANALYTICS_EXPORT_RATE_LIMIT_WINDOW_MS } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { RequestContextService } from "../../../common/context/request-context";
import { AnalyticsExportCallerMissingError, AnalyticsExportRateLimitGuard, AnalyticsExportRateLimitedError, exportCallerKey } from "./analytics-export-rate-limit.guard";

const SEED = { correlationId: "corr-rate", ip: "203.0.113.5", userAgent: "vitest", edgeLocation: undefined };

/** An in-memory throttler store: hits per key within one window. */
class CountingStorage implements ThrottlerStorage {
	public readonly hits = new Map<string, number>();
	public readonly windows: number[] = [];

	public increment(key: string, ttl: number): Promise<ThrottlerStorageRecord> {
		const totalHits = (this.hits.get(key) ?? 0) + 1;
		this.hits.set(key, totalHits);
		this.windows.push(ttl);
		return Promise.resolve({ totalHits, timeToExpire: ttl - 1_500, isBlocked: false, timeToBlockExpire: 0 });
	}
}

describe("exportCallerKey", () => {
	it("keys by the authenticated user, else by the API key — never by IP", () => {
		const context = new RequestContextService();
		context.run(SEED, () => {
			context.bindPrincipal({ userId: "user-1", impersonatorId: undefined, impersonationSessionId: undefined, authMethod: "SESSION_COOKIE" });
			expect(exportCallerKey(context.current())).toBe("user:user-1");
		});
		context.run(SEED, () => {
			context.bindApiKey({ apiKeyId: "key-1", organizationId: "org-1", terminalId: undefined, locationId: null });
			expect(exportCallerKey(context.current())).toBe("api-key:key-1");
		});
		expect(() => exportCallerKey(undefined)).toThrow(AnalyticsExportCallerMissingError);
	});
});

describe("AnalyticsExportRateLimitGuard", () => {
	it(`allows ${String(ANALYTICS_EXPORT_RATE_LIMIT)} exports per window per user, then answers 429 with Retry-After`, async () => {
		const storage = new CountingStorage();
		const context = new RequestContextService();
		const guard = new AnalyticsExportRateLimitGuard(storage, context);

		await context.run(SEED, async () => {
			context.bindPrincipal({ userId: "user-1", impersonatorId: undefined, impersonationSessionId: undefined, authMethod: "SESSION_COOKIE" });
			for (let attempt = 0; attempt < ANALYTICS_EXPORT_RATE_LIMIT; attempt += 1) {
				await expect(guard.canActivate()).resolves.toBe(true);
			}
			const refused = guard.canActivate();
			await expect(refused).rejects.toBeInstanceOf(AnalyticsExportRateLimitedError);
			await expect(refused).rejects.toMatchObject({
				code: "ANALYTICS_EXPORT_RATE_LIMITED",
				details: { retryAfterSeconds: Math.ceil((ANALYTICS_EXPORT_RATE_LIMIT_WINDOW_MS - 1_500) / 1_000) },
			});
		});
		expect(storage.windows.every((window) => window === ANALYTICS_EXPORT_RATE_LIMIT_WINDOW_MS)).toBe(true);
	});

	it("counts each user separately", async () => {
		const storage = new CountingStorage();
		const context = new RequestContextService();
		const guard = new AnalyticsExportRateLimitGuard(storage, context);
		storage.hits.set("analytics-export:user:busy", ANALYTICS_EXPORT_RATE_LIMIT);

		await context.run(SEED, async () => {
			context.bindPrincipal({ userId: "other", impersonatorId: undefined, impersonationSessionId: undefined, authMethod: "SESSION_COOKIE" });
			await expect(guard.canActivate()).resolves.toBe(true);
		});
	});
});

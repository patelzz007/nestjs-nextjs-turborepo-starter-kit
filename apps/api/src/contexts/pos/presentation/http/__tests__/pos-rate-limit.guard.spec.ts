import type { ExecutionContext } from "@nestjs/common";
import type { ThrottlerStorage } from "@nestjs/throttler";
import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";

import { createHttpContext, testRequest } from "../../../../../../test/support/http-execution-context";
import { setTillPointOnRequest, TillPointMissingError } from "../../../../../platform/presentation/http/security/api-keys/api-key-request";
import { POS_RATE_LIMIT_PER_KEY, POS_RATE_LIMIT_TTL_MS, PosRateLimitGuard } from "../guards/pos-rate-limit.guard";

/** A throttler store counting hits per key, as the shared store does within one window. */
class CountingStorage implements Pick<ThrottlerStorage, "increment"> {
	public readonly calls: { readonly key: string; readonly ttl: number; readonly limit: number; readonly name: string }[] = [];
	private readonly hits = new Map<string, number>();

	public increment(key: string, ttl: number, limit: number, _blockDuration: number, throttlerName: string): ReturnType<ThrottlerStorage["increment"]> {
		const totalHits = (this.hits.get(key) ?? 0) + 1;
		this.hits.set(key, totalHits);
		this.calls.push({ key, ttl, limit, name: throttlerName });
		return Promise.resolve({ totalHits, timeToExpire: ttl, isBlocked: false, timeToBlockExpire: 0 });
	}
}

/** An HTTP context whose request the till guard already resolved to `apiKeyId`'s till. */
function tillContext(apiKeyId: string): ExecutionContext {
	const context = createHttpContext(testRequest({}));
	setTillPointOnRequest(context.switchToHttp().getRequest<FastifyRequest>(), { tenantId: "org-1", locationId: null, terminalId: "TERM-AAAA2222", apiKeyId });
	return context;
}

describe("PosRateLimitGuard", () => {
	it("counts each API key on its own, and refuses the call past the per-key limit with 429 POS_RATE_LIMITED", async () => {
		const storage = new CountingStorage();
		const guard = new PosRateLimitGuard(storage);

		for (let call = 0; call < POS_RATE_LIMIT_PER_KEY; call += 1) {
			await expect(guard.canActivate(tillContext("key-1"))).resolves.toBe(true);
		}
		await expect(guard.canActivate(tillContext("key-1"))).rejects.toMatchObject({ status: 429, response: { error: "POS_RATE_LIMITED" } });
		await expect(guard.canActivate(tillContext("key-2"))).resolves.toBe(true);
		expect(storage.calls.at(0)).toEqual({ key: "pos:key-1", ttl: POS_RATE_LIMIT_TTL_MS, limit: POS_RATE_LIMIT_PER_KEY, name: "pos" });
	});

	it("fails loudly on a route without the till guard before it", async () => {
		await expect(new PosRateLimitGuard(new CountingStorage()).canActivate(createHttpContext(testRequest({})))).rejects.toBeInstanceOf(TillPointMissingError);
	});
});

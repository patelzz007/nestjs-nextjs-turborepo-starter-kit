import type { ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";

import { createHttpContext, testRequest } from "../../../../../../e2e/support/http-execution-context";
import { RecordingRateLimiter } from "../../../../../../e2e/support/recording-rate-limiter";
import { setTillPointOnRequest, TillPointMissingError } from "../../../../../platform/presentation/http/security/api-keys/api-key-request";
import { POS_RATE_LIMIT_PER_KEY, POS_RATE_LIMIT_POLICY, POS_RATE_LIMIT_TTL_MS, PosRateLimitedError, PosRateLimitGuard } from "../guards/pos-rate-limit.guard";

/** A clock at the start of a window, so a refusal waits the whole window. */
const WINDOW_START_EPOCH_MS = POS_RATE_LIMIT_TTL_MS * 1_000;
const MS_PER_SECOND = 1_000;

/** The real in-process limiter (the same algorithm as the Redis script) on a fixed clock. */
function limiter(): RecordingRateLimiter {
	return new RecordingRateLimiter((): number => WINDOW_START_EPOCH_MS);
}

/** An HTTP context whose request the till guard already resolved to `apiKeyId`'s till. */
function tillContext(apiKeyId: string): ExecutionContext {
	const context = createHttpContext(testRequest({}));
	setTillPointOnRequest(context.switchToHttp().getRequest<FastifyRequest>(), { tenantId: "org-1", locationId: null, terminalId: "TERM-AAAA2222", apiKeyId });
	return context;
}

describe("PosRateLimitGuard", () => {
	it("counts each API key on its own, and refuses the call past the per-key limit with 429 POS_RATE_LIMITED", async () => {
		const shared = limiter();
		const consume = vi.spyOn(shared, "consume");
		const guard = new PosRateLimitGuard(shared);

		for (let call = 0; call < POS_RATE_LIMIT_PER_KEY; call += 1) {
			await expect(guard.canActivate(tillContext("key-1"))).resolves.toBe(true);
		}
		const refused = guard.canActivate(tillContext("key-1"));
		await expect(refused).rejects.toBeInstanceOf(PosRateLimitedError);
		await expect(refused).rejects.toMatchObject({ code: "POS_RATE_LIMITED", details: { retryAfterSeconds: POS_RATE_LIMIT_TTL_MS / MS_PER_SECOND } });
		await expect(guard.canActivate(tillContext("key-2"))).resolves.toBe(true);
		expect(consume.mock.calls.at(0)?.at(0)).toEqual({
			policyName: POS_RATE_LIMIT_POLICY,
			rule: { algorithm: "sliding-window", limit: POS_RATE_LIMIT_PER_KEY, windowMs: POS_RATE_LIMIT_TTL_MS, penalty: null },
			subject: { kind: "apiKey", id: "key-1" },
			cost: 1,
			failMode: "open",
		});
	});

	it("fails loudly on a route without the till guard before it", async () => {
		await expect(new PosRateLimitGuard(limiter()).canActivate(createHttpContext(testRequest({})))).rejects.toBeInstanceOf(TillPointMissingError);
	});
});

import { describe, expect, it } from "vitest";

import { RecordingRateLimiter } from "../../../../../test/support/recording-rate-limiter";
import { RateLimiterThrottlerStorage, throttlerPolicyName } from "../../throttling/rate-limiter-throttler.storage";
import { SECURITY_PENALTY } from "../security-penalty";

const WINDOW_MS = 60_000;
const LIMIT = 2;
const MS_PER_SECOND = 1_000;
/** A window boundary: the whole window is left. */
const WINDOW_START = WINDOW_MS * 1_000;

describe("RateLimiterThrottlerStorage", () => {
	it("answers @nestjs/throttler in whole seconds and blocks past the limit", async () => {
		const limiter = new RecordingRateLimiter((): number => WINDOW_START);
		const storage = new RateLimiterThrottlerStorage(limiter);

		expect(await storage.increment("k", WINDOW_MS, LIMIT, 0, "default")).toEqual({
			totalHits: 1,
			timeToExpire: WINDOW_MS / MS_PER_SECOND,
			isBlocked: false,
			timeToBlockExpire: 0,
		});
		await storage.increment("k", WINDOW_MS, LIMIT, 0, "default");
		expect(await storage.increment("k", WINDOW_MS, LIMIT, 0, "default")).toEqual({
			totalHits: LIMIT + 1,
			timeToExpire: WINDOW_MS / MS_PER_SECOND,
			isBlocked: true,
			timeToBlockExpire: WINDOW_MS / MS_PER_SECOND,
		});
	});

	it("gives the security throttlers the penalty and a closed fail mode, the others neither", async () => {
		const limiter = new RecordingRateLimiter();
		const storage = new RateLimiterThrottlerStorage(limiter);
		await storage.increment("a", WINDOW_MS, LIMIT, 0, "strict");
		await storage.increment("b", WINDOW_MS, LIMIT, 0, "preAuth");
		await storage.increment("c", WINDOW_MS, LIMIT, 0, "default");
		await storage.increment("d", WINDOW_MS, LIMIT, 0, "webhook");

		const asked = limiter.decisions.map(({ request }) => ({
			policy: request.policyName,
			failMode: request.failMode,
			penalty: request.rule.algorithm === "sliding-window" ? request.rule.penalty : null,
			kind: request.subject.kind,
		}));
		expect(asked).toEqual([
			{ policy: "SECURITY_ROUTES", failMode: "closed", penalty: SECURITY_PENALTY, kind: "ip" },
			{ policy: "PRE_AUTH", failMode: "closed", penalty: SECURITY_PENALTY, kind: "ip" },
			{ policy: "AUTHENTICATED_ROUTES", failMode: "open", penalty: null, kind: "principal" },
			{ policy: "WEBHOOK", failMode: "open", penalty: null, kind: "ip" },
		]);
	});
});

describe("throttlerPolicyName", () => {
	it("counts each throttler under the same SCREAMING_SNAKE policy names as every other limit", () => {
		expect(["preAuth", "strict", "default", "webhook"].map(throttlerPolicyName)).toEqual(["PRE_AUTH", "SECURITY_ROUTES", "AUTHENTICATED_ROUTES", "WEBHOOK"]);
	});
});

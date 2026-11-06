import { describe, expect, it } from "vitest";

import type { RateLimitSubject } from "../../../application/ports/rate-limiter.port";

import { RedisNamespace } from "../../redis/redis-namespace";
import { rateLimitKeyFamily } from "../rate-limit-keys";
import { CONCURRENCY_SCRIPT, SLIDING_WINDOW_SCRIPT, TOKEN_BUCKET_SCRIPT } from "../rate-limit-scripts";
import { RedisRateLimiter, type RateLimitScriptClient, type ScriptReply } from "../redis-rate-limiter";
import { SECURITY_PENALTY, SECURITY_PENALTY_STEPS_MS } from "../security-penalty";

const NAMESPACE = new RedisNamespace("test");
const SHA_HEX_LENGTH = 40;

interface ScriptCall {
	readonly via: "evalsha" | "eval";
	readonly script: string;
	readonly keys: readonly string[];
	readonly args: readonly (string | number)[];
}

/**
 * Records the calls the limiter makes and answers with a fixed reply. The scripts' behaviour itself
 * is proven against a real Redis in `e2e/rate-limiter-redis.e2e-spec.ts`; this spec proves the
 * adapter's side: which script, which keys, which arguments, and the NOSCRIPT fallback.
 */
class RecordingScriptClient implements RateLimitScriptClient {
	public readonly calls: ScriptCall[] = [];
	public readonly deleted: string[] = [];
	public readonly removed: { readonly key: string; readonly member: string }[] = [];

	public constructor(
		private readonly reply: ScriptReply,
		private readonly scriptCacheEmpty = false,
	) {}

	public evalsha(sha: string, keys: readonly string[], args: readonly (string | number)[]): Promise<ScriptReply> {
		this.calls.push({ via: "evalsha", script: sha, keys, args });
		return this.scriptCacheEmpty ? Promise.reject(new Error("NOSCRIPT No matching script. Please use EVAL.")) : Promise.resolve(this.reply);
	}

	public eval(source: string, keys: readonly string[], args: readonly (string | number)[]): Promise<ScriptReply> {
		this.calls.push({ via: "eval", script: source, keys, args });
		return Promise.resolve(this.reply);
	}

	public del(keys: readonly string[]): Promise<void> {
		this.deleted.push(...keys);
		return Promise.resolve();
	}

	public zrem(key: string, member: string): Promise<void> {
		this.removed.push({ key, member });
		return Promise.resolve();
	}
}

const subject: RateLimitSubject = { kind: "ip", id: "203.0.113.1" };

describe("rate-limit scripts", () => {
	it("are identified by their SHA-1, as EVALSHA expects", () => {
		for (const script of [SLIDING_WINDOW_SCRIPT, TOKEN_BUCKET_SCRIPT, CONCURRENCY_SCRIPT]) {
			expect(script.sha).toMatch(new RegExp(`^[0-9a-f]{${String(SHA_HEX_LENGTH)}}$`));
		}
	});
});

describe("RedisRateLimiter", () => {
	it("runs the sliding-window script on the subject's key family, passing the penalty steps", async () => {
		const client = new RecordingScriptClient([1, 4, 30_000, 0, 0]);
		const limiter = new RedisRateLimiter(client, NAMESPACE);

		const decision = await limiter.consume({
			policyName: "strict",
			rule: { algorithm: "sliding-window", limit: 5, windowMs: 60_000, penalty: SECURITY_PENALTY },
			subject,
			cost: 1,
			failMode: "closed",
		});

		expect(decision).toEqual({ allowed: true, limit: 5, remaining: 4, resetAfterMs: 30_000, retryAfterMs: 0, penalized: false });
		const keys = rateLimitKeyFamily(NAMESPACE, "strict", subject);
		expect(client.calls).toEqual([
			{
				via: "evalsha",
				script: SLIDING_WINDOW_SCRIPT.sha,
				keys: [keys.windowBase, keys.penalty, keys.strikes, keys.penaltyLevel],
				args: [
					5,
					60_000,
					1,
					"1",
					SECURITY_PENALTY.strikeThreshold,
					SECURITY_PENALTY.strikeWindowMs,
					SECURITY_PENALTY.resetAfterMs,
					SECURITY_PENALTY_STEPS_MS.length,
					...SECURITY_PENALTY_STEPS_MS,
				],
			},
		]);
	});

	it("sends the script source once when Redis has lost its script cache (NOSCRIPT)", async () => {
		const client = new RecordingScriptClient([0, 0, 500, 500], true);
		const limiter = new RedisRateLimiter(client, NAMESPACE);

		const decision = await limiter.consume({ policyName: "tenant", rule: { algorithm: "token-bucket", ratePerSecond: 2, burst: 4 }, subject, cost: 1, failMode: "open" });

		expect(decision).toMatchObject({ allowed: false, limit: 4, retryAfterMs: 500 });
		expect(client.calls.map((call: ScriptCall): string => call.via)).toEqual(["evalsha", "eval"]);
		expect(client.calls.at(-1)?.script).toBe(TOKEN_BUCKET_SCRIPT.source);
		expect(client.calls.at(-1)?.args).toEqual([500, 4, 1]);
	});

	it("acquires and releases a concurrency lease on the subject's lease set", async () => {
		const client = new RecordingScriptClient([1, 0]);
		const limiter = new RedisRateLimiter(client, NAMESPACE);

		const decision = await limiter.acquire({ policyName: "export", rule: { algorithm: "concurrency", limit: 2, leaseMs: 30_000 }, subject, failMode: "closed" });
		expect(decision.acquired).toBe(true);
		if (decision.acquired) {
			await limiter.release(decision.lease);
			expect(client.removed).toEqual([{ key: rateLimitKeyFamily(NAMESPACE, "export", subject).leases, member: decision.lease.leaseId }]);
		}
	});

	it("lifts a penalty by deleting the penalty, strike and step keys", async () => {
		const client = new RecordingScriptClient([]);
		await new RedisRateLimiter(client, NAMESPACE).liftPenalty("strict", subject);
		const keys = rateLimitKeyFamily(NAMESPACE, "strict", subject);
		expect(client.deleted).toEqual([keys.penalty, keys.strikes, keys.penaltyLevel]);
	});
});

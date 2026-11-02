import { describe, expect, it } from "vitest";

import { RedisNamespace } from "../../redis/redis-namespace";
import { rateLimitKeyFamily } from "../rate-limit-keys";

describe("rateLimitKeyFamily", () => {
	it("puts one subject's keys under one hash tag inside the namespace", () => {
		const keys = rateLimitKeyFamily(new RedisNamespace("dev"), "strict", { kind: "ip", id: "203.0.113.1" });
		const tag = "{strict:ip:203.0.113.1}";
		const all: readonly string[] = [keys.windowBase, keys.penalty, keys.strikes, keys.penaltyLevel, keys.bucket, keys.leases];
		for (const key of all) {
			expect(key.startsWith(`dev:rl:${tag}:`)).toBe(true);
		}
		expect(new Set(all).size).toBe(all.length);
	});
});

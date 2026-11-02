import { describe, expect, it } from "vitest";

import {
	describeSlidingWindow,
	describeTokenBucket,
	describeWindow,
	DuplicateRateLimitPolicyError,
	RateLimitPolicyRegistry,
	type RateLimitPolicyDescriptor,
} from "../rate-limit-policy-registry";

const LOGIN: RateLimitPolicyDescriptor = {
	name: "SECURITY_ROUTES",
	algorithm: "sliding-window",
	subject: "ip",
	limit: "3–30 per 1 min, by route",
	failMode: "closed",
	penalty: true,
};
const TENANT: RateLimitPolicyDescriptor = { name: "TENANT_TRAFFIC", algorithm: "token-bucket", subject: "tenant", limit: "50/s, burst 200", failMode: "open", penalty: false };

describe("describing limits", () => {
	it("names a window by its largest whole unit", () => {
		expect(describeWindow(30_000)).toBe("30 s");
		expect(describeWindow(60_000)).toBe("1 min");
		expect(describeWindow(600_000)).toBe("10 min");
		expect(describeWindow(3_600_000)).toBe("1 h");
		expect(describeWindow(86_400_000)).toBe("1 day");
		expect(describeWindow(604_800_000)).toBe("7 days");
	});

	it("reads a sliding window as a count per window and a bucket as a rate and a burst", () => {
		expect(describeSlidingWindow(5, 60_000)).toBe("5 per 1 min");
		expect(describeTokenBucket(50, 200)).toBe("50/s, burst 200");
	});
});

describe("RateLimitPolicyRegistry", () => {
	it("lists every registered policy by name", () => {
		const registry = new RateLimitPolicyRegistry();
		registry.register(TENANT, LOGIN);

		expect(registry.all().map((policy) => policy.name)).toEqual(["SECURITY_ROUTES", "TENANT_TRAFFIC"]);
	});

	it("refuses a second policy with the same name: names key the limiter", () => {
		const registry = new RateLimitPolicyRegistry();
		registry.register(TENANT);

		expect(() => {
			registry.register(TENANT);
		}).toThrow(DuplicateRateLimitPolicyError);
	});
});

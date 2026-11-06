import { describe, expect, it } from "vitest";

import { createTestTypedConfig } from "../../../../../e2e/support/test-api-env";
import { LoadTestTrafficKeys } from "../../throttling/load-test-traffic-keys";
import { RateLimitExemptions } from "../rate-limit-exemptions";

const ONE_MINUTE_MS = 60_000;

function exemptions(cidrs?: string): { readonly exemptions: RateLimitExemptions; readonly keys: LoadTestTrafficKeys } {
	const config = createTestTypedConfig(cidrs === undefined ? {} : { RATE_LIMIT_EXEMPT_CIDRS: cidrs });
	const keys = new LoadTestTrafficKeys(config, null);
	return { exemptions: new RateLimitExemptions(config, keys), keys };
}

describe("RateLimitExemptions", () => {
	it("exempts addresses inside RATE_LIMIT_EXEMPT_CIDRS, IPv4 and IPv6", () => {
		const { exemptions: subject } = exemptions("10.0.0.0/8, 2001:db8::/32");
		expect(subject.isExemptAddress("10.1.2.3")).toBe(true);
		expect(subject.isExemptAddress("2001:db8::7")).toBe(true);
		expect(subject.isExemptAddress("203.0.113.1")).toBe(false);
	});

	it("exempts a request carrying a live load-test key, and nothing else by default", async () => {
		const { exemptions: subject, keys } = exemptions();
		await keys.issue("run-key", ONE_MINUTE_MS);
		expect(await subject.reasonFor({ ip: "203.0.113.1", headers: { "x-load-test-key": "run-key" } })).toBe("load-test");
		expect(await subject.reasonFor({ ip: "203.0.113.1", headers: { "x-load-test-key": "stale-key" } })).toBeNull();
		expect(await subject.reasonFor({ ip: "203.0.113.1", headers: {} })).toBeNull();
	});

	it("names the exempt CIDR as the reason", async () => {
		const { exemptions: subject } = exemptions("203.0.113.0/24");
		expect(await subject.reasonFor({ ip: "203.0.113.9", headers: {} })).toBe("exempt-cidr");
	});

	it("rejects a malformed CIDR at config parse time", () => {
		expect(() => createTestTypedConfig({ RATE_LIMIT_EXEMPT_CIDRS: "10.0.0.0/99" })).toThrow();
	});
});

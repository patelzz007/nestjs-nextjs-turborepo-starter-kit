import { describe, expect, it } from "vitest";

import { resolveClientIp, throttleTrackerFor, TrustedProxies, TrustProxyEnvSchema } from "./client-ip";

const NONE = new TrustedProxies([]);
const PRIVATE = new TrustedProxies(["uniquelocal", "loopback"]);

describe("TrustProxyEnvSchema", () => {
	it("defaults to trusting nobody", () => {
		expect(TrustProxyEnvSchema.parse(undefined)).toEqual([]);
		expect(TrustProxyEnvSchema.parse("off")).toEqual([]);
	});

	it("parses IPs, CIDRs and presets", () => {
		expect(TrustProxyEnvSchema.parse("10.0.0.0/8, ::1, linklocal")).toEqual(["10.0.0.0/8", "::1", "linklocal"]);
	});

	it.each(["1", "true", "*", "10.0.0.0/33", "abc", "10.0.0.1,"])("rejects %s", (value: string) => {
		expect(TrustProxyEnvSchema.safeParse(value).success).toBe(false);
	});
});

describe("resolveClientIp", () => {
	it("is the TCP peer when no proxy is trusted, whatever the headers say", () => {
		expect(resolveClientIp("203.0.113.5", "1.2.3.4", NONE)).toBe("203.0.113.5");
	});

	it("ignores X-Forwarded-For from an UNTRUSTED peer even when proxies are configured", () => {
		expect(resolveClientIp("203.0.113.5", "1.2.3.4", PRIVATE)).toBe("203.0.113.5");
	});

	it("takes the first untrusted hop from the right behind a trusted proxy (a spoofed leftmost hop is ignored)", () => {
		expect(resolveClientIp("10.0.0.9", "6.6.6.6, 198.51.100.4", PRIVATE)).toBe("198.51.100.4");
	});

	it("walks through several trusted proxies", () => {
		expect(resolveClientIp("10.0.0.9", "198.51.100.4, 10.0.0.3, 10.0.0.2", PRIVATE)).toBe("198.51.100.4");
	});

	it("falls back to the peer without a header, and stops at a malformed hop", () => {
		expect(resolveClientIp("10.0.0.9", undefined, PRIVATE)).toBe("10.0.0.9");
		expect(resolveClientIp("10.0.0.9", "garbage", PRIVATE)).toBe("10.0.0.9");
	});

	it("matches IPv4-mapped IPv6 peers", () => {
		expect(resolveClientIp("::ffff:10.0.0.9", "198.51.100.4", PRIVATE)).toBe("198.51.100.4");
		expect(resolveClientIp(undefined, "198.51.100.4", PRIVATE)).toBeUndefined();
	});
});

describe("TrustedProxies", () => {
	it("hands Fastify the same list (false when empty)", () => {
		expect(NONE.toFastifyTrustProxy()).toBe(false);
		expect(PRIVATE.toFastifyTrustProxy()).toEqual(["uniquelocal", "loopback"]);
	});
});

describe("throttleTrackerFor", () => {
	it("uses request.ip only", () => {
		expect(throttleTrackerFor({ ip: "198.51.100.8", headers: { "x-forwarded-for": "9.9.9.9" } })).toBe("198.51.100.8");
		expect(throttleTrackerFor({})).toBe("unknown");
	});
});

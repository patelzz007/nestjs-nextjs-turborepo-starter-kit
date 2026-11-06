import { Logger } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { createTestTypedConfig } from "../../../../../e2e/support/test-api-env";
import type { RateLimitSubject } from "../../../application/ports/rate-limiter.port";
import { maskSubject, RateLimitRefusalLog } from "../rate-limit-refusal-log";

describe("maskSubject", () => {
	it("hides the last IPv4 octet and all but the start of any other id", () => {
		expect(maskSubject({ kind: "ip", id: "203.0.113.42" })).toBe("203.0.113.•");
		expect(maskSubject({ kind: "ip", id: "2001:db8::1" })).toBe("2001:db8•");
		expect(maskSubject({ kind: "principal", id: "user:0193ab12-aaaa" })).toBe("user:019•");
		expect(maskSubject({ kind: "destination", id: "9f86d081884c7d65" })).toBe("9f86d081•");
	});
});

describe("RateLimitRefusalLog without Redis", () => {
	it("logs the refusal by policy and subject kind only, never the address", async () => {
		const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation((): void => undefined);
		const log = new RateLimitRefusalLog(createTestTypedConfig(), null);

		await log.record({ policyName: "SECURITY_ROUTES", subject: { kind: "ip", id: "203.0.113.42" }, penalized: true });

		expect(warn).toHaveBeenCalledWith("rate_limit.refused policy=SECURITY_ROUTES subjectKind=ip penalized=true");
		expect(await log.recent(0, 10)).toEqual([]);
		warn.mockRestore();
	});
});

describe("RateLimitRefusalLog subject references", () => {
	it("gives one subject of one policy one opaque reference, and every other a different one", () => {
		const log = new RateLimitRefusalLog(createTestTypedConfig(), null);
		const subject: RateLimitSubject = { kind: "ip", id: "203.0.113.42" };
		const ref = log.subjectRef("SECURITY_ROUTES", subject);

		expect(ref).toMatch(/^[0-9a-f]{32}$/);
		expect(ref).not.toContain("203");
		expect(log.subjectRef("SECURITY_ROUTES", subject)).toBe(ref);
		expect(log.subjectRef("PRE_AUTH", subject)).not.toBe(ref);
		expect(log.subjectRef("SECURITY_ROUTES", { kind: "ip", id: "203.0.113.43" })).not.toBe(ref);
	});

	it("resolves nothing without Redis", async () => {
		const log = new RateLimitRefusalLog(createTestTypedConfig(), null);

		await expect(log.resolveSubject("0".repeat(32))).resolves.toBeNull();
	});
});

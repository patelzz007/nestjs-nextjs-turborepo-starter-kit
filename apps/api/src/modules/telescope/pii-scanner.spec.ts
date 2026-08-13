import { describe, expect, it } from "vitest";

import type { TelescopeJsonValue } from "@workspace/shared";

import { redactPii, redactPiiHeaders, scanPii, scanPiiHeaders } from "./pii-scanner.js";

describe("PiiScanner", () => {
	it("flags an email inside a nested JSON value", () => {
		const flags = scanPii({ user: { email: "alice@example.com" }, role: "admin" });
		expect(flags.some((flag) => flag.category === "email" && flag.count === 1)).toBe(true);
		expect(flags.some((flag) => flag.category === "phone")).toBe(false);
	});

	it("flags a JWT token", () => {
		const token = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.dGVzdA";
		const flags = scanPii({ token });
		expect(flags.some((flag) => flag.category === "jwt" && flag.count === 1)).toBe(true);
	});

	it("flags multiple SSNs in a list", () => {
		const flags = scanPii({ records: [{ ssn: "123-45-6789" }, { ssn: "987-65-4321" }] });
		expect(flags.some((flag) => flag.category === "ssn" && flag.count === 2)).toBe(true);
	});

	it("returns an empty list for a clean value", () => {
		expect(scanPii({ message: "hello world", count: 3 })).toEqual([]);
		expect(scanPii(null)).toEqual([]);
	});

	it("redacts emails, leaving non-PII intact", () => {
		const redacted: TelescopeJsonValue = redactPii({ user: "alice@example.com", keep: "hello" });
		expect(redacted).toEqual({ user: "***@redacted", keep: "hello" });
		// Scanned again, nothing left to flag.
		expect(scanPii(redacted)).toEqual([]);
	});

	it("redacts PII inside nested structures", () => {
		// The card pattern also matches the (earlier) phone rule, so the mask
		// may be either — the guarantee is that no scannable PII survives.
		const redacted: TelescopeJsonValue = redactPii({ card: { number: "4242 4242 4242 4242" } });
		expect(scanPii(redacted)).toEqual([]);
	});

	it("scans and redacts headers", () => {
		const headers: Record<string, string> = { authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.dGVzdA", "content-type": "application/json" };
		expect(scanPiiHeaders(headers).some((flag) => flag.category === "jwt")).toBe(true);
		const redacted: Record<string, string> | null = redactPiiHeaders(headers);
		expect(redacted).not.toBeNull();
		expect(redacted?.authorization).not.toContain("eyJ");
		expect(redacted?.["content-type"]).toBe("application/json");
	});

	it("handles null headers", () => {
		expect(redactPiiHeaders(null)).toBeNull();
		expect(scanPiiHeaders(null)).toEqual([]);
	});
});

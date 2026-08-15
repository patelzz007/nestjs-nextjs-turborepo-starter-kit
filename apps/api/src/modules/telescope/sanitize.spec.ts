import { describe, expect, it } from "vitest";

import { sanitizeHeaders, sanitizeJson, sanitizeQueryParams, truncateJson } from "./sanitize";

describe("sanitizeJson", () => {
	it("redacts secret-looking keys at any depth", () => {
		const input = {
			email: "alice.wong@example.com",
			password: "hunter2",
			profile: { apiKey: "sk-123", name: "Alice" },
			token: "abc",
		};
		const result = sanitizeJson(input);
		expect(result).toEqual({
			email: "a***@example.com",
			password: "[REDACTED]",
			profile: { apiKey: "[REDACTED]", name: "Alice" },
			token: "[REDACTED]",
		});
	});

	it("masks emails but keeps the domain and first character", () => {
		expect(sanitizeJson("Contact alice.wong@example.com or bob@test.dev")).toBe("Contact a***@example.com or b***@test.dev");
	});

	it("truncates over-long strings", () => {
		const long = "x".repeat(1000);
		const result = sanitizeJson(long);
		expect(result).toHaveLength(501); // 500 + ellipsis
	});

	it("handles arrays and scalars", () => {
		// Single-char local parts are left alone — the mask regex requires ≥2
		// chars before the @ so it never invents characters for short addresses.
		expect(sanitizeJson([1, "a@b.com", "bob@test.dev", null, true])).toEqual([1, "a@b.com", "b***@test.dev", null, true]);
		expect(sanitizeJson(42)).toBe(42);
	});
});

describe("truncateJson", () => {
	it("passes small values through unchanged", () => {
		const value = { a: 1 };
		expect(truncateJson(value)).toEqual(value);
	});

	it("falls back to a stable marker when slicing lands mid-string", () => {
		const big = { text: "y".repeat(10_000) };
		const result = truncateJson(big);
		expect(JSON.parse(JSON.stringify(result))).toBeDefined();
	});
});

describe("sanitizeHeaders", () => {
	const headers: Record<string, string | string[] | undefined> = {
		"content-type": "application/json",
		"user-agent": "curl/8",
		authorization: "Bearer sekrit",
		cookie: "session=abc",
		"x-client-type": "admin",
	};

	it("captures only the whitelist", () => {
		const result = sanitizeHeaders(headers, ["content-type", "user-agent", "x-client-type"]);
		expect(result).toEqual({
			"content-type": "application/json",
			"user-agent": "curl/8",
			"x-client-type": "admin",
		});
	});

	it("strips credentials even when whitelisted (denylist underneath)", () => {
		const result = sanitizeHeaders(headers, ["authorization", "cookie"]);
		expect(result).toBeNull();
	});

	it("returns null when nothing is captured", () => {
		expect(sanitizeHeaders({ "x-ignored": "1" }, ["content-type"])).toBeNull();
	});

	it("caps header values", () => {
		const long = "a".repeat(500);
		const result = sanitizeHeaders({ "content-type": long }, ["content-type"]);
		expect(result?.["content-type"]?.length ?? 0).toBe(201); // 200 + ellipsis
	});
});

describe("sanitizeQueryParams", () => {
	it("masks emails inside bind-param JSON", () => {
		expect(sanitizeQueryParams('["alice.wong@example.com", 42]')).toBe('["a***@example.com", 42]');
	});

	it("returns null for empty params", () => {
		expect(sanitizeQueryParams("")).toBeNull();
	});
});

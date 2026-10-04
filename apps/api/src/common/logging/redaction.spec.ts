import { Writable } from "node:stream";

import type { DataValue } from "@workspace/shared";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { buildPinoRedactPaths, CIRCULAR, isSensitiveFieldName, REDACTED, redactSecrets, redactUrl, SENSITIVE_FIELD_NAMES } from "./redaction";

describe("isSensitiveFieldName", () => {
	it.each(SENSITIVE_FIELD_NAMES)("treats the listed field %s as sensitive", (field: string) => {
		expect(isSensitiveFieldName(field)).toBe(true);
	});

	it("matches case-insensitively and ignores separators", () => {
		expect(isSensitiveFieldName("PASSWORD")).toBe(true);
		expect(isSensitiveFieldName("Set-Cookie")).toBe(true);
		expect(isSensitiveFieldName("set_cookie")).toBe(true);
		expect(isSensitiveFieldName("access_token")).toBe(true);
		expect(isSensitiveFieldName("X-API-KEY")).toBe(true);
		expect(isSensitiveFieldName("card_number")).toBe(true);
	});

	it("matches compound names ending in an unambiguous secret word", () => {
		expect(isSensitiveFieldName("resetToken")).toBe(true);
		expect(isSensitiveFieldName("jwtSecret")).toBe(true);
		expect(isSensitiveFieldName("stripeApiKey")).toBe(true);
		expect(isSensitiveFieldName("userPassword")).toBe(true);
		expect(isSensitiveFieldName("emailOtp")).toBe(true);
		expect(isSensitiveFieldName("terminalPairingCode")).toBe(true);
		expect(isSensitiveFieldName("pairing_code")).toBe(true);
	});

	it("does not redact ordinary fields that merely contain a secret word", () => {
		expect(isSensitiveFieldName("tokenVersion")).toBe(false);
		expect(isSensitiveFieldName("errorCode")).toBe(false);
		expect(isSensitiveFieldName("countryCode")).toBe(false);
		expect(isSensitiveFieldName("email")).toBe(false);
		expect(isSensitiveFieldName("userId")).toBe(false);
		expect(isSensitiveFieldName("")).toBe(false);
		expect(isSensitiveFieldName("---")).toBe(false);
	});
});

describe("redactSecrets", () => {
	it("returns primitives unchanged", () => {
		expect(redactSecrets("plain")).toBe("plain");
		expect(redactSecrets(42)).toBe(42);
		expect(redactSecrets(true)).toBe(true);
		expect(redactSecrets(null)).toBeNull();
	});

	it("redacts sensitive fields at the root", () => {
		expect(redactSecrets({ email: "a@example.com", password: "hunter2" })).toEqual({ email: "a@example.com", password: REDACTED });
	});

	it("redacts at any depth, including inside arrays", () => {
		const input: DataValue = {
			user: { profile: { credentials: { refreshToken: "r", note: "keep" } } },
			attempts: [{ otp: "123456", at: 1 }, [{ cvv: "999" }]],
		};

		expect(redactSecrets(input)).toEqual({
			user: { profile: { credentials: { refreshToken: REDACTED, note: "keep" } } },
			attempts: [{ otp: REDACTED, at: 1 }, [{ cvv: REDACTED }]],
		});
	});

	it("redacts a sensitive field whose value is an object or array without descending into it", () => {
		expect(redactSecrets({ recoveryCodes: ["a", "b"], card: { number: "4242" } })).toEqual({ recoveryCodes: REDACTED, card: REDACTED });
	});

	it("matches header-style names case-insensitively", () => {
		expect(redactSecrets({ headers: { Authorization: "Bearer x", "Set-Cookie": ["a=b"], "content-type": "json" } })).toEqual({
			headers: { Authorization: REDACTED, "Set-Cookie": REDACTED, "content-type": "json" },
		});
	});

	it("redacts the 2FA `code` field", () => {
		expect(redactSecrets({ code: "654321", errorCode: "VALIDATION_ERROR" })).toEqual({ code: REDACTED, errorCode: "VALIDATION_ERROR" });
	});

	it("never mutates the input", () => {
		const input = { nested: { token: "t" } };
		const snapshot: string = JSON.stringify(input);

		redactSecrets(input);

		expect(JSON.stringify(input)).toBe(snapshot);
	});

	it("replaces a reference back to an ancestor with a circular marker instead of recursing forever", () => {
		const node: { name: string; self?: DataValue; children: DataValue[] } = { name: "root", children: [] };
		node.self = node;
		node.children.push(node);

		expect(redactSecrets(node)).toEqual({ name: "root", self: CIRCULAR, children: [CIRCULAR] });
	});

	it("clones shared (non-cyclic) references normally", () => {
		const shared = { apiKey: "k", label: "shared" };

		expect(redactSecrets({ a: shared, b: shared })).toEqual({ a: { apiKey: REDACTED, label: "shared" }, b: { apiKey: REDACTED, label: "shared" } });
	});
});

describe("redactUrl", () => {
	it("leaves URLs without a query string untouched", () => {
		expect(redactUrl("/api/v1/products/1")).toBe("/api/v1/products/1");
	});

	it("redacts sensitive query parameters and keeps the rest byte-for-byte", () => {
		expect(redactUrl("/verify?token=abc&page=2&Access_Token=xyz")).toBe("/verify?token=[REDACTED]&page=2&Access_Token=[REDACTED]");
	});

	it("handles valueless and malformed-encoding parameters", () => {
		expect(redactUrl("/x?flag&password")).toBe("/x?flag&password=[REDACTED]");
		expect(redactUrl("/x?%E0%A4%A=1")).toBe("/x?%E0%A4%A=1");
	});
});

describe("buildPinoRedactPaths", () => {
	it("covers request and response headers and nested body fields", () => {
		const paths: readonly string[] = buildPinoRedactPaths();

		expect(paths).toContain("req.headers.authorization");
		expect(paths).toContain("req.headers.cookie");
		expect(paths).toContain('res.headers["set-cookie"]');
		expect(paths).toContain("password");
		expect(paths).toContain("*.*.*.password");
		expect(new Set(paths).size).toBe(paths.length);
	});

	it("is accepted by Fastify's pino logger and redacts real log lines", () => {
		const lines: string[] = [];
		const stream = new Writable({
			write(chunk: Buffer, _encoding: BufferEncoding, callback: () => void): void {
				lines.push(chunk.toString());
				callback();
			},
		});
		const server = Fastify({ logger: { level: "info", redact: { paths: buildPinoRedactPaths(), censor: REDACTED }, stream } });

		server.log.info({ password: "p0", body: { refreshToken: "r1", nested: { apiKey: "k2", keep: "ok" } }, "set-cookie": "sid=1" }, "login");

		const output: string = lines.join("");
		expect(output).not.toContain("p0");
		expect(output).not.toContain("r1");
		expect(output).not.toContain("k2");
		expect(output).not.toContain("sid=1");
		expect(output).toContain('"keep":"ok"');
	});
});

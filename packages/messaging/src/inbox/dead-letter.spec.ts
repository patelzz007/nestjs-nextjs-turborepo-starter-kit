import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { boundErrorText, captureDeadLetterPayload } from "./dead-letter";

describe("captureDeadLetterPayload", () => {
	it("keeps a value within the cap whole, with its size and SHA-256", () => {
		const value = Buffer.from("{not json", "utf8");

		expect(captureDeadLetterPayload(value, 1_024)).toEqual({ bytes: value, sizeBytes: 9, sha256: createHash("sha256").update(value).digest("hex"), truncated: false });
	});

	it("truncates an oversized value explicitly — original size and hash of the WHOLE value are kept", () => {
		const value = Buffer.alloc(5_000, 0x61);

		const payload = captureDeadLetterPayload(value, 1_024);

		expect(payload.bytes.length).toBe(1_024);
		expect(payload).toMatchObject({ sizeBytes: 5_000, truncated: true, sha256: createHash("sha256").update(value).digest("hex") });
	});

	it("is binary-safe (NUL and invalid UTF-8 bytes survive unchanged)", () => {
		const value = Buffer.from([0x00, 0xff, 0xfe, 0x7b]);

		expect(captureDeadLetterPayload(value, 1_024).bytes.equals(value)).toBe(true);
	});
});

describe("boundErrorText", () => {
	it("leaves a short message untouched", () => {
		expect(boundErrorText("boom", 100)).toBe("boom");
	});

	it("marks a cut with the original length and stays within the cap", () => {
		const bounded = boundErrorText("x".repeat(500), 100);

		expect(bounded).toHaveLength(100);
		expect(bounded).toMatch(/\[truncated: 500 chars total\]$/);
	});
});

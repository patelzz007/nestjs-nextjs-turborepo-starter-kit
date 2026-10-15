import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { AES_256_KEY_BYTES, formatGcmEnvelope, gcmDecrypt, gcmEncrypt, GcmEnvelopeError, parseGcmEnvelope } from "./aes-256-gcm";

const KEY = randomBytes(AES_256_KEY_BYTES);
const PLAINTEXT = Buffer.from("github_pat_example_secret", "utf8");
/** A stored envelope is `iv:tag:ciphertext`. */
const ENVELOPE_PARTS = 3;

describe("AES-256-GCM helpers", () => {
	it("round-trips a plaintext, with a fresh IV every time", () => {
		const first = gcmEncrypt(KEY, PLAINTEXT);
		const second = gcmEncrypt(KEY, PLAINTEXT);

		expect(gcmDecrypt(KEY, first).toString("utf8")).toBe("github_pat_example_secret");
		expect(first.iv.equals(second.iv)).toBe(false);
	});

	it("binds the ciphertext to its additional authenticated data", () => {
		const envelope = gcmEncrypt(KEY, PLAINTEXT, Buffer.from("user-1"));

		expect(gcmDecrypt(KEY, envelope, Buffer.from("user-1")).toString("utf8")).toBe("github_pat_example_secret");
		expect(() => gcmDecrypt(KEY, envelope, Buffer.from("user-2"))).toThrow(GcmEnvelopeError);
		expect(() => gcmDecrypt(KEY, envelope)).toThrow(GcmEnvelopeError);
	});

	it("refuses a tampered ciphertext or the wrong key", () => {
		const envelope = gcmEncrypt(KEY, PLAINTEXT);
		const tampered = { ...envelope, data: Buffer.from(envelope.data.map((byte: number): number => byte ^ 1)) };

		expect(() => gcmDecrypt(KEY, tampered)).toThrow(GcmEnvelopeError);
		expect(() => gcmDecrypt(randomBytes(AES_256_KEY_BYTES), envelope)).toThrow(GcmEnvelopeError);
	});

	it("stores an envelope as base64 iv:tag:ciphertext and reads it back", () => {
		const envelope = gcmEncrypt(KEY, PLAINTEXT);
		const serialized = formatGcmEnvelope(envelope);

		expect(serialized.split(":")).toHaveLength(ENVELOPE_PARTS);
		expect(gcmDecrypt(KEY, parseGcmEnvelope(serialized)).toString("utf8")).toBe("github_pat_example_secret");
	});

	it.each(["", "a:b", "a:b:c:d", "not base64!:x:y"])("refuses a malformed stored envelope %j", (serialized: string) => {
		expect(() => parseGcmEnvelope(serialized)).toThrow(GcmEnvelopeError);
	});
});

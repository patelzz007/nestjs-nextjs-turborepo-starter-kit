import { describe, expect, it } from "vitest";

import { GcmCacheCipher } from "../cache-cipher";

const KEYS = { 1: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=", 2: "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=" };

describe("GcmCacheCipher", () => {
	it("encrypts with the highest key version and decrypts its own output", () => {
		const cipher = new GcmCacheCipher(KEYS);
		const ciphertext = cipher.encrypt('{"email":"jane@example.com"}', "dev:cache:identity.me:v1:k2:u:u-1:me");

		expect(cipher.keyVersion).toBe(2);
		expect(ciphertext).not.toContain("jane");
		expect(cipher.decrypt(ciphertext, "dev:cache:identity.me:v1:k2:u:u-1:me")).toBe('{"email":"jane@example.com"}');
	});

	it("refuses a value copied under another key", () => {
		const cipher = new GcmCacheCipher(KEYS);
		const ciphertext = cipher.encrypt("secret", "dev:cache:identity.me:v1:k2:u:u-1:me");

		expect(() => cipher.decrypt(ciphertext, "dev:cache:identity.me:v1:k2:u:u-2:me")).toThrow();
	});
});

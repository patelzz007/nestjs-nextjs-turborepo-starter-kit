import { describe, expect, it } from "vitest";

import { GcmCacheCipher } from "../cache-cipher";

const KEY_V1 = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=";
const KEYS = { 1: KEY_V1, 2: "AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=" };

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

// The key-rotation rehearsal (enhancement 1.8): the cache encrypts with ONE version (the highest), and that
// version is part of every cache key, so after a rotation old entries are simply never looked up again
// (they expire by TTL). A value sealed under the old version can't be read with the new one either.
describe("GcmCacheCipher after a key rotation", () => {
	it("moves to the new version and doesn't read values sealed under the old one", () => {
		const before = new GcmCacheCipher({ 1: KEY_V1 });
		const after = new GcmCacheCipher(KEYS);
		const sealed = before.encrypt("secret", "dev:cache:x");
		expect([before.keyVersion, after.keyVersion]).toStrictEqual([1, 2]);
		expect(() => after.decrypt(sealed, "dev:cache:x")).toThrow();
	});
});

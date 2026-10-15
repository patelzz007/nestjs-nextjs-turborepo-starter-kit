import { describe, expect, it } from "vitest";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { GithubCredentialCipher, GithubPullRequestsOffError, GithubStoredTokenUnreadableError } from "./github-credential.cipher";

const TOKEN = "github_pat_11ABCDEFG0123456789_secret";
// 32 bytes of 0x04 / 0x05, base64 — TEST-ONLY key versions.
const KEY_V1 = "BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ=";
const KEY_V2 = "BQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU=";

function cipher(keys: Record<string, string> | null): GithubCredentialCipher {
	return new GithubCredentialCipher(
		createTestTypedConfig(keys === null ? { GITHUB_CREDENTIAL_ENCRYPTION_KEYS: "" } : { GITHUB_CREDENTIAL_ENCRYPTION_KEYS: JSON.stringify(keys) }),
	);
}

describe("GithubCredentialCipher", () => {
	it("is off without a key ring, and refuses to encrypt or decrypt", () => {
		const off = cipher(null);

		expect(off.isEnabled()).toBe(false);
		expect(() => off.encrypt(TOKEN, "user-1")).toThrow(GithubPullRequestsOffError);
		expect(() => off.decrypt({ ciphertext: "a:b:c", keyVersion: 1 }, "user-1")).toThrow(GithubPullRequestsOffError);
	});

	it("round-trips a token for its owner, never storing it in clear", () => {
		const ring = cipher({ 1: KEY_V1 });
		const stored = ring.encrypt(TOKEN, "user-1");

		expect(stored.ciphertext).not.toContain(TOKEN);
		expect(ring.decrypt(stored, "user-1")).toBe(TOKEN);
	});

	it("does not open a token copied onto another user's row", () => {
		const ring = cipher({ 1: KEY_V1 });

		expect(() => ring.decrypt(ring.encrypt(TOKEN, "user-1"), "user-2")).toThrow(GithubStoredTokenUnreadableError);
	});

	it("encrypts with the highest version and still opens tokens sealed under an older one", () => {
		const sealedUnderV1 = cipher({ 1: KEY_V1 }).encrypt(TOKEN, "user-1");
		const rotated = cipher({ 1: KEY_V1, 2: KEY_V2 });

		expect(rotated.encrypt(TOKEN, "user-1").keyVersion).toBe(2);
		expect(rotated.decrypt(sealedUnderV1, "user-1")).toBe(TOKEN);
	});

	it("says a token is unreadable once its key version is removed from the ring", () => {
		const sealedUnderV1 = cipher({ 1: KEY_V1 }).encrypt(TOKEN, "user-1");

		expect(() => cipher({ 2: KEY_V2 }).decrypt(sealedUnderV1, "user-1")).toThrow(GithubStoredTokenUnreadableError);
	});
});

import { describe, expect, it } from "vitest";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { CryptoService } from "./crypto.service";

const crypto = new CryptoService(createTestTypedConfig({ BCRYPT_SALT_ROUNDS: "10" }));

/** Two refresh JWTs of one user share their first 72 bytes (header + the start of `sub`) — exactly what bcrypt reads. */
const SHARED_PREFIX = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${"a".repeat(72)}`;
const OLD_TOKEN = `${SHARED_PREFIX}.old-signature`;
const NEW_TOKEN = `${SHARED_PREFIX}.new-signature`;

describe("CryptoService refresh-token digests", () => {
	it("tells apart two refresh tokens that share their first 72 bytes (bcrypt would not)", async () => {
		const digest: string = crypto.hashRefreshToken(NEW_TOKEN);

		expect(crypto.matchesRefreshToken(NEW_TOKEN, digest)).toBe(true);
		expect(crypto.matchesRefreshToken(OLD_TOKEN, digest)).toBe(false);
		// The reason refresh tokens are not bcrypt-hashed: bcrypt truncates at 72 bytes.
		expect(await crypto.compare(OLD_TOKEN, await crypto.hash(NEW_TOKEN))).toBe(true);
	});

	it("stores a lowercase hex SHA-256 digest and recognizes only that format", () => {
		const digest: string = crypto.hashRefreshToken(NEW_TOKEN);

		expect(digest).toMatch(/^[0-9a-f]{64}$/);
		expect(crypto.isRefreshTokenDigest(digest)).toBe(true);
		expect(crypto.isRefreshTokenDigest("$2b$10$abcdefghijklmnopqrstuuMmdy4.7HhNVxpgXkTc8FtWv9bc2E7bu")).toBe(false);
		expect(crypto.isRefreshTokenDigest("")).toBe(false);
	});

	it("rejects a digest of a different length without throwing", () => {
		expect(crypto.matchesRefreshToken(NEW_TOKEN, "abc")).toBe(false);
	});
});

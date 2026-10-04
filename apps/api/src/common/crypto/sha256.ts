import { createHash } from "node:crypto";

/**
 * Lowercase hex SHA-256 of a UTF-8 string — the one implementation used for
 * every stored token / code / key hash and content hash in the API (and the
 * seed, which must produce the same hashes the app verifies against).
 */
export function sha256Hex(value: string): string {
	return createHash("sha256").update(value, "utf8").digest("hex");
}

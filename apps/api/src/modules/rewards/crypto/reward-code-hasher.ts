import { createHmac } from "node:crypto";

/** Separates the key version from the digest in a stored hash: `v<version>:<hex>`. */
const VERSION_PREFIX = "v";
const VERSION_SEPARATOR = ":";

export class RewardCodeHashKeyRingEmptyError extends Error {
	public constructor() {
		super("REWARD_CODE_HASH_KEYS must contain at least one key version");
		this.name = "RewardCodeHashKeyRingEmptyError";
	}
}

/**
 * Lookup hashes for reward QR tokens and backup codes: HMAC-SHA256 under a
 * server-side, versioned key ring (`REWARD_CODE_HASH_KEYS`). A leaked database
 * alone cannot be used to test candidate codes offline — the 8-character
 * backup codes would otherwise be brute-forced from their plain SHA-256.
 *
 * Stored form: `v<version>:<hex digest>`. New codes are hashed with the
 * HIGHEST version; a lookup computes the candidate under EVERY version, so
 * adding a version (rotation) never invalidates codes already issued.
 */
export class RewardCodeHasher {
	private readonly keys: readonly (readonly [version: number, key: Buffer])[];

	public constructor(keyRing: Readonly<Record<number, string>>) {
		this.keys = Object.entries(keyRing)
			.map(([version, key]): [number, Buffer] => [Number(version), Buffer.from(key, "base64")])
			.sort((left, right) => right[0] - left[0]);
		if (this.keys.length === 0) {
			throw new RewardCodeHashKeyRingEmptyError();
		}
	}

	/** The stored hash of a newly issued code (current key version). */
	public hash(code: string): string {
		const [current] = this.keys;
		if (current === undefined) {
			throw new RewardCodeHashKeyRingEmptyError();
		}
		return this.digest(current[0], current[1], code);
	}

	/** Every stored form `code` may have, newest version first — match a column with `IN (...)`. */
	public lookupCandidates(code: string): string[] {
		return this.keys.map(([version, key]) => this.digest(version, key, code));
	}

	private digest(version: number, key: Buffer, code: string): string {
		return `${VERSION_PREFIX}${String(version)}${VERSION_SEPARATOR}${createHmac("sha256", key).update(code, "utf8").digest("hex")}`;
	}
}

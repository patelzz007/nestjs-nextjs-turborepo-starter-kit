// ============================================
// github-credential.cipher.ts - Encrypts an admin's linked GitHub token at rest
// ============================================
// AES-256-GCM under `GITHUB_CREDENTIAL_ENCRYPTION_KEYS` (a versioned key ring:
// the highest version encrypts, every version decrypts), with the owner's user
// id as additional authenticated data — a ciphertext copied onto another user's
// row does not decrypt. Stored as `iv:tag:ciphertext` plus the key version.

import { Injectable } from "@nestjs/common";
import { GITHUB_PULL_REQUEST_ERROR_CODES } from "@workspace/shared";

import { DependencyUnavailableError } from "../../../common/errors/app-error";
import { TypedConfigService } from "../../../config/typed-config.service";
import { AES_256_KEY_BYTES, formatGcmEnvelope, gcmDecrypt, gcmEncrypt, GcmEnvelopeError, parseGcmEnvelope } from "../../encryption/aes-256-gcm";

/** Error code of {@link GithubPullRequestsOffError}. */
export const GITHUB_PULL_REQUESTS_OFF_CODE = GITHUB_PULL_REQUEST_ERROR_CODES.pullRequestsOff;

/** 503 — the deployment has no `GITHUB_CREDENTIAL_ENCRYPTION_KEYS`, so no token can be stored or read. */
export class GithubPullRequestsOffError extends DependencyUnavailableError {
	public constructor() {
		super({ code: GITHUB_PULL_REQUESTS_OFF_CODE, message: "GitHub pull requests are not set up on this server." });
	}
}

/** A stored token that no configured key opens (its key version was removed, or the row was tampered with). */
export class GithubStoredTokenUnreadableError extends Error {
	public constructor(reason: string) {
		super(`The stored GitHub token cannot be decrypted: ${reason}`);
		this.name = "GithubStoredTokenUnreadableError";
	}
}

/** A token as stored: the envelope and the key version that sealed it. */
export interface EncryptedGithubToken {
	readonly ciphertext: string;
	readonly keyVersion: number;
}

/** Binds a ciphertext to its owner. */
function ownerContext(userId: string): Buffer {
	return Buffer.from(`github-credential:${userId}`, "utf8");
}

@Injectable()
export class GithubCredentialCipher {
	public constructor(private readonly config: TypedConfigService) {}

	/** Whether the deployment can store tokens at all (`GITHUB_CREDENTIAL_ENCRYPTION_KEYS` is set). */
	public isEnabled(): boolean {
		return this.config.github.credentialEncryptionKeys !== null;
	}

	public encrypt(token: string, userId: string): EncryptedGithubToken {
		const keys = this.keyRing();
		const keyVersion = Math.max(...Object.keys(keys).map(Number));
		const envelope = gcmEncrypt(this.keyOf(keys, keyVersion), Buffer.from(token, "utf8"), ownerContext(userId));
		return { ciphertext: formatGcmEnvelope(envelope), keyVersion };
	}

	/** Throws {@link GithubStoredTokenUnreadableError} when no configured key opens it for this owner. */
	public decrypt(stored: EncryptedGithubToken, userId: string): string {
		const keys = this.keyRing();
		try {
			return gcmDecrypt(this.keyOf(keys, stored.keyVersion), parseGcmEnvelope(stored.ciphertext), ownerContext(userId)).toString("utf8");
		} catch (error: unknown) {
			if (error instanceof GcmEnvelopeError || error instanceof GithubStoredTokenUnreadableError) {
				throw new GithubStoredTokenUnreadableError(error.message);
			}
			throw error;
		}
	}

	private keyRing(): Readonly<Record<number, string>> {
		const keys = this.config.github.credentialEncryptionKeys;
		if (keys === null) {
			throw new GithubPullRequestsOffError();
		}
		return keys;
	}

	private keyOf(keys: Readonly<Record<number, string>>, version: number): Buffer {
		const material = keys[version];
		if (material === undefined) {
			throw new GithubStoredTokenUnreadableError(`key version ${String(version)} is not in GITHUB_CREDENTIAL_ENCRYPTION_KEYS`);
		}
		const key = Buffer.from(material, "base64");
		if (key.length !== AES_256_KEY_BYTES) {
			// The env schema already checks every key is 32 bytes of base64 — this guards a config built another way.
			throw new GithubStoredTokenUnreadableError(`key version ${String(version)} is not ${String(AES_256_KEY_BYTES)} bytes`);
		}
		return key;
	}
}

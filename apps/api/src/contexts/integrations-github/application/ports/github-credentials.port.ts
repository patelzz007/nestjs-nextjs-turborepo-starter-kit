// The caller's own linked GitHub token (ADR 052), as the application sees it:
// the token to send and the account it belongs to. How it is sealed at rest,
// and how GitHub is asked who owns it, are adapters.

/** The caller's token, ready to send, and the login of the account it belongs to (`yours` searches its repositories). */
export interface LinkedGithubCredential {
	readonly token: string;
	readonly login: string;
}

/** A token as stored: the envelope and the key version that sealed it. */
export interface EncryptedGithubToken {
	readonly ciphertext: string;
	readonly keyVersion: number;
}

/** Seals a token to its owner (AES-256-GCM under the configured key ring). */
export interface GithubTokenCipherPort {
	/** Whether the deployment can store tokens at all. */
	isEnabled(): boolean;
	encrypt(token: string, userId: string): EncryptedGithubToken;
	/** Throws `GithubStoredTokenUnreadableError` when no configured key opens it for this owner. */
	decrypt(stored: EncryptedGithubToken, userId: string): string;
}

/** Who a token belongs to, and when GitHub expires it (`null`: never, or GitHub did not say). */
export interface GithubTokenOwner {
	readonly githubUserId: number;
	readonly login: string;
	readonly tokenExpiresAt: number | null;
}

/** Asks GitHub who a token belongs to. Throws `GithubLinkedTokenRejectedError` when GitHub refuses it. */
export interface GithubTokenOwnerPort {
	fetchTokenOwner(token: string): Promise<GithubTokenOwner>;
}

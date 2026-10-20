/**
 * Hashing and one-time secrets of credentials. The method names match the infrastructure
 * `CryptoService` that implements them (e2e tests spy on that instance).
 */
export interface CredentialCryptoPort {
	/** bcrypt hash with the configured cost. */
	hash(data: string): Promise<string>;
	compare(data: string, hash: string): Promise<boolean>;
	/** 64 hex characters of randomness (reset tokens, verification ids). */
	generateRandomToken(): string;
	/** Deterministic SHA-256 digest for indexed one-time token lookup. */
	hashTokenDigest(rawToken: string): string;
	/** The at-rest digest of a refresh-token JWT. */
	hashRefreshToken(refreshToken: string): string;
	/** Constant-time check of a presented refresh-token JWT against a stored digest. */
	matchesRefreshToken(refreshToken: string, storedDigest: string): boolean;
	/** Whether a stored refresh-token hash is a digest (rows from before digests cannot be verified safely). */
	isRefreshTokenDigest(storedHash: string): boolean;
	/** A numeric one-time code of `length` digits. */
	generateNumericCode(length: number): string;
}

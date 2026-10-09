import * as crypto from "crypto";

import { Injectable } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { z } from "zod";

import { secureEquals } from "../../../common/utils/secure-equals";
import { TypedConfigService } from "../../../config/typed-config.service";

/** A stored refresh-token digest: lowercase hex SHA-256 (what {@link CryptoService.hashRefreshToken} writes). */
const RefreshTokenDigestSchema = z.string().regex(/^[0-9a-f]{64}$/);

@Injectable()
export class CryptoService {
	private readonly saltRounds: number;

	constructor(private readonly config: TypedConfigService) {
		this.saltRounds = this.config.auth.bcryptSaltRounds;
	}

	/**
	 * Hash a value using bcrypt with the configured salt rounds.
	 */
	public async hash(data: string): Promise<string> {
		return bcrypt.hash(data, this.saltRounds);
	}

	/**
	 * Compare a plaintext value against a bcrypt hash.
	 */
	public async compare(data: string, hash: string): Promise<boolean> {
		return bcrypt.compare(data, hash);
	}

	/**
	 * Generate a cryptographically random token string (64 hex chars).
	 * Used for password reset tokens and other one-time secrets.
	 */
	public generateRandomToken(): string {
		return crypto.randomBytes(32).toString("hex");
	}

	/** Deterministic SHA-256 digest for indexed one-time token lookup. */
	public hashTokenDigest(rawToken: string): string {
		return crypto.createHash("sha256").update(rawToken).digest("hex");
	}

	/**
	 * The at-rest form of a refresh-token JWT: its SHA-256 digest — never bcrypt.
	 *
	 * bcrypt reads only the first 72 bytes of its input, and every refresh JWT of
	 * a user shares those bytes (the JOSE header plus the start of the `sub`
	 * claim). A bcrypt hash would therefore match ANY refresh token of that
	 * user, so rotation and reuse detection would silently accept an old,
	 * already-rotated token. A refresh JWT is a signed, high-entropy secret, so a
	 * fast cryptographic digest is the right at-rest form (as for reset tokens).
	 */
	public hashRefreshToken(refreshToken: string): string {
		return this.hashTokenDigest(refreshToken);
	}

	/** Constant-time check of a presented refresh-token JWT against a stored {@link hashRefreshToken} digest. */
	public matchesRefreshToken(refreshToken: string, storedDigest: string): boolean {
		return secureEquals(this.hashRefreshToken(refreshToken), storedDigest);
	}

	/**
	 * Whether a stored refresh-token hash is a {@link hashRefreshToken} digest.
	 * Rows written before the digest (bcrypt hashes) are not: they cannot be
	 * verified safely, so their session simply has to sign in again.
	 */
	public isRefreshTokenDigest(storedHash: string): boolean {
		return RefreshTokenDigestSchema.safeParse(storedHash).success;
	}

	/** Generate a numeric one-time code (e.g. login verification OTP). */
	public generateNumericCode(length: number): string {
		let result = "";
		for (let index = 0; index < length; index += 1) {
			result += crypto.randomInt(0, 10).toString();
		}
		return result;
	}
}

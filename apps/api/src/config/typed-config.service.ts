import { Injectable } from "@nestjs/common";

/**
 * Typed configuration service that reads environment variables.
 *
 * Provides strongly-typed access to all configuration values used across the app.
 * Values are read from `process.env` at runtime.
 */
@Injectable()
export class TypedConfigService {
	// ── JWT Configuration ──────────────────────────────────────────────

	/** Secret key for signing access tokens */
	public get jwtAccessSecret(): string {
		return process.env.JWT_ACCESS_SECRET ?? "access-secret-change-me";
	}

	/** Expiry duration for access tokens (e.g. "15m") */
	public get jwtAccessExpiry(): string {
		return process.env.JWT_ACCESS_EXPIRY ?? "15m";
	}

	/** Secret key for signing refresh tokens */
	public get jwtRefreshSecret(): string {
		return process.env.JWT_REFRESH_SECRET ?? "refresh-secret-change-me";
	}

	/** Expiry duration for refresh tokens (e.g. "7d") */
	public get jwtRefreshExpiry(): string {
		return process.env.JWT_REFRESH_EXPIRY ?? "7d";
	}

	/** Secret key for email verification tokens */
	public get emailVerificationSecret(): string {
		return process.env.EMAIL_VERIFICATION_SECRET ?? "email-verify-secret-change-me";
	}

	// ── Bcrypt Configuration ───────────────────────────────────────────

	/** Number of bcrypt salt rounds for password hashing */
	public get bcryptSaltRounds(): number {
		const value: string | undefined = process.env.BCRYPT_SALT_ROUNDS;
		return value ? Number.parseInt(value, 10) : 12;
	}

	// ── Resend (Email) Configuration ───────────────────────────────────

	/** Resend API key for sending transactional emails */
	public get resendApiKey(): string {
		return process.env.RESEND_API_KEY ?? "";
	}

	/** From address for outgoing emails (e.g. "noreply@example.com") */
	public get emailFromAddress(): string {
		return process.env.EMAIL_FROM_ADDRESS ?? "noreply@example.com";
	}

	// ── App Configuration ──────────────────────────────────────────────

	/** Application name (used in email templates) */
	public get appName(): string {
		return process.env.APP_NAME ?? "MyApp";
	}

	/** Public-facing application URL (used in email links) */
	public get appUrl(): string {
		return process.env.APP_URL ?? "http://localhost:3000";
	}
}

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

	/** Send mode: "send" (real Resend), "log-only" (print), or "noop" (skip). */
	public get emailMode(): "send" | "log-only" | "noop" {
		const value: string | undefined = process.env.EMAIL_MODE;
		return value === "log-only" || value === "noop" ? value : "send";
	}

	/** Dev-only override that redirects every send to a single inbox. */
	public get emailTestTo(): string | undefined {
		return process.env.EMAIL_TEST_TO;
	}

	/** Reply-to address appended to every outbound email. */
	public get emailReplyTo(): string | undefined {
		return process.env.EMAIL_REPLY_TO;
	}

	/** Max attempts per send (including the first try) — retry with backoff. */
	public get emailMaxAttempts(): number {
		const value: string | undefined = process.env.EMAIL_MAX_ATTEMPTS;
		const parsed: number = value ? Number.parseInt(value, 10) : 3;
		return parsed >= 1 && parsed <= 10 ? parsed : 3;
	}

	/** Per-send timeout in milliseconds. */
	public get emailTimeoutMs(): number {
		const value: string | undefined = process.env.EMAIL_TIMEOUT_MS;
		return value ? Number.parseInt(value, 10) : 10_000;
	}

	/** Per-recipient sends-per-minute cap; 0 disables rate limiting. */
	public get emailRateLimitPerMinute(): number {
		const value: string | undefined = process.env.EMAIL_RATE_LIMIT_PER_MINUTE;
		const parsed: number = value ? Number.parseInt(value, 10) : 0;
		return parsed >= 0 ? parsed : 0;
	}

	/** Secret used to verify Resend webhook signatures. */
	public get resendWebhookSecret(): string {
		return process.env.RESEND_WEBHOOK_SECRET ?? "";
	}

	/**
	 * Per-IP requests-per-minute cap on the public delivery-webhook endpoint;
	 * `0` disables the limiter. The endpoint is already signature-verified —
	 * this is defense-in-depth against hammering a public route.
	 */
	public get webhookRateLimitPerMinute(): number {
		const value: string | undefined = process.env.WEBHOOK_RATE_LIMIT_PER_MINUTE;
		const parsed: number = value ? Number.parseInt(value, 10) : 120;
		return parsed >= 0 ? parsed : 0;
	}

	// ── Database Backup Configuration ────────────────────────────────────

	/** Master switch — set `BACKUP_ENABLED=false` to disable the feature. */
	public get backupEnabled(): boolean {
		return process.env.BACKUP_ENABLED !== "false";
	}

	/** Directory backups are written to (created on demand). */
	public get backupDir(): string {
		return process.env.BACKUP_DIR ?? "./backups";
	}

	/** How long completed backups are kept before pruning (file + row). */
	public get backupRetentionDays(): number {
		const value: string | undefined = process.env.BACKUP_RETENTION_DAYS;
		const parsed: number = value ? Number.parseInt(value, 10) : 7;
		return parsed >= 1 && parsed <= 365 ? parsed : 7;
	}

	/** Per-user cap on backup creations (rolling hour) for regular admins. 0 disables. */
	public get backupRateLimitPerHour(): number {
		const value: string | undefined = process.env.BACKUP_RATE_LIMIT;
		const parsed: number = value ? Number.parseInt(value, 10) : 5;
		return parsed >= 0 ? parsed : 5;
	}

	/** Per-user cap on backup creations (rolling hour) for superadmins. 0 disables. */
	public get backupRateLimitSuperAdminPerHour(): number {
		const value: string | undefined = process.env.BACKUP_RATE_LIMIT_SUPERADMIN;
		const parsed: number = value ? Number.parseInt(value, 10) : 10;
		return parsed >= 0 ? parsed : 10;
	}

	/**
	 * Comma-separated tables whose ROWS are skipped (schema is kept, so a
	 * restore still creates them). Defaults to `logs,backups` — the largest
	 * tables in the system (ephemeral observability data + the backup index
	 * itself, which would otherwise double the size of every dump).
	 * `session_store`-style cache/temp tables can be added the same way.
	 */
	public get backupExcludeTables(): string[] {
		const value: string | undefined = process.env.BACKUP_EXCLUDE_TABLES;
		if (value === undefined || value.trim().length === 0) return ["logs", "backups"];
		return value
			.split(",")
			.map((table: string): string => table.trim())
			.filter((table: string): boolean => table.length > 0);
	}

	/** Secret used to sign short-lived backup download tokens. */
	public get backupDownloadSecret(): string {
		return process.env.BACKUP_DOWNLOAD_SECRET ?? "backup-download-secret-change-me";
	}

	/** Abort a new backup when free disk space drops below this (MB). */
	public get backupMinFreeMb(): number {
		const value: string | undefined = process.env.BACKUP_MIN_FREE_MB;
		const parsed: number = value ? Number.parseInt(value, 10) : 1024;
		return parsed >= 0 ? parsed : 1024;
	}

	/** How long a signed download token stays valid (minutes). */
	public get backupDownloadTtlMinutes(): number {
		const value: string | undefined = process.env.BACKUP_DOWNLOAD_TTL_MINUTES;
		const parsed: number = value ? Number.parseInt(value, 10) : 15;
		return parsed >= 1 && parsed <= 1440 ? parsed : 15;
	}

	/**
	 * Per-user cap on download-token mints (rolling 15-minute window).
	 * 0 disables the cap. The create cap alone would let a user mint
	 * unlimited signed tokens for one backup.
	 */
	public get backupDownloadRateLimit(): number {
		const value: string | undefined = process.env.BACKUP_DOWNLOAD_RATE_LIMIT;
		const parsed: number = value ? Number.parseInt(value, 10) : 10;
		return parsed >= 0 ? parsed : 10;
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

	/**
	 * Optional Telescope CLI/CI bearer token. Empty means “not configured”.
	 * Compared in AuthGuard (before JWT) and again in TelescopeAdminGuard.
	 */
	public get telescopeToken(): string {
		return process.env.TELESCOPE_TOKEN ?? "";
	}
}

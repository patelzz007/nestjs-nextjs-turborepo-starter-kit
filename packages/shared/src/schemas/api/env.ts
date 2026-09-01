import { z } from "zod";

/**
 * Environment variable schema — the single source of truth for env vars
 * across the monorepo.
 *
 * All env vars are optional here because:
 * - The API and the web apps are separate deployments; not every app
 *   needs every var.
 * - `.env` files are git-ignored, so a fresh clone has none of them set.
 *
 * Consumers (e.g. the API's main.ts, Next config) can parse their own
 * slice of `process.env` and throw on missing required vars.
 */
export const EnvSchema = z
	.object({
		// ── General ────────────────────────────────────────────────────
		NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
		APP_NAME: z.string().min(1).default("LinkHub"),
		APP_URL: z.url().optional(),
		PORT: z.coerce.number().int().positive().optional(),

		// ── CORS (apps/api) ───────────────────────────────────────────
		// Comma-separated list of allowed frontend origins, e.g.
		// "http://localhost:3000,http://localhost:3001,http://localhost:3003".
		CORS_ORIGINS: z.string().optional(),

		// ── Database (apps/api) ────────────────────────────────────────
		DATABASE_URL: z.url().optional(),

		// ── Auth / JWT (apps/api) ──────────────────────────────────────
		JWT_ACCESS_SECRET: z.string().min(1).optional(),
		JWT_ACCESS_EXPIRY: z.string().min(1).optional(),
		JWT_REFRESH_SECRET: z.string().min(1).optional(),
		JWT_REFRESH_EXPIRY: z.string().min(1).optional(),
		EMAIL_VERIFICATION_SECRET: z.string().min(1).optional(),
		BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(15).optional(),

		// ── Email (apps/api) ───────────────────────────────────────────
		RESEND_API_KEY: z.string().min(1).optional(),
		EMAIL_FROM_ADDRESS: z.email().optional(),
		// "send" sends through Resend; "log-only" prints the rendered email;
		// "noop" skips rendering entirely (fastest for local dev).
		EMAIL_MODE: z.enum(["send", "log-only", "noop"]).optional(),
		// Force every send to a single dev inbox (never used in production).
		EMAIL_TEST_TO: z.email().optional(),
		// Reply-to address for all transactional mail (e.g. support@).
		EMAIL_REPLY_TO: z.email().optional(),
		// Retry policy for transient Resend failures (429 / 5xx / timeouts).
		EMAIL_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).optional(),
		EMAIL_TIMEOUT_MS: z.coerce.number().int().min(100).optional(),
		// Per-recipient sends-per-minute cap; 0 disables rate limiting.
		EMAIL_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(0).optional(),
		// Secret used to verify Resend webhook signatures.
		RESEND_WEBHOOK_SECRET: z.string().min(1).optional(),

		// ── Frontend (apps/web, apps/admin) ────────────────────────────
		NEXT_PUBLIC_API_URL: z.url().optional(),
	})
	.strict();

export type Env = z.output<typeof EnvSchema>;

/**
 * Parse a partial env object (e.g. `process.env`) against the schema.
 * Throws with a readable message listing every invalid/missing var.
 */
export function parseEnv(env: Record<string, string | undefined>): z.output<typeof EnvSchema> {
	const parsed = EnvSchema.safeParse(env);
	if (!parsed.success) {
		const issues: string = parsed.error.issues.map((issue): string => `${issue.path.join(".")}: ${issue.message}`).join("; ");
		throw new Error(`Invalid environment variables: ${issues}`);
	}
	return parsed.data;
}

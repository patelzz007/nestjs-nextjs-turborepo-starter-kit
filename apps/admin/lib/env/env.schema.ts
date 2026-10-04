// ============================================
// lib/env/env.schema.ts - apps/admin environment contract
// ============================================
// Pure zod schemas (no `process.env` access) so they can be unit-tested in
// isolation. `env.client.ts`, `env.server.ts` and `env.runtime.ts` (the
// NEXT_RUNTIME check) are the only modules that read `process.env`; see
// docs/technical/configuration/frontend.md.

import { createPublicEnvSchema, HttpUrlEnvSchema, NextAppServerEnvSchema, OptionalIntervalMsEnvSchema } from "@workspace/shared";
import type { z } from "zod";

/** Public (browser-visible) config. Every key must be `NEXT_PUBLIC_*`. */
export const AdminClientEnvSchema = createPublicEnvSchema({
	/** Base URL of the NestJS API. */
	NEXT_PUBLIC_API_URL: HttpUrlEnvSchema,
	/** This app's own public origin (sent as `Origin` on server-side token refresh). */
	NEXT_PUBLIC_ADMIN_URL: HttpUrlEnvSchema,
	/** Consumer web app origin ("Returning to main website" link, impersonation banner). */
	NEXT_PUBLIC_WEB_URL: HttpUrlEnvSchema,
	/** Merchant portal origin (impersonation banner link). */
	NEXT_PUBLIC_MERCHANT_URL: HttpUrlEnvSchema,
	/**
	 * Session-status badge steady-poll interval (ms). Unset / `0` → no steady
	 * polling (`null`); the badge still fetches on mount and on tab return.
	 */
	NEXT_PUBLIC_SESSION_POLL_MS: OptionalIntervalMsEnvSchema,
});
export type AdminClientEnv = z.output<typeof AdminClientEnvSchema>;

/** Server-only config (never bundled for the browser). */
export const AdminServerEnvSchema = NextAppServerEnvSchema;
export type AdminServerEnv = z.output<typeof AdminServerEnvSchema>;

/** Label used in fail-fast error messages. */
export const ADMIN_ENV_SCOPE = {
	client: "apps/admin (public NEXT_PUBLIC_* config)",
	server: "apps/admin (server-only config)",
} satisfies Readonly<Record<"client" | "server", string>>;

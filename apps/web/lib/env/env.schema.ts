// ============================================
// lib/env/env.schema.ts - apps/web environment contract
// ============================================
// Pure zod schemas (no `process.env` access) so they can be unit-tested in
// isolation. `env.client.ts`, `env.server.ts` and `env.runtime.ts` (the
// NEXT_RUNTIME check) are the only modules that read `process.env`; see
// docs/technical/configuration/frontend.md.

import { createPublicEnvSchema, HttpUrlEnvSchema, NextAppServerEnvSchema } from "@workspace/shared";
import type { z } from "zod";

/** Public (browser-visible) config. Every key must be `NEXT_PUBLIC_*`. */
export const WebClientEnvSchema = createPublicEnvSchema({
	/** Base URL of the NestJS API. */
	NEXT_PUBLIC_API_URL: HttpUrlEnvSchema,
	/** This app's own public origin (sent as `Origin` on server-side token refresh). */
	NEXT_PUBLIC_APP_URL: HttpUrlEnvSchema,
});
export type WebClientEnv = z.output<typeof WebClientEnvSchema>;

/** Server-only config (never bundled for the browser). */
export const WebServerEnvSchema = NextAppServerEnvSchema;
export type WebServerEnv = z.output<typeof WebServerEnvSchema>;

/** Label used in fail-fast error messages. */
export const WEB_ENV_SCOPE = {
	client: "apps/web (public NEXT_PUBLIC_* config)",
	server: "apps/web (server-only config)",
} satisfies Readonly<Record<"client" | "server", string>>;

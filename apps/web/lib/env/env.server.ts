// ============================================
// lib/env/env.server.ts - apps/web server-only config
// ============================================
// `server-only` turns any import from a Client Component into a build error,
// so these values can never be bundled for the browser. They are read at
// RUNTIME by the server process (not inlined at build time), which lets one
// build be promoted across environments. Parsed once at module load and
// eagerly at server start by `instrumentation.ts`, so a bad value stops the
// server before it accepts traffic.

import "server-only";

import { parseEnvOrThrow } from "@workspace/shared";
import type { z } from "zod";

import { WEB_ENV_SCOPE, WebServerEnvSchema, type WebServerEnv } from "./env.schema";

export const serverEnv: Readonly<WebServerEnv> = parseEnvOrThrow(
	WebServerEnvSchema,
	{
		NODE_ENV: process.env.NODE_ENV,
		COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
	} satisfies Record<keyof z.input<typeof WebServerEnvSchema>, string | undefined>,
	WEB_ENV_SCOPE.server,
);

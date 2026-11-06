// ============================================
// lib/env/env.server.ts - apps/merchant server-only config
// ============================================
// `server-only` turns any import from a Client Component into a build error,
// so these values can never be bundled for the browser. They are read at
// RUNTIME by the server process (not inlined at build time), which lets one
// build be promoted across environments. Parsed once at module load and
// eagerly at server start by `instrumentation.ts`, so a bad value stops the
// server before it accepts traffic.

import "server-only";

import { parseAppEnv } from "@workspace/client/lib/env/parse-app-env";

import { MERCHANT_ENV_SCOPE, MerchantServerEnvSchema, type MerchantServerEnv } from "./env.schema";

export const serverEnv: Readonly<MerchantServerEnv> = parseAppEnv(
	MerchantServerEnvSchema,
	{
		NODE_ENV: process.env.NODE_ENV,
		COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
	},
	MERCHANT_ENV_SCOPE.server,
);

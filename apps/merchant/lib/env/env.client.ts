// ============================================
// lib/env/env.client.ts - apps/merchant public config (browser-safe)
// ============================================
// Next.js inlines `NEXT_PUBLIC_*` values into the bundle at BUILD time, and
// only when each one is written as a literal `process.env.NEXT_PUBLIC_X`
// member access — a dynamic lookup (`process.env[name]`, destructuring) is
// left untouched and reads `undefined` in the browser. So every variable is
// listed literally below, then parsed once at module load: a missing or
// malformed value fails the build / server start with a named error instead
// of surfacing later as a broken request.
//
// Import this module anywhere (server or client). Everything in it is public.

import { parseEnvOrThrow } from "@workspace/shared";
import type { z } from "zod";

import { MERCHANT_ENV_SCOPE, MerchantClientEnvSchema, type MerchantClientEnv } from "./env.schema";

export const clientEnv: Readonly<MerchantClientEnv> = parseEnvOrThrow(
	MerchantClientEnvSchema,
	{
		NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
		NEXT_PUBLIC_MERCHANT_URL: process.env.NEXT_PUBLIC_MERCHANT_URL,
	} satisfies Record<keyof z.input<typeof MerchantClientEnvSchema>, string | undefined>,
	MERCHANT_ENV_SCOPE.client,
);

// ============================================
// e2e/browser-env.e2e.ts - environment of the merchant browser (Playwright) suite
// ============================================
// The only browser-test file that reads `process.env` (docs/technical/configuration/frontend.md). The suite
// drives a RUNNING merchant build against a seeded API, signed in as a seeded store owner, so every value is
// required — running it without them fails fast instead of silently passing.

import { HttpUrlEnvSchema, parseEnvOrThrow } from "@workspace/shared";
import { z } from "zod";

const MerchantBrowserE2eEnvSchema = z.strictObject({
	/** Origin of a running merchant build. */
	MERCHANT_E2E_BASE_URL: HttpUrlEnvSchema,
	/** A seeded store owner (`apps/api/prisma/seed/users.ts`). */
	MERCHANT_E2E_EMAIL: z.email(),
	MERCHANT_E2E_PASSWORD: z.string().min(1),
	/** The seeded store the owner runs (its slug in `/t/<slug>`). */
	MERCHANT_E2E_TENANT_SLUG: z.string().min(1),
	/** The local Mailpit the API delivers to (the emailed sign-in code on a new device). */
	MERCHANT_E2E_MAILPIT_URL: HttpUrlEnvSchema.default("http://localhost:8025"),
});

export const merchantBrowserE2eEnv: Readonly<z.output<typeof MerchantBrowserE2eEnvSchema>> = parseEnvOrThrow(
	MerchantBrowserE2eEnvSchema,
	{
		MERCHANT_E2E_BASE_URL: process.env.MERCHANT_E2E_BASE_URL,
		MERCHANT_E2E_EMAIL: process.env.MERCHANT_E2E_EMAIL,
		MERCHANT_E2E_PASSWORD: process.env.MERCHANT_E2E_PASSWORD,
		MERCHANT_E2E_TENANT_SLUG: process.env.MERCHANT_E2E_TENANT_SLUG,
		MERCHANT_E2E_MAILPIT_URL: process.env.MERCHANT_E2E_MAILPIT_URL,
	} satisfies Record<keyof z.input<typeof MerchantBrowserE2eEnvSchema>, string | undefined>,
	"apps/merchant browser e2e",
);

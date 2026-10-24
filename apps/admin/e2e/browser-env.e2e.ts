// ============================================
// e2e/browser-env.e2e.ts - environment of the browser (Playwright) suite
// ============================================
// The only browser-test file that reads `process.env` (docs/technical/configuration/frontend.md).
// The suite drives a RUNNING admin build against a seeded API, signing in as a
// seeded platform admin, so every value is required — running it without them
// fails fast instead of silently passing.

import { HttpUrlEnvSchema, parseEnvOrThrow } from "@workspace/shared";
import { z } from "zod";

const AdminBrowserE2eEnvSchema = z.strictObject({
	/** Origin of a running admin build. */
	ADMIN_E2E_BASE_URL: HttpUrlEnvSchema,
	/** A seeded account that may open `/users` — the platform super admin (`apps/api/prisma/seed/users.ts`). */
	ADMIN_E2E_EMAIL: z.email(),
	ADMIN_E2E_PASSWORD: z.string().min(1),
	/**
	 * The local Mailpit inbox the API delivers to (`EMAIL_PROVIDER=mailpit`): a sign-in from a device the
	 * API does not recognise yet asks for the emailed code, which the suite reads from there.
	 */
	ADMIN_E2E_MAILPIT_URL: HttpUrlEnvSchema.default("http://localhost:8025"),
});

export const adminBrowserE2eEnv: Readonly<z.output<typeof AdminBrowserE2eEnvSchema>> = parseEnvOrThrow(
	AdminBrowserE2eEnvSchema,
	{
		ADMIN_E2E_BASE_URL: process.env.ADMIN_E2E_BASE_URL,
		ADMIN_E2E_EMAIL: process.env.ADMIN_E2E_EMAIL,
		ADMIN_E2E_PASSWORD: process.env.ADMIN_E2E_PASSWORD,
		ADMIN_E2E_MAILPIT_URL: process.env.ADMIN_E2E_MAILPIT_URL,
	} satisfies Record<keyof z.input<typeof AdminBrowserE2eEnvSchema>, string | undefined>,
	"apps/admin browser e2e",
);

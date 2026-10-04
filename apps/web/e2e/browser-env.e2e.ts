// ============================================
// e2e/browser-env.e2e.ts - environment of the browser (Playwright) suite
// ============================================
// The only browser-test file that reads `process.env` (docs/technical/configuration/frontend.md).
// The suite drives a RUNNING web build, so its address is required — running
// the suite without it fails fast instead of silently passing.

import { HttpUrlEnvSchema, parseEnvOrThrow } from "@workspace/shared";
import { z } from "zod";

const WebBrowserE2eEnvSchema = z.strictObject({
	/** Origin of a running web build (`pnpm --filter @workspace/web build && … start`), backed by a seeded API. */
	WEB_E2E_BASE_URL: HttpUrlEnvSchema,
});

export const webBrowserE2eEnv: Readonly<z.output<typeof WebBrowserE2eEnvSchema>> = parseEnvOrThrow(
	WebBrowserE2eEnvSchema,
	{ WEB_E2E_BASE_URL: process.env.WEB_E2E_BASE_URL } satisfies Record<keyof z.input<typeof WebBrowserE2eEnvSchema>, string | undefined>,
	"apps/web browser e2e",
);

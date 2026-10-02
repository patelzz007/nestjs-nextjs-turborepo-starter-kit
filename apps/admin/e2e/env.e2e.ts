// ============================================
// e2e/env.e2e.ts - opt-in switch for the full-stack smoke suite
// ============================================
// The e2e harness's own env module (see docs/configuration.md): the only e2e
// file that reads `process.env`. Unset → the smoke suite is skipped; set →
// it must be an absolute http(s) URL of a running admin build.

import { HttpUrlEnvSchema, parseEnvOrThrow } from "@workspace/shared";
import { z } from "zod";

const AdminE2eEnvSchema = z.strictObject({
	ADMIN_E2E_BASE_URL: HttpUrlEnvSchema.optional(),
});

export const e2eEnv: Readonly<z.output<typeof AdminE2eEnvSchema>> = parseEnvOrThrow(
	AdminE2eEnvSchema,
	{ ADMIN_E2E_BASE_URL: process.env.ADMIN_E2E_BASE_URL } satisfies Record<keyof z.input<typeof AdminE2eEnvSchema>, string | undefined>,
	"apps/admin e2e smoke",
);

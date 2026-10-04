// ============================================
// lib/auth/demo-accounts.ts - which demo logins the web login page offers
// ============================================
// Demo logins are offered in development and never otherwise, decided on the
// server per request by the shared policy (no flag exists to turn them on).
// The account list is imported lazily and only inside the development branch,
// so a production server never reads it; `server-only` keeps it out of every
// client bundle (verified against the built `.next/static`).

import "server-only";

import { resolveDemoAccounts } from "@workspace/client/lib/auth/forms/demo-accounts-policy";
import type { DemoAccount } from "@workspace/client/lib/auth/forms/login-form";

import { serverEnv } from "@/lib/env/env.server";

/** The demo logins to offer: the seeded accounts in development, none otherwise. */
export function loadWebDemoAccounts(): Promise<readonly DemoAccount[]> {
	return resolveDemoAccounts(serverEnv.NODE_ENV, async (): Promise<readonly DemoAccount[]> => (await import("./demo-account-list")).WEB_DEMO_ACCOUNTS);
}

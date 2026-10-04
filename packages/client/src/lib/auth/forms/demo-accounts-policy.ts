// ============================================
// lib/auth/forms/demo-accounts-policy.ts - when demo logins are offered
// ============================================
// One policy for every app's login page: the seeded one-click demo accounts are
// offered in development and never anywhere else. There is deliberately no flag
// to turn them on, so a production deploy cannot expose them by configuration.
// Pure and framework-free; each app passes its parsed `NODE_ENV` and a loader
// for its (server-only) account list.

import { NodeEnvSchema, type NodeEnv } from "@workspace/shared";

import type { DemoAccount } from "./login-form-types";

/** The only runtime environment that offers demo accounts. */
export const DEMO_ACCOUNTS_ENVIRONMENT: NodeEnv = NodeEnvSchema.enum.development;

/** Whether the demo accounts may be offered when the app runs as `nodeEnv`. */
export function areDemoAccountsVisible(nodeEnv: NodeEnv): boolean {
	return nodeEnv === DEMO_ACCOUNTS_ENVIRONMENT;
}

/**
 * The demo accounts to hand to the login form: the loader's list in
 * development, an empty list otherwise. The loader is not called outside
 * development, so the list is never even read in production.
 */
export function resolveDemoAccounts(nodeEnv: NodeEnv, load: () => Promise<readonly DemoAccount[]>): Promise<readonly DemoAccount[]> {
	return areDemoAccountsVisible(nodeEnv) ? load() : Promise.resolve([]);
}

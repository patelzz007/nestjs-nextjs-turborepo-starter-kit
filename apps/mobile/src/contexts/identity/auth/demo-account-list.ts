// ============================================
// demo-account-list.ts — the seeded logins the sign-in screen offers in development
// ============================================
// The API's seed accounts (apps/api/prisma/seed), one per role worth trying on
// the phone. NEVER import this file directly: only `loadDemoAccounts`
// (demo-accounts.ts) does, inside an `if (__DEV__)` branch, which Metro removes
// from a production bundle together with this module — so these passwords never
// ship in a store build (ADR 042).

import type { DemoAccount } from "./demo-accounts";

/** The seeded logins offered on the sign-in screen of a development build. */
export const MOBILE_DEMO_ACCOUNTS: readonly DemoAccount[] = [
	{ label: "Super Admin", email: "superadmin@example.com", password: "SuperAdmin@123" },
	{ label: "Admin", email: "admin@example.com", password: "Admin@123" },
	{ label: "Manager", email: "manager@example.com", password: "Manager@123" },
	{ label: "KL Owner", email: "brew.owner@kl-rewards.demo", password: "BrewOwner@123" },
	{ label: "Melaka Owner", email: "jonker.owner@melaka-rewards.demo", password: "JonkerOwner@123" },
	{ label: "KL Cashier", email: "brew.cashier@kl-rewards.demo", password: "BrewCashier@123" },
];

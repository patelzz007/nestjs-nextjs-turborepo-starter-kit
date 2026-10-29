// ============================================
// demo-account-list.ts — the seeded logins the sign-in screen offers
// ============================================
// The API's seed accounts (apps/api/prisma/seed), one per role worth trying on
// the phone. NEVER import this file directly: only `loadBundledDemoAccounts`
// (lib/env.ts) does, inside a branch Metro removes from a release bundle that
// was not built with `EXPO_PUBLIC_SHOW_DEMO_ACCOUNT=true` — together with this
// module, so these passwords never ship in a store build (ADR 042). It lives in
// lib/ because env.ts, the one file that may read the flag, imports it.

/** A one-tap seeded login: the button's label and the credentials it signs in with. */
export interface DemoAccount {
	readonly label: string;
	readonly email: string;
	readonly password: string;
}

/** The seeded logins offered on the sign-in screen of a development or demo build. */
export const MOBILE_DEMO_ACCOUNTS: readonly DemoAccount[] = [
	{ label: "Super Admin", email: "superadmin@example.com", password: "SuperAdmin@123" },
	{ label: "Admin", email: "admin@example.com", password: "Admin@123" },
	{ label: "Manager", email: "manager@example.com", password: "Manager@123" },
	{ label: "KL Owner", email: "brew.owner@kl-rewards.demo", password: "BrewOwner@123" },
	{ label: "Melaka Owner", email: "jonker.owner@melaka-rewards.demo", password: "JonkerOwner@123" },
	{ label: "KL Cashier", email: "brew.cashier@kl-rewards.demo", password: "BrewCashier@123" },
];

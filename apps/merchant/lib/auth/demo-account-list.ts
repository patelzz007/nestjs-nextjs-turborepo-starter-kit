// ============================================
// lib/auth/demo-account-list.ts - seeded merchant demo logins (server-only)
// ============================================
// The credentials of the accounts `prisma db seed` creates (apps/api/prisma/
// seed), offered as one-click logins in development only. `server-only` makes
// importing this from a Client Component a build error, and `demo-accounts.ts`
// loads it behind the shared development-only policy, so the passwords are
// never part of a browser bundle or a production build.

import "server-only";

import type { DemoAccount } from "@workspace/client/lib/auth/forms/login-form";

/** The seeded logins offered on the the merchant portal login page. */
export const MERCHANT_DEMO_ACCOUNTS: readonly DemoAccount[] = [
	{ label: "Super Admin", email: "superadmin@example.com", password: "SuperAdmin@123" },
	{ label: "KL Owner", email: "brew.owner@kl-rewards.demo", password: "BrewOwner@123" },
	{ label: "Melaka Owner", email: "jonker.owner@melaka-rewards.demo", password: "JonkerOwner@123" },
	{ label: "KL Cashier", email: "brew.cashier@kl-rewards.demo", password: "BrewCashier@123" },
];

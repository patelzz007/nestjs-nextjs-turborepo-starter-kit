// ============================================
// lib/auth/demo-account-list.ts - seeded web demo logins (server-only)
// ============================================
// The credentials of the accounts `prisma db seed` creates (apps/api/prisma/
// seed), offered as one-click logins in development only. `server-only` makes
// importing this from a Client Component a build error, and `demo-accounts.ts`
// loads it behind the shared development-only policy, so the passwords are
// never part of a browser bundle or a production build.

import "server-only";

import type { DemoAccount } from "@workspace/client/lib/auth/forms/login-form";

/** The seeded logins offered on the the consumer web app login page. */
export const WEB_DEMO_ACCOUNTS: readonly DemoAccount[] = [
	{ label: "Super Admin", email: "superadmin@example.com", password: "SuperAdmin@123" },
	{ label: "Admin", email: "admin@example.com", password: "Admin@123" },
	{ label: "Manager", email: "manager@example.com", password: "Manager@123" },
	{ label: "User", email: "user@example.com", password: "User@123" },
];

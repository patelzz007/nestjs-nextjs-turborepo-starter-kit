// ── Full-stack smoke (opt-in) ────────────────────────────────────────────
// Verifies the admin app's proxy + SSR against a RUNNING instance. Skipped by
// default — enable by pointing ADMIN_E2E_BASE_URL at a started build:
//
//   cd apps/admin && pnpm build && pnpm start   # terminal 1 (also run the API)
//   ADMIN_E2E_BASE_URL=http://localhost:3001 pnpm --filter @workspace/admin exec vitest run e2e
import { describe, expect, it } from "vitest";

import { e2eEnv } from "./env.e2e";

// Opt-in env (see e2e/README.md), validated by ./env.e2e.ts.
const BASE_URL: string | undefined = e2eEnv.ADMIN_E2E_BASE_URL;

/** Status Next.js answers a proxy `NextResponse.redirect()` with. */
const TEMPORARY_REDIRECT_STATUS = 307;
const OK_STATUS = 200;

describe.skipIf(!BASE_URL)("admin e2e smoke", () => {
	// Only reached when BASE_URL is set (skipIf above) — collapse the union.
	const url: string = BASE_URL ?? "";

	it("server-renders the login page", async (): Promise<void> => {
		const response = await fetch(`${url}/auth/login`);
		expect(response.status).toBe(OK_STATUS);
		// The page and its client components are server-rendered, so the
		// heading is in the initial HTML.
		const html = await response.text();
		expect(html).toContain("Admin Login");
		expect(html).toContain("Sign in with your administrator credentials");
	});

	it("redirects an unauthenticated / to /auth/login with the return path", async (): Promise<void> => {
		// Node's fetch (undici) returns the real 3xx response for `redirect: "manual"`
		// (only browsers turn it into an opaque response), so the proxy's
		// status and Location header are asserted directly.
		const response = await fetch(`${url}/`, { redirect: "manual" });
		expect(response.status).toBe(TEMPORARY_REDIRECT_STATUS);
		const location = new URL(response.headers.get("location") ?? "", url);
		expect(`${location.pathname}${location.search}`).toBe("/auth/login?redirect=%2F");
	});

	it("redirects an unauthenticated visitor on an unknown route to login instead of revealing whether it exists", async (): Promise<void> => {
		// Every non-auth path is a panel route to the proxy, so a guest never
		// reaches the 404 page — it is only rendered for signed-in admins.
		const response = await fetch(`${url}/this-route-does-not-exist`, { redirect: "manual" });
		expect(response.status).toBe(TEMPORARY_REDIRECT_STATUS);
		expect(response.headers.get("location")).toContain("/auth/login?redirect=%2Fthis-route-does-not-exist");
	});

	it("never follows an off-origin ?redirect= from the login page", async (): Promise<void> => {
		const response = await fetch(`${url}/auth/login?redirect=${encodeURIComponent("/\\evil.com")}`);
		expect(response.status).toBe(OK_STATUS);
		expect(await response.text()).not.toContain("evil.com");
	});
});

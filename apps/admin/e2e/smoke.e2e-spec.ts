// ── Full-stack smoke (opt-in) ────────────────────────────────────────────
// Verifies the admin app's proxy + SSR against a RUNNING instance. Skipped by
// default — enable by pointing ADMIN_E2E_BASE_URL at a started build:
//
//   cd apps/admin && pnpm build && pnpm start   # terminal 1 (also run the API)
//   ADMIN_E2E_BASE_URL=http://localhost:3001 pnpm --filter @workspace/admin exec vitest run e2e
import { describe, expect, it } from "vitest";

// eslint-disable-next-line turbo/no-undeclared-env-vars -- opt-in env; see e2e/README.md
const BASE_URL: string | undefined = process.env.ADMIN_E2E_BASE_URL;

describe.skipIf(!BASE_URL)("admin e2e smoke", () => {
	// Only reached when BASE_URL is set (skipIf above) — collapse the union.
	const url: string = BASE_URL ?? "";

	it("serves the login page (SSR shell)", async (): Promise<void> => {
		const response = await fetch(`${url}/auth/login`);
		expect(response.status).toBe(200);
		// The form itself is client-rendered behind a Suspense boundary, so
		// assert on the server-rendered shell (Next.js bootstrap marker).
		const html = await response.text();
		expect(html).toContain("__next");
	});

	it("redirects an unauthenticated / to /auth/login", async (): Promise<void> => {
		// undici's `redirect: "manual"` returns an opaque response (status 0, no
		// headers), so we follow the redirect and assert on the final URL instead.
		const response = await fetch(`${url}/`, { redirect: "follow" });
		expect(response.status).toBe(200);
		expect(response.url).toContain("/auth/login");
	});

	it("404s gracefully on unknown routes", async (): Promise<void> => {
		const response = await fetch(`${url}/this-route-does-not-exist`, { redirect: "manual" });
		expect(response.status).toBe(404);
	});
});

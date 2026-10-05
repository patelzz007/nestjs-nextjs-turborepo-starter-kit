// ============================================
// lib/navigation/legacy-redirects.ts - permanent redirects for renamed pages
// ============================================
// The admin URLs were reorganised domain-first (docs/technical/frontend/routing.md). Bookmarks,
// shared links and already-sent emails still point at the old paths, so each
// renamed page answers its old URL with a 308 to the new one (query string
// preserved by Next.js). Loaded by next.config.ts, which runs outside the app
// bundle — so this module imports nothing; `legacy-redirects.test.ts` checks
// every destination against `ROUTES` so the two cannot drift.

/** One `next.config` redirect from a renamed page to its current URL. */
export interface LegacyRouteRedirect {
	readonly source: string;
	readonly destination: string;
	readonly permanent: true;
}

function moved(source: string, destination: string): LegacyRouteRedirect {
	return { source, destination, permanent: true };
}

/** Old path → current path. More specific sources come first (Next.js applies the first match). */
export const LEGACY_ROUTE_REDIRECTS: readonly LegacyRouteRedirect[] = [
	moved("/analytics/sales", "/analytics"),
	moved("/settings/security/mfa-recovery", "/users/mfa-recovery"),
	moved("/settings/security", "/account/security"),
	moved("/users/all", "/users"),
	moved("/rewardhub/users", "/users"),
	moved("/rewardhub/merchants", "/merchants"),
	moved("/rewardhub/invites", "/merchants/invites"),
	moved("/rewardhub/kyb", "/merchants/verification"),
	moved("/rewardhub/locations", "/merchants/store-requests"),
	moved("/rewardhub/pending", "/rewards/review"),
	moved("/email-log", "/emails/log"),
	moved("/admin/email-template", "/emails/templates"),
	moved("/geo", "/geography"),
	moved("/product/create", "/catalog/products/new"),
	moved("/product/:id/edit", "/catalog/products/:id/edit"),
	moved("/product/:id", "/catalog/products/:id"),
	moved("/product", "/catalog/products"),
	moved("/sample-category/create", "/catalog/categories/new"),
	moved("/sample-category/:id/edit", "/catalog/categories/:id/edit"),
	moved("/sample-category/:id", "/catalog/categories/:id"),
	moved("/sample-category", "/catalog/categories"),
];

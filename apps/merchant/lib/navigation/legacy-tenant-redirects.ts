/** One `next.config.ts` redirect rule (the shape Next.js `redirects()` returns). */
export interface RedirectRule {
	readonly source: string;
	readonly destination: string;
	readonly permanent: boolean;
}

/**
 * The merchant app's tenant URLs moved from `/orgs/[orgSlug]` to `/t/[tenantSlug]`
 * (multi-tenancy plan MT-07). Old bookmarks, email links and `?redirect=` targets keep
 * working: every `/orgs/<slug>` path, and everything below it, redirects permanently to
 * the same path under `/t/<slug>`. Next.js answers a permanent redirect with 308, which,
 * unlike 301, keeps the request method.
 */
export const LEGACY_TENANT_REDIRECTS: readonly RedirectRule[] = [{ source: "/orgs/:tenantSlug/:path*", destination: "/t/:tenantSlug/:path*", permanent: true }];

import { describe, expect, it } from "vitest";

import { LEGACY_ROUTE_REDIRECTS } from "@/lib/navigation/legacy-redirects";
import { ROUTE_PATTERNS, ROUTES } from "@/lib/routes";

/** `/catalog/products/:id/edit` (next.config notation) → `/catalog/products/[id]/edit` (App Router notation). */
function toAppRouterPattern(destination: string): string {
	return destination.replace(/:([a-z]+)/g, "[$1]");
}

const CURRENT_PATHS: ReadonlySet<string> = new Set<string>([
	ROUTES.analytics.index,
	ROUTES.users.list,
	ROUTES.users.mfaRecovery,
	ROUTES.account.security,
	ROUTES.merchants.list,
	ROUTES.merchants.invites,
	ROUTES.merchants.verification,
	ROUTES.merchants.storeRequests,
	ROUTES.rewards.review,
	ROUTES.emails.log,
	ROUTES.emails.templates,
	ROUTES.geography.index,
	ROUTES.catalog.products.list,
	ROUTES.catalog.products.create,
	ROUTES.catalog.categories.list,
	ROUTES.catalog.categories.create,
	ROUTE_PATTERNS.catalog.products.detail,
	ROUTE_PATTERNS.catalog.products.edit,
	ROUTE_PATTERNS.catalog.categories.detail,
	ROUTE_PATTERNS.catalog.categories.edit,
]);

describe("LEGACY_ROUTE_REDIRECTS", () => {
	it("points every old URL at a current page", () => {
		for (const redirect of LEGACY_ROUTE_REDIRECTS) {
			expect(CURRENT_PATHS.has(toAppRouterPattern(redirect.destination)), redirect.source).toBe(true);
		}
	});

	it("never redirects a current page", () => {
		for (const redirect of LEGACY_ROUTE_REDIRECTS) {
			expect(CURRENT_PATHS.has(toAppRouterPattern(redirect.source)), redirect.source).toBe(false);
		}
	});

	it("lists a more specific source before any source that is its prefix", () => {
		const sources = LEGACY_ROUTE_REDIRECTS.map((redirect) => redirect.source);
		sources.forEach((source, index) => {
			const laterMoreSpecific = sources.slice(index + 1).filter((later) => later.startsWith(`${source}/`));
			expect(laterMoreSpecific, source).toEqual([]);
		});
	});
});

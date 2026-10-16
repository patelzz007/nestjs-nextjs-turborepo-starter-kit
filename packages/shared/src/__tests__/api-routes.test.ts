import { describe, expect, it } from "vitest";
import { z } from "zod";

import { isStringPrimitive } from "./lib/runtime-narrowing";

import { apiRoutes, type RouteTree } from "./api-routes";

// ── apiRoutes shape ────────────────────────────────────────────────────────

const REQUIRED_ROUTE_GROUPS: readonly string[] = ["auth", "email", "geo"];

/** Every leaf path in the tree, flattened depth-first. */
function collectLeaves(node: RouteTree): string[] {
	if (isStringPrimitive(node)) {
		return [node];
	}
	return Object.values(node).flatMap((child: RouteTree) => collectLeaves(child));
}

describe("apiRoutes", () => {
	it("has all top-level groups", () => {
		// The registry grows with the product; assert the core groups are
		// present rather than freezing the full key list.
		const groups: readonly string[] = Object.keys(apiRoutes);
		for (const required of REQUIRED_ROUTE_GROUPS) {
			expect(groups).toContain(required);
		}
	});

	it("static routes are plain strings", () => {
		expect(z.string().safeParse(apiRoutes.geo.countries).success).toBe(true);
		expect(apiRoutes.geo.countries).toBe("/geo/countries");
	});

	it("every leaf is a non-empty absolute path", () => {
		for (const leaf of collectLeaves(apiRoutes)) {
			expect(leaf).toMatch(/^\/\S+$/);
		}
	});

	it("parameterized routes are path templates with :param placeholders", () => {
		expect(apiRoutes.geo.countryDetail).toBe("/geo/countries/:id");
		expect(apiRoutes.organizations.reviewAccessRequest).toBe("/orgs/:orgSlug/access-requests/:requestId/review");
	});
});

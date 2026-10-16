import { describe, expect, it } from "vitest";
import { LIST_SLOT_INDEX } from "@workspace/shared";

import { resolveAdminTrail, withAccessibleLinks } from "@/lib/navigation/breadcrumb";

describe("resolveAdminTrail", () => {
	it("resolves a top-level menu item to a single current-page crumb", () => {
		const trail = resolveAdminTrail("/analytics");
		expect(trail.map((crumb) => crumb.label)).toEqual(["Analytics"]);
		expect(trail[LIST_SLOT_INDEX.first]?.href).toBeUndefined();
	});

	it("resolves a nested route as parent crumb + current page", () => {
		const trail = resolveAdminTrail("/merchants/verification");
		expect(trail.map((crumb) => crumb.label)).toEqual(["Merchants", "Verification"]);
		expect(trail.map((crumb) => crumb.href)).toEqual(["/merchants", undefined]);
	});

	it("prepends the section title for multi-item content sections", () => {
		// Platform is a multi-item section (not the Main catch-all) — its title
		// becomes an unlinked context root, and the section parent stays a link.
		const trail = resolveAdminTrail("/catalog/products");
		expect(trail.map((crumb) => crumb.label)).toEqual(["Platform", "Catalog", "Products"]);
		expect(trail.map((crumb) => crumb.href)).toEqual([undefined, "/catalog", undefined]);
	});

	it("does not prepend the Main section title (it would duplicate context)", () => {
		const trail = resolveAdminTrail("/emails/log");
		expect(trail.map((crumb) => crumb.label)).toEqual(["Emails", "Log"]);
		expect(trail.map((crumb) => crumb.href)).toEqual(["/emails", undefined]);
	});

	it("resolves a deep nested route through every ancestor", () => {
		const trail = resolveAdminTrail("/catalog/products/42/edit");
		expect(trail.map((crumb) => crumb.label)).toEqual(["Platform", "Catalog", "Products", "42", "Edit"]);
		expect(trail.at(-1)?.href).toBeUndefined();
		// Every menu ancestor is linked; the section title and the dynamic tail are not.
		expect(trail.map((crumb) => crumb.href)).toEqual([undefined, "/catalog", "/catalog/products", undefined, undefined]);
	});

	it("treats the dashboard root as a current-page Overview crumb (no self link)", () => {
		const trail = resolveAdminTrail("/");
		expect(trail.map((crumb) => crumb.label)).toEqual(["Overview"]);
		expect(trail[LIST_SLOT_INDEX.first]?.href).toBeUndefined();
	});

	it("resolves platform resources from the sidebar menu", () => {
		const trail = resolveAdminTrail("/catalog/products");
		expect(trail.map((crumb) => crumb.label)).toEqual(["Platform", "Catalog", "Products"]);
		expect(trail.map((crumb) => crumb.href)).toEqual([undefined, "/catalog", undefined]);
	});

	it("anchors detail pages on their nested resource entry (Catalog → Products stays in the trail)", () => {
		const detail = resolveAdminTrail("/catalog/products/42");
		expect(detail.map((crumb) => crumb.label)).toEqual(["Platform", "Catalog", "Products", "42"]);
		expect(detail.map((crumb) => crumb.href)).toEqual([undefined, "/catalog", "/catalog/products", undefined]);

		const edit = resolveAdminTrail("/catalog/products/42/edit");
		expect(edit.map((crumb) => crumb.label)).toEqual(["Platform", "Catalog", "Products", "42", "Edit"]);
		expect(edit.map((crumb) => crumb.href)).toEqual([undefined, "/catalog", "/catalog/products", undefined, undefined]);
	});

	it("resolves the personal account pages from the bottom items", () => {
		const trail = resolveAdminTrail("/account/security");
		expect(trail.map((crumb) => crumb.label)).toEqual(["Account", "Security"]);
		expect(trail.map((crumb) => crumb.href)).toEqual(["/account", undefined]);
	});

	it("falls back to a linked Overview crumb for unknown routes", () => {
		const trail = resolveAdminTrail("/unknown/route");
		expect(trail.map((crumb) => crumb.label)).toEqual(["Overview"]);
		expect(trail[LIST_SLOT_INDEX.first]?.href).toBe("/");
	});

	it("handles a trailing slash on a known route", () => {
		const trail = resolveAdminTrail("/settings/access/");
		expect(trail.map((crumb) => crumb.label)).toEqual(["Platform", "Settings", "Access control"]);
	});

	it("does not let a prefix match a similar-but-different route (/users vs /users-x)", () => {
		const trail = resolveAdminTrail("/users-x");
		// No menu item starts with `/users-x` — falls back to Overview.
		expect(trail.map((crumb) => crumb.label)).toEqual(["Overview"]);
		expect(trail[LIST_SLOT_INDEX.first]?.href).toBe("/");
	});

	it("renders unknown dynamic segments as humanized current-page crumbs", () => {
		const trail = resolveAdminTrail("/users/123");
		expect(trail.map((crumb) => crumb.label)).toEqual(["Users", "123"]);
		expect(trail.map((crumb) => crumb.href)).toEqual(["/users", undefined]);
	});

	it("gives every crumb an icon (mandatory)", () => {
		const paths: readonly string[] = [
			"/",
			"/analytics",
			"/settings/access",
			"/users/mfa-recovery",
			"/users/123",
			"/catalog/products/42/edit",
			"/account/security",
			"/unknown/route",
		];
		for (const pathname of paths) {
			for (const crumb of resolveAdminTrail(pathname)) {
				expect(crumb.icon, `${pathname} → ${crumb.label}`).toBeDefined();
			}
		}
	});
});

describe("withAccessibleLinks", () => {
	it("keeps every crumb but unlinks the ones the session may not open", () => {
		const trail = resolveAdminTrail("/catalog/products/42/edit");
		const linked = withAccessibleLinks(trail, (href: string): boolean => href !== "/catalog/products");

		expect(linked.map((crumb) => crumb.label)).toEqual(trail.map((crumb) => crumb.label));
		expect(linked.map((crumb) => crumb.href)).toEqual([undefined, "/catalog", undefined, undefined, undefined]);
	});
});

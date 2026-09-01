import { describe, expect, it } from "vitest";

import { resolveAdminTrail } from "@/lib/navigation/breadcrumb";

describe("resolveAdminTrail", () => {
	it("resolves a top-level menu item to a single current-page crumb", () => {
		const trail = resolveAdminTrail("/analytics");
		expect(trail.map((crumb) => crumb.label)).toEqual(["Analytics"]);
		expect(trail[0]?.href).toBeUndefined();
	});

	it("resolves a nested route as parent crumb + current page", () => {
		const trail = resolveAdminTrail("/settings/general");
		expect(trail.map((crumb) => crumb.label)).toEqual(["Settings", "General"]);
		expect(trail.map((crumb) => crumb.href)).toEqual(["/settings", undefined]);
	});

	it("prepends the section title for multi-item content sections", () => {
		// Documents is a multi-item section (not the Main catch-all) — its title
		// becomes a context root, and the item itself stays a link to its page.
		const trail = resolveAdminTrail("/documents/alpha");
		expect(trail.map((crumb) => crumb.label)).toEqual(["Documents", "Project Alpha"]);
		expect(trail.map((crumb) => crumb.href)).toEqual([undefined, "/documents/alpha"]);
	});

	it("does not prepend the Main section title (it would duplicate context)", () => {
		const trail = resolveAdminTrail("/users/roles");
		expect(trail.map((crumb) => crumb.label)).toEqual(["Users", "Roles"]);
		expect(trail.map((crumb) => crumb.href)).toEqual(["/users/all", undefined]);
	});

	it("resolves a deep nested route through every ancestor", () => {
		const trail = resolveAdminTrail("/analytics/reports/marketing/campaigns");
		expect(trail.map((crumb) => crumb.label)).toEqual(["Analytics", "Reports", "Marketing", "Campaigns"]);
		expect(trail.at(-1)?.href).toBeUndefined();
		// Every ancestor except the last is linked.
		for (const [index, crumb] of trail.entries()) {
			if (index < trail.length - 1) {
				expect(crumb.href, crumb.label).toBeDefined();
			}
		}
	});

	it("treats the dashboard root as a current-page Overview crumb (no self link)", () => {
		const trail = resolveAdminTrail("/");
		expect(trail.map((crumb) => crumb.label)).toEqual(["Overview"]);
		expect(trail[0]?.href).toBeUndefined();
	});

	it("falls back to a linked Overview crumb for unknown routes", () => {
		const trail = resolveAdminTrail("/unknown/route");
		expect(trail.map((crumb) => crumb.label)).toEqual(["Overview"]);
		expect(trail[0]?.href).toBe("/");
	});

	it("handles a trailing slash on a known route", () => {
		const trail = resolveAdminTrail("/settings/general/");
		expect(trail.map((crumb) => crumb.label)).toEqual(["Settings", "General"]);
	});

	it("does not let a prefix match a similar-but-different route (/users vs /users-x)", () => {
		const trail = resolveAdminTrail("/users-x");
		// No menu item starts with `/users-x` — falls back to Overview.
		expect(trail.map((crumb) => crumb.label)).toEqual(["Overview"]);
		expect(trail[0]?.href).toBe("/");
	});

	it("renders unknown dynamic segments as humanized current-page crumbs", () => {
		const trail = resolveAdminTrail("/users/123");
		expect(trail.map((crumb) => crumb.label)).toEqual(["Users", "123"]);
		expect(trail.map((crumb) => crumb.href)).toEqual(["/users/all", undefined]);
	});

	it("gives every crumb an icon (mandatory)", () => {
		const paths: readonly string[] = ["/", "/analytics", "/settings/general", "/documents/alpha", "/users/roles", "/users/123", "/unknown/route"];
		for (const pathname of paths) {
			for (const crumb of resolveAdminTrail(pathname)) {
				expect(crumb.icon, `${pathname} → ${crumb.label}`).toBeDefined();
			}
		}
	});
});

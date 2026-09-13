import { describe, expect, it } from "vitest";

import { identitySidebarResolveHref, withResolvedSidebarMenuUrls } from "./resolve-menu-hrefs";

describe("resolve-menu-hrefs", () => {
	it("identity resolver leaves menu URLs unchanged", () => {
		expect(identitySidebarResolveHref("/rewards")).toBe("/rewards");
	});

	it("maps menu URLs through a custom resolver for active-state matching", () => {
		const resolveHref = (menuUrl: string): string => (menuUrl === "/" ? "/tenant/dashboard" : `/tenant${menuUrl}`);

		const resolved = withResolvedSidebarMenuUrls(
			{
				sections: [
					{
						title: "Overview",
						items: [
							{
								id: "dashboard",
								title: "Dashboard",
								url: "/",
							},
							{
								id: "rewards",
								title: "Rewards",
								url: "/rewards",
								children: [{ id: "rewards-new", title: "Create", url: "/rewards/new" }],
							},
						],
					},
				],
				bottomItems: [],
			},
			resolveHref,
		);

		expect(resolved.sections[0]?.items[0]?.url).toBe("/tenant/dashboard");
		expect(resolved.sections[0]?.items[1]?.url).toBe("/tenant/rewards");
		expect(resolved.sections[0]?.items[1]?.children?.[0]?.url).toBe("/tenant/rewards/new");
	});
});

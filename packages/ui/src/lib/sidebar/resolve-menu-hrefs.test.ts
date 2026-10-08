import { describe, expect, it } from "vitest";
import { LIST_SLOT_INDEX } from "@workspace/shared";

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

		expect(resolved.sections[LIST_SLOT_INDEX.first]?.items[LIST_SLOT_INDEX.first]?.url).toBe("/tenant/dashboard");
		expect(resolved.sections[LIST_SLOT_INDEX.first]?.items[LIST_SLOT_INDEX.second]?.url).toBe("/tenant/rewards");
		expect(resolved.sections[LIST_SLOT_INDEX.first]?.items[LIST_SLOT_INDEX.second]?.children?.[LIST_SLOT_INDEX.first]?.url).toBe("/tenant/rewards/new");
	});
});

import { describe, expect, it } from "vitest";

import { PERMISSION } from "../../../authorization/permission";
import { applyMenuAuthorization } from "../apply-menu-authorization";
import type { SidebarAuthorization, SidebarMenuData } from "../sidebar-menu-schema";

const SERVERS: SidebarAuthorization = { permissions: [PERMISSION.SERVER_METRIC.LIST] };

const MENU: SidebarMenuData = {
	header: { title: "App", subtitle: "Menu" },
	sections: [
		{
			title: "Operations",
			labelKey: "operations",
			items: [{ title: "Ops", labelKey: "ops", url: "/ops", children: [{ title: "Servers", labelKey: "servers", url: "/ops/servers" }] }],
		},
	],
	bottomItems: [{ title: "Servers", labelKey: "servers", url: "/ops/servers" }],
};

describe("applyMenuAuthorization", () => {
	it("gives every item whose URL is listed its requirement, at any depth and in the bottom items", () => {
		const applied = applyMenuAuthorization(MENU, new Map([["/ops/servers", SERVERS]]));

		expect(applied.sections.at(0)?.items.at(0)?.children?.at(0)?.authorization).toEqual(SERVERS);
		expect(applied.bottomItems.at(0)?.authorization).toEqual(SERVERS);
	});

	it("leaves an unlisted item as it was", () => {
		const applied = applyMenuAuthorization(MENU, new Map());

		expect(applied.sections.at(0)?.items.at(0)?.authorization).toBeUndefined();
	});
});

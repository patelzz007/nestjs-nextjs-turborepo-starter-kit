import { FileText, Home, Wallet, type LucideIcon } from "lucide-react";
import { describe, expect, it } from "vitest";

import { resolveSidebarMenuTrail, withTrailTailLabel, type SidebarMenuTrailData } from "../resolve-sidebar-menu-trail";

// The trail logic is the shared resolver's (@workspace/shared, menu-trail.test.ts); this covers the web's icons.
const MENU: SidebarMenuTrailData = {
	sections: [{ title: "Wallet", items: [{ title: "My Wallet", url: "/wallet", icon: "Wallet" }] }],
	bottomItems: [],
};

function resolveIcon(name: string | undefined): LucideIcon {
	return name === "Wallet" ? Wallet : FileText;
}

describe("the web's breadcrumb trail", () => {
	it("gives menu crumbs their menu icon, and a page below the menu a document", () => {
		const trail = resolveSidebarMenuTrail({ menu: MENU, pathname: "/wallet/claim-1", resolveIcon, rootCurrentLabel: "Home", rootIcon: Home, unknownFallbackLabel: "Home" });
		expect(trail.map((crumb) => crumb.icon)).toEqual([Wallet, FileText]);
	});

	it("renames the final crumb, and starts a document crumb for an empty trail", () => {
		expect(withTrailTailLabel([], "Free coffee")).toEqual([{ label: "Free coffee", icon: FileText }]);
	});
});

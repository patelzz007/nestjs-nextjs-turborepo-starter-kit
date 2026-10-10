import { DRAWER_GROUPS, DRAWER_TABS, isTabRoot, type DrawerDestination, type DrawerDestinationGroup } from "./drawer-destinations";

function labelsOf(destinations: readonly DrawerDestination[]): readonly string[] {
	return destinations.map((destination: DrawerDestination): string => destination.label);
}

function routesOf(destinations: readonly DrawerDestination[]): readonly string[] {
	return destinations.map((destination: DrawerDestination): string => destination.route);
}

describe("DRAWER_TABS", () => {
	it("are the four tabs, switched to rather than pushed", () => {
		expect(labelsOf(DRAWER_TABS)).toStrictEqual(["Home", "Search", "Profile", "Settings"]);
		expect(routesOf(DRAWER_TABS)).toStrictEqual(["/", "/search", "/profile", "/settings"]);
		expect(DRAWER_TABS.every((destination: DrawerDestination): boolean => destination.isTab)).toBe(true);
	});
});

describe("DRAWER_GROUPS", () => {
	it("groups the screens under Settings into Account and Preferences, pushed onto the stack", () => {
		const [account, preferences] = DRAWER_GROUPS;

		expect(DRAWER_GROUPS).toHaveLength(2);
		expect(account?.title).toBe("Account");
		expect(account?.tone).toBe("blue");
		expect(routesOf(account?.destinations ?? [])).toStrictEqual(["/settings/security", "/settings/devices"]);
		expect(preferences?.title).toBe("Preferences");
		expect(preferences?.tone).toBe("purple");
		expect(routesOf(preferences?.destinations ?? [])).toStrictEqual(["/settings/appearance", "/settings/app-lock"]);
		expect(
			DRAWER_GROUPS.flatMap((group: DrawerDestinationGroup): readonly DrawerDestination[] => group.destinations).some(
				(destination: DrawerDestination): boolean => destination.isTab,
			),
		).toBe(false);
	});

	it("never links the two-factor enrollment flow directly", () => {
		const routes = DRAWER_GROUPS.flatMap((group: DrawerDestinationGroup): readonly string[] => routesOf(group.destinations));

		expect(routes).not.toContain("/settings/two-factor");
	});
});

describe("isTabRoot", () => {
	it("is true on a tab's first screen, where the edge swipe opens the drawer", () => {
		expect(isTabRoot("/")).toBe(true);
		expect(isTabRoot("/settings")).toBe(true);
	});

	it("is false deeper in a tab, where the edge swipe means back", () => {
		expect(isTabRoot("/settings/security")).toBe(false);
		expect(isTabRoot("/sign-in")).toBe(false);
	});
});

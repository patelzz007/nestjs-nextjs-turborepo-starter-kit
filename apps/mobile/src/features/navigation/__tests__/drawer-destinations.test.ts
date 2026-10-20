import {
	DEVELOPER_DRAWER_GROUP,
	DRAWER_GROUPS,
	DRAWER_TABS,
	drawerGroups,
	GITHUB_DRAWER_GROUP,
	isTabRoot,
	type DrawerDestination,
	type DrawerDestinationGroup,
} from "../drawer-destinations";
import { setDevelopmentBuild } from "../../../../test/development-build";

function labelsOf(destinations: readonly DrawerDestination[]): readonly string[] {
	return destinations.map((destination: DrawerDestination): string => destination.label);
}

function routesOf(destinations: readonly DrawerDestination[]): readonly string[] {
	return destinations.map((destination: DrawerDestination): string => destination.route);
}

describe("DRAWER_TABS", () => {
	it("are the five tabs, switched to rather than pushed", () => {
		expect(labelsOf(DRAWER_TABS)).toStrictEqual(["Home", "Analytics", "Search", "Profile", "Settings"]);
		expect(routesOf(DRAWER_TABS)).toStrictEqual(["/", "/analytics", "/search", "/profile", "/settings"]);
		expect(DRAWER_TABS.every((destination: DrawerDestination): boolean => destination.isTab)).toBe(true);
	});
});

describe("DRAWER_GROUPS", () => {
	it("groups the screens under Settings into Account, Preferences, Rewards and Documents, pushed onto the stack", () => {
		const [account, preferences, rewards, documents] = DRAWER_GROUPS;

		expect(DRAWER_GROUPS).toHaveLength(4);
		expect(account?.title).toBe("Account");
		expect(account?.tone).toBe("blue");
		expect(routesOf(account?.destinations ?? [])).toStrictEqual(["/settings/security", "/settings/devices"]);
		expect(preferences?.title).toBe("Preferences");
		expect(preferences?.tone).toBe("purple");
		expect(routesOf(preferences?.destinations ?? [])).toStrictEqual(["/settings/appearance", "/settings/app-lock"]);
		expect(rewards?.title).toBe("Rewards");
		expect(rewards?.tone).toBe("green");
		expect(routesOf(rewards?.destinations ?? [])).toStrictEqual(["/settings/till"]);
		expect(documents?.title).toBe("Documents");
		expect(documents?.tone).toBe("blue");
		expect(routesOf(documents?.destinations ?? [])).toStrictEqual(["/settings/pdf-viewer"]);
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

describe("drawerGroups", () => {
	const developmentBuild: boolean = __DEV__;

	afterEach(() => {
		setDevelopmentBuild(developmentBuild);
	});

	it("adds the UI kit gallery (Developer) in a development build, then GitHub for people allowed to use it", () => {
		setDevelopmentBuild(true);

		expect(drawerGroups(true)).toStrictEqual([...DRAWER_GROUPS, DEVELOPER_DRAWER_GROUP, GITHUB_DRAWER_GROUP]);
		expect(drawerGroups(false)).toStrictEqual([...DRAWER_GROUPS, DEVELOPER_DRAWER_GROUP]);
		expect(DEVELOPER_DRAWER_GROUP.title).toBe("Developer");
		expect(DEVELOPER_DRAWER_GROUP.tone).toBe("amber");
		expect(routesOf(DEVELOPER_DRAWER_GROUP.destinations)).toStrictEqual(["/settings/components"]);
	});

	it("never lists the gallery in a store build", () => {
		setDevelopmentBuild(false);

		expect(drawerGroups(true)).toStrictEqual([...DRAWER_GROUPS, GITHUB_DRAWER_GROUP]);
		expect(drawerGroups(false)).toStrictEqual(DRAWER_GROUPS);
	});
});

describe("isTabRoot", () => {
	it("is true on a tab's first screen, where the edge swipe opens the drawer", () => {
		expect(isTabRoot("/")).toBe(true);
		expect(isTabRoot("/settings")).toBe(true);
		expect(isTabRoot("/analytics")).toBe(true);
	});

	it("is false deeper in a tab, where the edge swipe means back", () => {
		expect(isTabRoot("/settings/security")).toBe(false);
		expect(isTabRoot("/sign-in")).toBe(false);
	});
});

import HouseIcon from "lucide-react-native/icons/house";
import ShieldCheckIcon from "lucide-react-native/icons/shield-check";

import { PERMISSION, type CapabilitySlug, type SidebarMenuData, type SidebarMenuItem } from "@workspace/shared";
import { APP_TABS } from "../app-tabs";
import {
	compileDrawerMenu,
	destinationsOf,
	drawerGroupsFor,
	drawerHeadingOf,
	enabledDrawerFeatureFlags,
	holdsScreen,
	isTabRoot,
	MAX_DRAWER_DEPTH,
	type DrawerAccess,
	type DrawerGroup,
	type DrawerNode,
	type DrawerScreen,
} from "../drawer-destinations";
import { NAVIGATION_LABELS } from "../navigation-labels";

const EN = NAVIGATION_LABELS.en;

const GITHUB_READ = PERMISSION.GITHUB_PULL_REQUEST.READ;
const GITHUB_UPDATE = PERMISSION.GITHUB_PULL_REQUEST.UPDATE;
const SERVERS = PERMISSION.SERVER_METRIC.LIST;

const EVERYTHING: DrawerAccess = { capabilities: [GITHUB_READ, GITHUB_UPDATE, SERVERS], enabledFeatureFlags: ["developer-tools", "github-pull-requests"] };

function accessWith(capabilities: readonly CapabilitySlug[], enabledFeatureFlags: DrawerAccess["enabledFeatureFlags"] = []): DrawerAccess {
	return { capabilities, enabledFeatureFlags };
}

/** Each group's title in English ("tabs" for the untitled block) with the routes it opens. */
function outline(groups: readonly DrawerGroup[]): readonly (readonly [string, readonly string[]])[] {
	return groups.map((group: DrawerGroup): readonly [string, readonly string[]] => [
		group.heading === null ? "tabs" : EN.sections[group.heading.section],
		destinationsOf(group.nodes).map((screen: DrawerScreen): string => screen.route),
	]);
}

describe("the drawer's menu (mobile-drawer-items.json)", () => {
	it("leads with the five tabs, untitled, in the tab bar's order and with its glyphs, switched to rather than pushed", () => {
		const [tabs] = drawerGroupsFor(accessWith([]));
		const screens = destinationsOf(tabs?.nodes ?? []);

		expect(tabs?.heading).toBeNull();
		expect(screens.map((screen: DrawerScreen): string => screen.route)).toStrictEqual(APP_TABS.map((tab) => tab.route));
		expect(screens.map((screen: DrawerScreen) => screen.icon)).toStrictEqual(APP_TABS.map((tab) => tab.icon));
		expect(screens.every((screen: DrawerScreen): boolean => screen.isTab)).toBe(true);
		expect(screens.at(0)?.icon).toBe(HouseIcon);
	});

	it("shows everyone Account, Preferences, Rewards and Documents, pushed onto the stack; nothing gated without its capability", () => {
		expect(outline(drawerGroupsFor(accessWith([])))).toStrictEqual([
			["tabs", ["/", "/analytics", "/search", "/profile", "/settings"]],
			["Account", ["/settings/security", "/settings/devices"]],
			["Preferences", ["/settings/notification-settings", "/settings/appearance", "/settings/language", "/settings/app-lock"]],
			["Rewards", ["/settings/till"]],
			["Documents", ["/settings/pdf-viewer"]],
		]);
	});

	it("gives each titled section its tone", () => {
		const tones = drawerGroupsFor(EVERYTHING).map((group: DrawerGroup) => group.heading?.tone ?? null);

		expect(tones).toStrictEqual([null, "blue", "purple", "green", "blue", "amber", "teal", "rose"]);
	});

	it("adds Developer, GitHub and Operations for a session holding their capabilities with their flags on", () => {
		const titles = outline(drawerGroupsFor(EVERYTHING)).slice(-3);

		expect(titles).toStrictEqual([
			["Developer", ["/settings/components"]],
			["GitHub", ["/profile/pull-requests", "/profile/github-account"]],
			["Operations", ["/settings/servers"]],
		]);
	});

	it("needs READ for the pull requests and READ and UPDATE together for the token", () => {
		const readOnly = outline(drawerGroupsFor(accessWith([GITHUB_READ], ["github-pull-requests"])));

		expect(readOnly).toContainEqual(["GitHub", ["/profile/pull-requests"]]);
	});

	it("hides GitHub while the server has pull requests off, whatever the capabilities", () => {
		const titles = outline(drawerGroupsFor(accessWith([GITHUB_READ, GITHUB_UPDATE]))).map(([title]) => title);

		expect(titles).not.toContain("GitHub");
	});

	it("lists the gallery (Developer) only with the developer tools on", () => {
		expect(outline(drawerGroupsFor(accessWith([], ["developer-tools"]))).map(([title]) => title)).toContain("Developer");
		expect(outline(drawerGroupsFor(accessWith([]))).map(([title]) => title)).not.toContain("Developer");
	});

	it("shows Operations only to a session that may list the servers", () => {
		expect(outline(drawerGroupsFor(accessWith([SERVERS]))).at(-1)).toStrictEqual(["Operations", ["/settings/servers"]]);
	});

	it("never links the two-factor enrollment flow directly", () => {
		const routes = drawerGroupsFor(EVERYTHING).flatMap((group: DrawerGroup) => destinationsOf(group.nodes).map((screen: DrawerScreen): string => screen.route));

		expect(routes).not.toContain("/settings/two-factor");
	});
});

/** A menu of one section holding `items`, around the real menu's shape. */
function menuOf(items: readonly SidebarMenuItem[]): SidebarMenuData {
	return { header: { title: "App", subtitle: "Menu" }, sections: [{ title: "Account", labelKey: "account", color: "blue", items: [...items] }], bottomItems: [] };
}

/** A chain of `levels` branches down to Security, each the only child of the one above. */
function chainOf(levels: number): SidebarMenuItem {
	const leaf: SidebarMenuItem = { title: "Security", labelKey: "security", url: "/settings/security", icon: "ShieldCheck" };
	return Array.from({ length: levels - 1 }).reduce<SidebarMenuItem>(
		(child: SidebarMenuItem, _unused, position: number): SidebarMenuItem => ({
			title: `Level ${String(levels - 1 - position)}`,
			labelKey: "level",
			url: "",
			icon: "Settings",
			children: [child],
		}),
		leaf,
	);
}

/** The node path from a group's first entry down its first children. */
function depthOf(node: DrawerNode | undefined): number {
	return node === undefined ? 0 : 1 + (node.kind === "branch" ? depthOf(node.children.at(0)) : 0);
}

describe("nesting", () => {
	it("nests the shipped menu's Developer gallery the full six levels deep", () => {
		const developer = drawerGroupsFor(EVERYTHING).find((group: DrawerGroup): boolean => group.heading?.section === "developer");

		expect(depthOf(developer?.nodes.at(0))).toBe(MAX_DRAWER_DEPTH);
	});

	it(`folds branches up to ${String(MAX_DRAWER_DEPTH)} levels deep, the screen at the bottom`, () => {
		const [group] = drawerGroupsFor(accessWith([]), compileDrawerMenu(menuOf([chainOf(MAX_DRAWER_DEPTH)])));
		const top = group?.nodes.at(0);

		expect(depthOf(top)).toBe(MAX_DRAWER_DEPTH);
		expect(destinationsOf(group?.nodes ?? []).map((screen: DrawerScreen) => screen.icon)).toStrictEqual([ShieldCheckIcon]);
	});

	it("refuses a menu nested deeper, when it loads", () => {
		expect(() => compileDrawerMenu(menuOf([chainOf(MAX_DRAWER_DEPTH + 1)]))).toThrow(/nests up to 6/u);
	});

	it("keeps a branch only while a screen under it is visible, filtering every level by its capabilities", () => {
		const gated: SidebarMenuItem = {
			title: "Ops",
			labelKey: "ops",
			url: "",
			icon: "Server",
			children: [
				{ title: "Deeper", labelKey: "deeper", url: "", icon: "Server", children: [{ title: "Servers", labelKey: "servers", url: "/settings/servers", icon: "Server" }] },
			],
		};
		const menu = compileDrawerMenu(menuOf([gated]));

		expect(drawerGroupsFor(accessWith([]), menu)).toStrictEqual([]);
		expect(destinationsOf(drawerGroupsFor(accessWith([SERVERS]), menu).at(0)?.nodes ?? []).map((screen: DrawerScreen): string => screen.route)).toStrictEqual([
			"/settings/servers",
		]);
	});

	it("knows which branches hold the screen on show", () => {
		const [group] = drawerGroupsFor(accessWith([]), compileDrawerMenu(menuOf([chainOf(3)])));
		const top = group?.nodes.at(0);

		expect(top === undefined ? false : holdsScreen(top, "/settings/security")).toBe(true);
		expect(top === undefined ? true : holdsScreen(top, "/settings/devices")).toBe(false);
	});
});

describe("checks made when the menu loads", () => {
	it.each([
		["a route the app does not have", [{ title: "Nowhere", labelKey: "nowhere", url: "/settings/nowhere", icon: "Settings" }]],
		["an icon the app does not bundle", [{ title: "Security", labelKey: "security", url: "/settings/security", icon: "Rocket" }]],
		["no icon", [{ title: "Security", labelKey: "security", url: "/settings/security" }]],
		["an unknown feature flag", [{ title: "Security", labelKey: "security", url: "/settings/security", icon: "ShieldCheck", featureFlag: "beta" }]],
		["a branch with no children", [{ title: "Empty", labelKey: "empty", url: "", icon: "Settings" }]],
		["a screen with children", [{ title: "Security", labelKey: "security", url: "/settings/security", icon: "ShieldCheck", children: [chainOf(1)] }]],
	])("refuses %s", (_case: string, items: readonly SidebarMenuItem[]) => {
		expect(() => compileDrawerMenu(menuOf(items))).toThrow();
	});

	it("refuses an unknown section, and a titled section without a colour", () => {
		const unknown: SidebarMenuData = { ...menuOf([chainOf(1)]), sections: [{ title: "Misc", labelKey: "misc", color: "blue", items: [chainOf(1)] }] };
		const colourless: SidebarMenuData = { ...menuOf([chainOf(1)]), sections: [{ title: "Account", labelKey: "account", items: [chainOf(1)] }] };

		expect(() => compileDrawerMenu(unknown)).toThrow();
		expect(() => compileDrawerMenu(colourless)).toThrow(/needs a color/u);
	});
});

describe("enabledDrawerFeatureFlags", () => {
	it("turns the developer tools on in a development build, and pull requests unless the server has them off", () => {
		expect(enabledDrawerFeatureFlags({ developmentBuild: true, githubPullRequests: true })).toStrictEqual(["developer-tools", "github-pull-requests"]);
		expect(enabledDrawerFeatureFlags({ developmentBuild: false, githubPullRequests: false })).toStrictEqual([]);
	});
});

describe("drawerHeadingOf", () => {
	it("names a screen by its heading, in the language on screen, and a branch by its own title", () => {
		const [group] = drawerGroupsFor(accessWith([]), compileDrawerMenu(menuOf([chainOf(2)])));
		const branch = group?.nodes.at(0);
		const screen = destinationsOf(group?.nodes ?? []).at(0);

		expect(screen === undefined ? null : drawerHeadingOf(screen, NAVIGATION_LABELS.ms).title).toBe(NAVIGATION_LABELS.ms.headings.security.title);
		expect(branch === undefined ? null : drawerHeadingOf(branch, EN)).toStrictEqual({ title: "Level 1", subtitle: "" });
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
		expect(isTabRoot("/auth/sign-in")).toBe(false);
	});
});

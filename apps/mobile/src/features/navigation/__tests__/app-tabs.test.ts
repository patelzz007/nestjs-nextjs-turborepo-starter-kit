import { APP_TABS, appTabOf, type AppTab } from "../app-tabs";
import { NAVIGATION_LABELS } from "../navigation-labels";

/** A tab's title in English (its heading in the navigation labels). */
function titleOf(tab: AppTab | undefined): string | undefined {
	return tab === undefined ? undefined : NAVIGATION_LABELS.en.headings[tab.name].title;
}

describe("APP_TABS", () => {
	it("lists Home, Analytics, Search, Profile and Settings, in that order", () => {
		expect(APP_TABS.map((tab: AppTab): string | undefined => titleOf(tab))).toStrictEqual(["Home", "Analytics", "Search", "Profile", "Settings"]);
		expect(APP_TABS.map((tab: AppTab): string => tab.name)).toStrictEqual(["index", "analytics", "search", "profile", "settings"]);
	});

	it("keeps to five tabs, the most a bottom bar holds", () => {
		expect(APP_TABS.length).toBeLessThanOrEqual(5);
	});

	it("links every tab to its route", () => {
		expect(APP_TABS.map((tab: AppTab): string => tab.route)).toStrictEqual(["/", "/analytics", "/search", "/profile", "/settings"]);
	});

	it("gives every tab its own icon", () => {
		expect(new Set(APP_TABS.map((tab: AppTab) => tab.icon)).size).toBe(APP_TABS.length);
	});
});

describe("appTabOf", () => {
	it("finds the tab of a tab route", () => {
		expect(titleOf(appTabOf("search"))).toBe("Search");
		expect(titleOf(appTabOf("index"))).toBe("Home");
		expect(titleOf(appTabOf("analytics"))).toBe("Analytics");
	});

	it("is undefined for a route that is not a tab", () => {
		expect(appTabOf("settings/security")).toBeUndefined();
		expect(appTabOf("")).toBeUndefined();
	});
});

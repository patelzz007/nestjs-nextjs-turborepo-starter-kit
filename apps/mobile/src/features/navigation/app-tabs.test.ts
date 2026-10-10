import { APP_TABS, appTabOf, type AppTab } from "./app-tabs";

describe("APP_TABS", () => {
	it("lists Home, Search, Profile and Settings, in that order", () => {
		expect(APP_TABS.map((tab: AppTab): string => tab.title)).toStrictEqual(["Home", "Search", "Profile", "Settings"]);
		expect(APP_TABS.map((tab: AppTab): string => tab.name)).toStrictEqual(["index", "search", "profile", "settings"]);
	});

	it("links every tab to its route", () => {
		expect(APP_TABS.map((tab: AppTab): string => tab.route)).toStrictEqual(["/", "/search", "/profile", "/settings"]);
	});

	it("gives every tab its own icon", () => {
		expect(new Set(APP_TABS.map((tab: AppTab) => tab.icon)).size).toBe(APP_TABS.length);
	});
});

describe("appTabOf", () => {
	it("finds the tab of a tab route", () => {
		expect(appTabOf("search")?.title).toBe("Search");
		expect(appTabOf("index")?.title).toBe("Home");
	});

	it("is undefined for a route that is not a tab", () => {
		expect(appTabOf("settings/security")).toBeUndefined();
		expect(appTabOf("")).toBeUndefined();
	});
});

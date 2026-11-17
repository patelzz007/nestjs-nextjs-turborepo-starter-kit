import { PERMISSION } from "@workspace/shared";

import { ROUTES } from "../../../runtime/routes";
import { SHOWCASE_ROUTES } from "../../showcase/showcase-routes";
import { crumbHrefOf, crumbLabelOf, resolveAppTrail, type AppCrumb } from "../app-breadcrumb";
import { drawerGroupsFor, type DrawerAccess } from "../drawer-destinations";
import { NAVIGATION_LABELS } from "../navigation-labels";

const EVERYTHING: DrawerAccess = {
	capabilities: [PERMISSION.GITHUB_PULL_REQUEST.READ, PERMISSION.GITHUB_PULL_REQUEST.UPDATE, PERMISSION.SERVER_METRIC.LIST],
	enabledFeatureFlags: ["showcase", "github-pull-requests", "mobile-analytics"],
};
/** No extra capability and no switch beyond the API flags' code defaults (analytics is on). */
const NOTHING_EXTRA: DrawerAccess = { capabilities: [], enabledFeatureFlags: ["mobile-analytics"] };

/** The trail as labels and links, for a session with `access`, in English. */
function trailOf(pathname: string, access: DrawerAccess = EVERYTHING): readonly (readonly [string, AppCrumb["href"]])[] {
	return resolveAppTrail(pathname, {}, drawerGroupsFor(access), NAVIGATION_LABELS.en).map((crumb: AppCrumb): readonly [string, AppCrumb["href"]] => [crumb.label, crumb.href]);
}

describe("resolveAppTrail", () => {
	it("is the tab alone on a tab's first screen, with no section crumb for the tabs block", () => {
		expect(trailOf("/")).toStrictEqual([["Home", null]]);
		expect(trailOf("/settings")).toStrictEqual([["Settings", null]]);
	});

	it("leads a drawer screen with the branches it sits in (no links), and its section when that holds more than one entry", () => {
		// Account holds one entry, which stands for it (the web's rule); Preferences holds several.
		expect(trailOf("/settings/security")).toStrictEqual([
			["Sign-in & security", null],
			["Security", null],
		]);
		expect(trailOf("/settings/language").map(([label]) => label)).toStrictEqual(["Preferences", "Display", "Region", "Language"]);
	});

	it("names a screen below a drawer entry by its own heading, linking the entry above it", () => {
		const trail = trailOf("/profile/commit");
		expect(trail.at(0)).toStrictEqual(["Profile", ROUTES.profile]);
		expect(trail).toHaveLength(2);
	});

	it("walks the showcase down to a component's docs, linking the showcase and the component", () => {
		// Developer holds the showcase alone, so the showcase stands for it (the web's rule).
		expect(trailOf("/showcase")).toStrictEqual([["Showcase", null]]);
		expect(trailOf("/showcase/button-group/docs")).toStrictEqual([
			["Showcase", ROUTES.showcase],
			["Button group", SHOWCASE_ROUTES.component("button-group")],
			["Docs & API", null],
		]);
	});

	it("reads a screen the session's drawer hides from the tab it sits under instead", () => {
		expect(trailOf("/settings/servers")).toStrictEqual([["Servers", null]]);
		expect(trailOf("/settings/servers", NOTHING_EXTRA)).toStrictEqual([
			["Settings", ROUTES.settings],
			["Servers", null],
		]);
	});

	it("falls back to Home, as a link, for a path the app does not have", () => {
		expect(trailOf("/nowhere")).toStrictEqual([["Home", ROUTES.home]]);
	});

	it("reads in the language on screen", () => {
		const trail = resolveAppTrail("/settings/security", {}, drawerGroupsFor(EVERYTHING), NAVIGATION_LABELS.ms);
		expect(trail.at(-1)?.label).toBe(NAVIGATION_LABELS.ms.headings.security.title);
		const preferences = resolveAppTrail("/settings/appearance", {}, drawerGroupsFor(EVERYTHING), NAVIGATION_LABELS.ms);
		expect(preferences.at(0)?.label).toBe(NAVIGATION_LABELS.ms.sections.preferences);
	});
});

describe("crumbLabelOf and crumbHrefOf", () => {
	it("names showcase pages and app screens, and nothing else", () => {
		expect(crumbLabelOf("/showcase/date-picker", {}, NAVIGATION_LABELS.en)).toBe("Date picker");
		expect(crumbLabelOf("/settings/devices", {}, NAVIGATION_LABELS.en)).toBe(NAVIGATION_LABELS.en.headings.devices.title);
		expect(crumbLabelOf("/nowhere", {}, NAVIGATION_LABELS.en)).toBeNull();
	});

	it("links to app routes and component screens only", () => {
		expect(crumbHrefOf("/settings")).toBe(ROUTES.settings);
		expect(crumbHrefOf("/showcase/button")).toStrictEqual(SHOWCASE_ROUTES.component("button"));
		expect(crumbHrefOf("/showcase/button/docs")).toBeNull();
		expect(crumbHrefOf("/nowhere")).toBeNull();
	});
});

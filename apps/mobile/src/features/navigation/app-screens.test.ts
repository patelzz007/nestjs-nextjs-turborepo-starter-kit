import { ROUTES } from "../../runtime/routes";
import { DEVICES_COPY } from "../devices/labels";
import { screenTitleOf } from "./app-screens";

describe("screenTitleOf", () => {
	it("names the tabs as the tab bar does", () => {
		expect([ROUTES.home, ROUTES.search, ROUTES.profile, ROUTES.settings].map((route) => screenTitleOf(route, {}))).toEqual(["Home", "Search", "Profile", "Settings"]);
	});

	it("names the screens under Settings in their own words", () => {
		expect([ROUTES.security, ROUTES.devices, ROUTES.appearance, ROUTES.appLock].map((route) => screenTitleOf(route, {}))).toEqual([
			"Security",
			DEVICES_COPY.title,
			"Appearance",
			"App lock",
		]);
	});

	it("names the two-factor screen by its mode, turning it on by default or for an unknown mode", () => {
		expect(screenTitleOf(ROUTES.twoFactorSetup, { mode: "rotate" })).toBe("New backup codes");
		expect(screenTitleOf(ROUTES.twoFactorSetup, { mode: "setup" })).toBe("Turn on two-factor authentication");
		expect(screenTitleOf(ROUTES.twoFactorSetup, {})).toBe("Turn on two-factor authentication");
		expect(screenTitleOf(ROUTES.twoFactorSetup, { mode: ["rotate", "setup"] })).toBe("Turn on two-factor authentication");
	});

	it("has no title for a path the app does not have", () => {
		expect(screenTitleOf("/nowhere", {})).toBe("");
	});
});

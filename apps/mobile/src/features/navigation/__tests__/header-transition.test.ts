import { PUSH_TITLE_DRIFT, TAB_DRIFT } from "../../../lib/screen-transitions";
import { ROUTES } from "../../../runtime/routes";
import { headerTitleDriftOf } from "../header-transition";

describe("headerTitleDriftOf", () => {
	it("does not move the title when the page does not change", () => {
		expect(headerTitleDriftOf(ROUTES.profile, ROUTES.profile)).toBe(0);
	});

	it("drifts a tab switch toward the side the new tab sits on, as far as the tab transition", () => {
		expect(headerTitleDriftOf(ROUTES.home, ROUTES.profile)).toBe(TAB_DRIFT);
		expect(headerTitleDriftOf(ROUTES.settings, ROUTES.search)).toBe(-TAB_DRIFT);
	});

	it("brings a pushed screen's title in from the right and the previous one back from the left", () => {
		expect(headerTitleDriftOf(ROUTES.settings, ROUTES.security)).toBe(PUSH_TITLE_DRIFT);
		expect(headerTitleDriftOf(ROUTES.security, ROUTES.settings)).toBe(-PUSH_TITLE_DRIFT);
	});

	it("treats a step sideways within a tab (one sub-screen to another) as forward", () => {
		expect(headerTitleDriftOf(ROUTES.security, ROUTES.devices)).toBe(PUSH_TITLE_DRIFT);
	});

	it("judges a switch to another tab's sub-screen by the tabs, not the depth", () => {
		expect(headerTitleDriftOf(ROUTES.profile, ROUTES.appearance)).toBe(TAB_DRIFT);
		expect(headerTitleDriftOf(ROUTES.appearance, ROUTES.home)).toBe(-TAB_DRIFT);
	});

	it("counts an unknown path as Home's tab", () => {
		expect(headerTitleDriftOf("/nowhere", ROUTES.search)).toBe(TAB_DRIFT);
	});
});

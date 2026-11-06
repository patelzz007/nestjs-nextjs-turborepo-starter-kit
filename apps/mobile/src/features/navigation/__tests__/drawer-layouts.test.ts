import { DrawerStyleSchema } from "../../../lib/secure-store";
import { DEFAULT_PREFERENCES } from "../../preferences/state";
import { DRAWER_LAYOUTS, statusBridgesSheet } from "../drawer-layouts";

describe("the drawer's looks", () => {
	it("has a layout for every look the person can choose", () => {
		expect(Object.keys(DRAWER_LAYOUTS).sort()).toEqual([...DrawerStyleSchema.options].sort());
	});

	it("opens on the look the preferences default to: ink, centred, on a sheet", () => {
		expect(DRAWER_LAYOUTS[DEFAULT_PREFERENCES.drawerStyle]).toEqual({ surface: "ink", profile: "centred", status: "line", sheet: true, selected: "solid", action: "none" });
	});

	it("gives every look a different combination", () => {
		const combinations = Object.values(DRAWER_LAYOUTS).map((layout): string => JSON.stringify(layout));

		expect(new Set(combinations).size).toBe(combinations.length);
	});

	it("lets the status cards bridge the edge only where there is a sheet to bridge", () => {
		expect(statusBridgesSheet(DRAWER_LAYOUTS["ink-cards"])).toBe(true);
		expect(statusBridgesSheet(DRAWER_LAYOUTS["centred-ink"])).toBe(false);
		expect(statusBridgesSheet(DRAWER_LAYOUTS["wash-cards"])).toBe(false);
	});
});

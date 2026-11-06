import { describe, expect, it } from "vitest";

import { applyKey, INITIAL_DASHBOARD, VIEWS, type DashboardState, type PanelShape } from "../dashboard.ts";
import type { KeyName } from "../keyboard.ts";

const LIST: PanelShape = { length: 100, tail: false, height: 10, packageAt: (row) => `package-${String(row)}` };
const TAIL: PanelShape = { ...LIST, tail: true };

function press(keys: readonly KeyName[], panel: PanelShape = LIST, state: DashboardState = INITIAL_DASHBOARD): DashboardState {
	return keys.reduce((current, key) => applyKey(current, key, panel).state, state);
}

describe("views", () => {
	it("jumps by number", () => {
		expect(VIEWS.map((view) => press([view.key]).view)).toStrictEqual(["live", "packages", "slowest", "problems", "log", "changes"]);
	});

	it("steps both ways and wraps", () => {
		expect(press(["next"]).view).toBe("packages");
		expect(press(["previous"]).view).toBe("changes");
		expect(press(["view6", "next"]).view).toBe("live");
	});

	it("starts a new view at its natural place", () => {
		expect(press(["down", "view2"]).top).toBeUndefined();
	});
});

describe("scrolling", () => {
	it("moves a list and stops at both ends", () => {
		expect(press(["down", "down", "up"]).top).toBe(1);
		expect(press(["up"]).top).toBe(0);
		expect(press(["end", "down"]).top).toBe(90);
		expect(press(["pageDown"]).top).toBe(10);
		expect(press(["pageDown", "pageUp"]).top).toBe(0);
		expect(press(["end", "home"]).top).toBe(0);
	});

	it("leaves a tail on scrolling up, and follows it again at the bottom", () => {
		expect(press(["up"], TAIL).top).toBe(89);
		expect(press(["up", "down"], TAIL).top).toBeUndefined();
		expect(press(["home", "end"], TAIL).top).toBeUndefined();
	});
});

describe("packages", () => {
	const packages: DashboardState = { ...INITIAL_DASHBOARD, view: "packages" };

	it("moves the selection, within the list", () => {
		expect(press(["down", "down"], LIST, packages).selected).toBe(2);
		expect(press(["up"], LIST, packages).selected).toBe(0);
		expect(press(["end"], LIST, packages).selected).toBe(99);
		expect(press(["end", "home"], LIST, packages).selected).toBe(0);
		expect(press(["down"], { ...LIST, length: 0 }, packages).selected).toBe(0);
	});

	it("opens the selected package's log, and goes back", () => {
		const opened = press(["down", "enter"], LIST, packages);
		expect(opened).toMatchObject({ view: "log", logFilter: "package-1" });

		expect(press(["escape"], LIST, opened)).toMatchObject({ view: "packages", logFilter: undefined });
	});

	it("ignores enter with nothing to open, or in another view", () => {
		expect(press(["enter"], { ...LIST, packageAt: () => undefined }, packages).view).toBe("packages");
		expect(press(["enter"]).view).toBe("live");
	});

	it("ignores escape with nothing to go back from", () => {
		expect(press(["escape"])).toStrictEqual(INITIAL_DASHBOARD);
	});
});

describe("cancelling", () => {
	it("asks on the first q and cancels on the second", () => {
		const asked = applyKey(INITIAL_DASHBOARD, "quit", LIST);
		expect(asked).toMatchObject({ cancel: false, state: { confirmingCancel: true } });

		expect(applyKey(asked.state, "quit", LIST).cancel).toBe(true);
	});

	it("drops the question on any other key", () => {
		const asked = press(["quit"]);
		const moved = applyKey(asked, "down", LIST);

		expect(moved).toMatchObject({ cancel: false, state: { confirmingCancel: false } });
		expect(applyKey(moved.state, "quit", LIST).cancel).toBe(false);
	});

	it("cancels on Ctrl+C at once", () => {
		expect(applyKey(INITIAL_DASHBOARD, "interrupt", LIST).cancel).toBe(true);
	});
});

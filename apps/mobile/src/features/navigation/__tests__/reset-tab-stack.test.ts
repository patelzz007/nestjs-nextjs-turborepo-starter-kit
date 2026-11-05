import type { NavigationAction, NavigationState } from "expo-router/react-navigation";

import { resetTabStack, tabStackDepth, type TabNavigatorHandle } from "../reset-tab-stack";

/** A tab navigator with Home (no stack of its own) and Settings (a stack `depth` screens above its first). */
function tabs(depth: number): { readonly state: NavigationState; readonly navigator: TabNavigatorHandle; readonly dispatched: NavigationAction[] } {
	const dispatched: NavigationAction[] = [];
	const settingsRoutes = [
		{ key: "settings-index", name: "index" },
		...Array.from({ length: depth }, (_, at: number) => ({ key: `settings-${String(at)}`, name: "appearance" })),
	];
	const state: NavigationState = {
		key: "tabs",
		routeKeySeq: 2,
		index: 0,
		routeNames: ["index", "settings"],
		routes: [
			{ key: "home", name: "index" },
			{
				key: "settings",
				name: "settings",
				state: { key: "settings-stack", routeKeySeq: depth + 1, index: depth, routeNames: ["index", "appearance"], routes: settingsRoutes, type: "stack", stale: false },
			},
		],
		type: "tab",
		stale: false,
	};
	return {
		state,
		dispatched,
		navigator: {
			getState: (): NavigationState | undefined => state,
			dispatch: (action: NavigationAction): void => {
				dispatched.push(action);
			},
		},
	};
}

describe("tabStackDepth", () => {
	it("is how far the tab's stack is above its first screen", () => {
		expect(tabStackDepth(tabs(2).state, "settings")).toBe(2);
		expect(tabStackDepth(tabs(0).state, "settings")).toBe(0);
	});

	it("is 0 for a tab with no stack of its own, and for a route that is not there", () => {
		expect(tabStackDepth(tabs(1).state, "home")).toBe(0);
		expect(tabStackDepth(tabs(1).state, "gone")).toBe(0);
	});
});

describe("resetTabStack", () => {
	it("pops a deeper stack to its first screen, addressed to that stack", () => {
		const { navigator, dispatched } = tabs(1);
		resetTabStack(navigator, "settings");
		expect(dispatched).toStrictEqual([{ type: "POP_TO_TOP", target: "settings-stack" }]);
	});

	it("sends nothing for a stack already at its first screen or a tab with no stack (it would be reported as unhandled)", () => {
		const atFirst = tabs(0);
		resetTabStack(atFirst.navigator, "settings");
		resetTabStack(atFirst.navigator, "home");
		expect(atFirst.dispatched).toStrictEqual([]);
	});
});

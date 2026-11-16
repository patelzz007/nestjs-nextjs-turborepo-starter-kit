import { fireEvent, screen } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";
import * as React from "react";

import { fakeDeviceBoundaries, itemsOnScreen, renderShowcaseExample, settle } from "../../../../test/showcase-example";
import { SHOWCASE_FEATURE_SETS } from "../generated/feature-sets";
import type { ShowcaseComponentModule, ShowcaseFeature, ShowcaseGuideline } from "../showcase-feature";

/** What the examples call on the router: the moves are recorded, never made. */
interface RouterStub {
	readonly push: jest.Mock;
	readonly replace: jest.Mock;
	readonly navigate: jest.Mock;
	readonly back: jest.Mock;
	readonly canGoBack: () => boolean;
}

jest.mock("expo-router", (): { readonly useRouter: () => RouterStub } => ({
	useRouter: (): RouterStub => ({ push: jest.fn(), replace: jest.fn(), navigate: jest.fn(), back: jest.fn(), canGoBack: (): boolean => false }),
}));

/** Every component's module, loaded once (each imports all of its examples). */
const MODULES: readonly (readonly [string, () => Promise<ShowcaseComponentModule>])[] = [...SHOWCASE_FEATURE_SETS];

/** Renders one example as the showcase does, and checks that it drew. */
async function renderExample(render_: () => React.JSX.Element, testID: string): Promise<void> {
	await renderShowcaseExample(render_(), testID);
}

/** The roles a reader can press. */
const PRESSABLE_ROLES: readonly string[] = ["button", "checkbox", "switch", "radio", "tab", "link", "menuitem", "togglebutton", "combobox"];

/** How many presses one example gets: enough to open its sheets and press what they hold, bounded for long lists. */
const MAX_PRESSES = 24;

/** Using every example of a component with many controls (the trace, the data grid) takes longer than one render. */
const SWEEP_TIMEOUT_MS = 120_000;

/** A screen reader's swipe up on a slider. */
const INCREMENT = { nativeEvent: { actionName: "increment" } };

/** How many of a menu's items the sweep picks, one per opening. */
const MAX_MENU_ITEMS = 8;

/** Every control a reader can press, in screen order. */
function pressables(): TestInstance[] {
	return PRESSABLE_ROLES.flatMap((role): TestInstance[] => screen.queryAllByRole(role));
}

/**
 * Uses an example the way a reader would: types into each field, then presses one control after another (sheets
 * opened along the way included), letting what each press starts run out; the example must keep drawing throughout.
 */
async function exerciseExample(render_: () => React.JSX.Element, testID: string): Promise<void> {
	await renderExample(render_, testID);
	for (const field of screen.queryAllByPlaceholderText(/./u)) {
		await fireEvent.changeText(field, "Ada");
	}
	for (const slider of screen.queryAllByRole("adjustable")) {
		await fireEvent(slider, "accessibilityAction", INCREMENT);
	}
	for (let step = 0; step < MAX_PRESSES; step += 1) {
		const target = pressables().at(step);
		if (target === undefined) {
			break;
		}
		const before = new Set(itemsOnScreen());
		await fireEvent.press(target);
		await settle();
		// A press that opened a menu: pick each of its items, reopening it from the same control in between.
		const opened = itemsOnScreen().filter((item: TestInstance): boolean => !before.has(item)).length;
		for (let position = 0; position < Math.min(opened, MAX_MENU_ITEMS); position += 1) {
			if (position > 0) {
				const trigger = pressables().at(step);
				if (trigger === undefined) {
					break;
				}
				await fireEvent.press(trigger);
				await settle();
			}
			const added = itemsOnScreen().filter((item: TestInstance): boolean => !before.has(item));
			const item = added.at(position);
			if (item === undefined) {
				break;
			}
			await fireEvent.press(item);
			await settle();
		}
	}
	// Then last to first, so a pair such as Cancel / Save, or Deny / Apply, is also tried the other way round.
	for (let step = 0; step < MAX_PRESSES; step += 1) {
		const fresh = pressables();
		const target = fresh.at(fresh.length - 1 - step);
		if (target === undefined || step >= fresh.length) {
			break;
		}
		await fireEvent.press(target);
		await settle();
	}
	expect(screen.getByTestId(testID)).toBeOnTheScreen();
}

/**
 * How long loading every component's module may take. On a cold Jest cache that load is where Babel compiles the
 * kit and its ES-module dependencies (TanStack Table, FormatJS), once for the whole file; it runs up front so each
 * test below spends its own (default) time budget rendering, never on whichever module happens to compile first.
 */
const COLD_COMPILE_TIMEOUT_MS = 180_000;

beforeAll(async (): Promise<void> => {
	await Promise.all(MODULES.map(([, load]): Promise<ShowcaseComponentModule> => load()));
}, COLD_COMPILE_TIMEOUT_MS);

describe.each(MODULES)("the %s examples", (_slug, load) => {
	it("render every feature, live", async () => {
		const { features } = await load();
		for (const feature of features) {
			await renderExample((): React.JSX.Element => (feature satisfies ShowcaseFeature).render(), `example-${feature.anchor}`);
			expect(feature.source).toContain(`export function`);
		}
	});

	it(
		"respond to every control of every feature",
		async () => {
			jest.useFakeTimers();
			fakeDeviceBoundaries();
			try {
				const { features } = await load();
				for (const feature of features) {
					await exerciseExample(feature.render, `used-${feature.anchor}`);
				}
			} finally {
				jest.useRealTimers();
			}
		},
		SWEEP_TIMEOUT_MS,
	);

	it(
		"render and respond on both sides of every Do / Don't pair",
		async () => {
			jest.useFakeTimers();
			fakeDeviceBoundaries();
			try {
				const { guidelines } = await load();
				for (const guideline of guidelines satisfies readonly ShowcaseGuideline[]) {
					await exerciseExample(guideline.do.render, `do-${guideline.do.file}`);
					await exerciseExample(guideline.dont.render, `dont-${guideline.dont.file}`);
				}
			} finally {
				jest.useRealTimers();
			}
		},
		SWEEP_TIMEOUT_MS,
	);
});

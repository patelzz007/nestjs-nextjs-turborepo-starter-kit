// Renders a showcase example as the showcase does: inside the app's safe area and its toast store, in a frame the
// test can find. Shared by the showcase's render suite and its per-example interaction tests.

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { TestInstance } from "test-renderer";
import * as React from "react";
import { Linking, View } from "react-native";
import { type Metrics, SafeAreaProvider } from "react-native-safe-area-context";

// The kit's handle on the iOS action sheet: the same native module, named in its `.ios` file (rules/04).
import { IOS_ACTION_SHEET } from "@workspace/ui-native/lib/system-picker.ios";

import { ToastStoreProvider } from "../src/features/toast/facade";
import { createToastStore } from "../src/features/toast/store";

/** A phone with a notch and a home indicator: the app's root gives every screen these insets. */
const PHONE_METRICS: Metrics = {
	frame: { x: 0, y: 0, width: 390, height: 844 },
	insets: { top: 47, right: 0, bottom: 34, left: 0 },
};

/** Renders `example` in a frame named `testID`, and checks that it drew. */
export async function renderShowcaseExample(example: React.JSX.Element, testID = "example"): Promise<void> {
	await render(
		<SafeAreaProvider initialMetrics={PHONE_METRICS}>
			<ToastStoreProvider store={createToastStore()}>
				<View testID={testID}>{example}</View>
			</ToastStoreProvider>
		</SafeAreaProvider>,
	);
	expect(screen.getByTestId(testID)).toBeOnTheScreen();
}

/** The device's boundaries an example reaches: iOS's action sheet picks its first option, and links open. */
export function fakeDeviceBoundaries(): void {
	jest.spyOn(IOS_ACTION_SHEET, "showActionSheetWithOptions").mockImplementation((_options, choose): void => {
		choose(0);
	});
	jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
}

/** What a press may start (a sheet's motion, a toast's timer) runs this long before the next step. */
const SETTLE_MS = 2_000;

/** Lets what the last step started run out (fake timers). */
export async function settle(): Promise<void> {
	await act((): void => {
		jest.advanceTimersByTime(SETTLE_MS);
	});
}

/**
 * Lets what an example started play out (fake timers): one timer per render, until none is left or `budgetMs` of the
 * clock has passed. A run sets its next timer in an effect after each render (a character typed, a batch imported, a
 * "Saved" that resets), so a clock jump inside one render moves it a single step.
 */
export async function runOut(budgetMs: number): Promise<void> {
	const endsAt = jest.now() + budgetMs;
	while (jest.getTimerCount() > 0 && jest.now() < endsAt) {
		await act((): void => {
			jest.advanceTimersToNextTimer();
		});
	}
}

/** Every plain, checkbox and radio item on screen. */
export function itemsOnScreen(): TestInstance[] {
	return MENU_ITEM_ROLES.flatMap((role: string): TestInstance[] => screen.queryAllByRole(role));
}

const MENU_ITEM_ROLES: readonly string[] = ["menuitem", "checkbox", "radio"];

/** Opens the menu behind the button named `trigger` once per item, picking each in turn; resolves to how many there were. */
export async function pickEveryMenuItem(trigger: string | RegExp): Promise<number> {
	const open = async (): Promise<TestInstance[]> => {
		const before = new Set(itemsOnScreen());
		await fireEvent.press(screen.getByRole("button", { name: trigger }));
		await settle();
		return itemsOnScreen().filter((item: TestInstance): boolean => !before.has(item));
	};
	let items = await open();
	const count = items.length;
	for (let position = 0; position < count; position += 1) {
		if (position > 0) {
			items = await open();
		}
		const item = items.at(position);
		if (item !== undefined) {
			await fireEvent.press(item);
			await settle();
		}
	}
	return count;
}

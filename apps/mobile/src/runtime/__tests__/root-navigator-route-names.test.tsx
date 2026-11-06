import type * as IsArrayEqual from "expo-router/build/react-navigation/core/isArrayEqual";
import { Stack } from "expo-router";
import { renderRouter, screen } from "expo-router/testing-library";
import * as React from "react";

import { createTestRuntime, gatedMarkerScreen, gatedSlotLayout, markerScreen } from "../../../test/app-harness";
import { memorySecureStore } from "../../../test/secure-store-memory";
import AuthFolderLayout from "../../app/auth/_layout";
import * as AuthFormsLayout from "../../app/auth/(forms)/_layout";
import type { ReadyAppRuntime } from "../app-runtime";
import { AppShell } from "../app-shell";
import { rootScreenOptionsOf } from "../root-navigator";

/**
 * Every time a navigator's route names differ from the ones in its state: the comparison that makes it send itself a
 * ROUTE_NAMES_CHANGED. Expo Router's own function, only recorded: the warning needs a timing a test cannot pin down,
 * so this watches for what makes it possible.
 */
const mockDifferences: string[][] = [];

jest.mock("expo-router/build/react-navigation/core/isArrayEqual", () => {
	const actual = jest.requireActual<typeof IsArrayEqual>("expo-router/build/react-navigation/core/isArrayEqual");
	return {
		...actual,
		isArrayEqual: (committed: string[], declared: string[]): boolean => {
			const same = actual.isArrayEqual(committed, declared);
			if (!same && committed.length === declared.length) {
				mockDifferences.push(declared);
			}
			return same;
		},
	};
});
jest.mock("expo-splash-screen", () => ({ hideAsync: jest.fn(() => Promise.resolve()), preventAutoHideAsync: jest.fn(() => Promise.resolve()) }));
jest.mock("expo-local-authentication", () => ({
	SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
	getEnrolledLevelAsync: jest.fn(() => Promise.resolve(3)),
	supportedAuthenticationTypesAsync: jest.fn(() => Promise.resolve([1])),
}));

function shellLayout(runtime: ReadyAppRuntime): () => React.JSX.Element {
	return function ShellLayout(): React.JSX.Element {
		return <AppShell runtime={runtime} fontsReady />;
	};
}

/** The screens this repo's real root stack has, behind the real shell, the auth folder and the forms' layout. */
function realRoutes(runtime: ReadyAppRuntime, formsLayout: typeof AuthFormsLayout | (() => React.JSX.Element)): Parameters<typeof renderRouter>[0] {
	return {
		_layout: shellLayout(runtime),
		"config-error": gatedMarkerScreen(["config-error"], "config-error screen"),
		lock: gatedMarkerScreen(["lock"], "lock screen"),
		"auth/_layout": AuthFolderLayout,
		"auth/onboarding": gatedMarkerScreen(["onboarding"], "onboarding screen"),
		"auth/(forms)/_layout": formsLayout,
		"auth/(forms)/sign-in": gatedMarkerScreen(["auth"], "sign-in screen"),
		"auth/(forms)/sign-up": gatedMarkerScreen(["auth"], "sign-up screen"),
		"auth/(forms)/forgot-password": gatedMarkerScreen(["auth"], "forgot-password screen"),
		"(app)/_layout": gatedSlotLayout(["app"]),
		"(app)/index": markerScreen("home screen"),
	};
}

/** A forms layout that lists its screens by hand, in an order the router would not sort them into. */
function ListedFormsLayout(): React.JSX.Element {
	return (
		<Stack>
			<Stack.Screen name="forgot-password" />
			<Stack.Screen name="sign-in" />
			<Stack.Screen name="sign-up" />
		</Stack>
	);
}

describe("the root and auth stacks take the router's own screen order", () => {
	beforeEach(() => {
		mockDifferences.length = 0;
		memorySecureStore.seed("prefs.onboarding.completed", "true");
	});

	it("sends no route-name correction when a redirect mounts them", async () => {
		await renderRouter(realRoutes(createTestRuntime(), AuthFormsLayout), { initialUrl: "/" });
		expect(await screen.findByText("sign-in screen")).toBeOnTheScreen();
		expect(mockDifferences).toEqual([]);
	});

	it("would see one from a layout that lists its screens", async () => {
		await renderRouter(realRoutes(createTestRuntime(), ListedFormsLayout), { initialUrl: "/" });
		expect(await screen.findByText("sign-in screen")).toBeOnTheScreen();
		expect(mockDifferences).toContainEqual(["forgot-password", "sign-in", "sign-up"]);
	});
});

describe("rootScreenOptionsOf", () => {
	it.each(["lock", "onboarding"])("pins %s: nothing behind it to swipe back to", (name) => {
		expect(rootScreenOptionsOf({ route: { name } }).gestureEnabled).toBe(false);
	});

	it.each(["auth", "(app)", "(forms)", "config-error"])("leaves %s swipeable", (name) => {
		expect(rootScreenOptionsOf({ route: { name } }).gestureEnabled).toBeUndefined();
	});
});

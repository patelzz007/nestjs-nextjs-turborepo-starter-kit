import { renderRouter, screen } from "expo-router/testing-library";
import * as SplashScreen from "expo-splash-screen";
import * as React from "react";
import { Text } from "react-native";

import { createAppRuntime } from "../runtime/app-runtime";
import { createDeviceAppRuntime } from "../runtime/device-runtime";
import { markerScreen, SlotLayout, testRuntimeInputs, TEST_RAW_ENV } from "../../test/app-harness";
import { memorySecureStore } from "../../test/secure-store-memory";
import AuthLayout from "../app/(auth)/_layout";
import ConfigErrorScreen from "../app/config-error";
import RootLayout from "../app/_layout";

jest.mock("expo-splash-screen", () => ({ hideAsync: jest.fn(() => Promise.resolve()), preventAutoHideAsync: jest.fn(() => Promise.resolve()) }));
jest.mock("../runtime/device-runtime", () => ({ createDeviceAppRuntime: jest.fn() }));

/** Captured at import time: jest's clearMocks resets call counts before every test. */
const splashPreventedOnImport = jest.mocked(SplashScreen.preventAutoHideAsync).mock.calls.length;

function HomeMarker(): React.JSX.Element {
	return <Text>home screen</Text>;
}

describe("RootLayout", () => {
	it("keeps the splash screen up from the start", () => {
		expect(splashPreventedOnImport).toBe(1);
	});

	it("shows only the configuration error when the environment is invalid", async () => {
		jest
			.mocked(createDeviceAppRuntime)
			.mockReturnValue(createAppRuntime(testRuntimeInputs({ rawEnv: { ...TEST_RAW_ENV, isDevelopment: false, apiUrl: "http://plain.example.com" } })));
		const view = renderRouter({ _layout: RootLayout, "config-error": ConfigErrorScreen, "(app)/index": HomeMarker }, { initialUrl: "/" });
		await view;

		expect(screen.getByText("The app is not configured")).toBeOnTheScreen();
		expect(screen.getByText("EXPO_PUBLIC_API_URL must be an https:// URL.")).toBeOnTheScreen();
		expect(screen.getByText("https://api.example.com")).toBeOnTheScreen();
		expect(screen.queryByText("http://plain.example.com")).toBeNull();
		expect(screen.queryByText("home screen")).toBeNull();
		expect(SplashScreen.hideAsync).toHaveBeenCalled();
	});
});

describe("RootLayout with a valid environment", () => {
	it("renders the app shell, which restores the session and opens sign-in", async () => {
		memorySecureStore.seed("prefs.onboarding.completed", "true");
		jest.mocked(createDeviceAppRuntime).mockReturnValue(createAppRuntime(testRuntimeInputs()));
		const view = renderRouter(
			{
				_layout: RootLayout,
				"(auth)/_layout": SlotLayout,
				"(auth)/sign-in": markerScreen("sign-in screen"),
				"(app)/index": HomeMarker,
			},
			{ initialUrl: "/" },
		);
		await view;

		expect(await screen.findByText("sign-in screen")).toBeOnTheScreen();
	});

	it("opens sign-in at `/` through the real (auth) layout, which has no index of its own", async () => {
		memorySecureStore.seed("prefs.onboarding.completed", "true");
		// The app opens at `/`, the (app) group's Home. Signed out, the guard protects it and the
		// router falls back to the (auth) group — a Stack of several screens with no index — which
		// must land on sign-in, not on a sibling screen or on nothing.
		jest.mocked(createDeviceAppRuntime).mockReturnValue(createAppRuntime(testRuntimeInputs()));
		const view = renderRouter(
			{
				_layout: RootLayout,
				"(auth)/_layout": AuthLayout,
				"(auth)/forgot-password": markerScreen("forgot-password screen"),
				"(auth)/sign-in": markerScreen("sign-in screen"),
				"(auth)/sign-up": markerScreen("sign-up screen"),
				"(auth)/two-factor": markerScreen("two-factor screen"),
				"(auth)/verify-device": markerScreen("verify-device screen"),
				"(app)/index": HomeMarker,
			},
			{ initialUrl: "/" },
		);
		await view;

		expect(await screen.findByText("sign-in screen")).toBeOnTheScreen();
		expect(view.getPathname()).toBe("/sign-in");
		expect(screen.queryByText("home screen")).toBeNull();
		// The (auth) layout frames every signed-out screen in the AuthShell, branded with the app's name (ADR 039).
		expect(screen.getByTestId("auth-shell")).toBeOnTheScreen();
		expect(screen.getByRole("header", { name: "Starter" })).toBeOnTheScreen();
	});
});

describe("ConfigErrorScreen", () => {
	it("still renders when no issue was provided", async () => {
		const view = renderRouter({ "config-error": ConfigErrorScreen }, { initialUrl: "/config-error" });
		await view;
		expect(screen.getByText("The configuration could not be read.")).toBeOnTheScreen();
	});
});

import { renderRouter, screen } from "expo-router/testing-library";
import * as SplashScreen from "expo-splash-screen";
import * as React from "react";
import { Text } from "react-native";

import { createAppRuntime } from "../../runtime/app-runtime";
import { createDeviceAppRuntime } from "../../runtime/device-runtime";
import { createTestRuntime, markerScreen, testRuntimeInputs, TEST_RAW_ENV, gatedMarkerScreen, gatedSlotLayout } from "../../../test/app-harness";
import { memorySecureStore } from "../../../test/secure-store-memory";
import AuthLayout from "../../app/auth/(forms)/_layout";
import ConfigErrorScreen from "../../app/config-error";
import RootLayout from "../../app/_layout";
import AuthFolderLayout from "../../app/auth/_layout";

jest.mock("expo-splash-screen", () => ({ hideAsync: jest.fn(() => Promise.resolve()), preventAutoHideAsync: jest.fn(() => Promise.resolve()) }));
jest.mock("../../runtime/device-runtime", () => ({ createDeviceAppRuntime: jest.fn() }));

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
		await renderRouter({ _layout: RootLayout, "config-error": ConfigErrorScreen, "(app)/_layout": gatedSlotLayout(["app"]), "(app)/index": HomeMarker }, { initialUrl: "/" });

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
		jest.mocked(createDeviceAppRuntime).mockReturnValue(createTestRuntime());
		await renderRouter(
			{
				_layout: RootLayout,
				"auth/_layout": AuthFolderLayout,
				"auth/(forms)/_layout": gatedSlotLayout(["auth", "enroll-two-factor", "verify-email"]),
				"auth/(forms)/sign-in": gatedMarkerScreen(["auth"], "sign-in screen"),
				"(app)/_layout": gatedSlotLayout(["app"]),
				"(app)/index": HomeMarker,
			},
			{ initialUrl: "/" },
		);

		expect(await screen.findByText("sign-in screen")).toBeOnTheScreen();
	});

	it("opens sign-in at `/` through the real (auth) layout, which has no index of its own", async () => {
		memorySecureStore.seed("prefs.onboarding.completed", "true");
		// The app opens at `/`, the (app) group's Home. Signed out, the guard protects it and the
		// router falls back to the (auth) group — a Stack of several screens with no index — which
		// must land on sign-in, not on a sibling screen or on nothing.
		jest.mocked(createDeviceAppRuntime).mockReturnValue(createTestRuntime());
		const view = await renderRouter(
			{
				_layout: RootLayout,
				"auth/_layout": AuthFolderLayout,
				"auth/(forms)/_layout": AuthLayout,
				"auth/(forms)/forgot-password": markerScreen("forgot-password screen"),
				"auth/(forms)/sign-in": gatedMarkerScreen(["auth"], "sign-in screen"),
				"auth/(forms)/sign-up": markerScreen("sign-up screen"),
				"auth/(forms)/two-factor": markerScreen("two-factor screen"),
				"auth/(forms)/verify-device": markerScreen("verify-device screen"),
				"(app)/_layout": gatedSlotLayout(["app"]),
				"(app)/index": HomeMarker,
			},
			{ initialUrl: "/" },
		);

		expect(await screen.findByText("sign-in screen")).toBeOnTheScreen();
		expect(view.getPathname()).toBe("/auth/sign-in");
		expect(screen.queryByText("home screen")).toBeNull();
		// The (auth) layout frames every signed-out screen in the AuthShell, branded with the app's name (ADR 039).
		expect(screen.getByTestId("auth-shell")).toBeOnTheScreen();
		expect(screen.getByRole("header", { name: "Starter" })).toBeOnTheScreen();
	});
});

describe("ConfigErrorScreen", () => {
	it("still renders when no issue was provided", async () => {
		await renderRouter({ "config-error": ConfigErrorScreen }, { initialUrl: "/config-error" });
		expect(screen.getByText("The configuration could not be read.")).toBeOnTheScreen();
	});
});

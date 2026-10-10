import { act } from "@testing-library/react-native";
import { renderRouter, screen, waitFor } from "expo-router/testing-library";
import * as SplashScreen from "expo-splash-screen";
import * as React from "react";

import { createTestRuntime, markerScreen, SlotLayout } from "../../test/app-harness";
import { testAccessToken } from "../../test/jwt";
import { memorySecureStore } from "../../test/secure-store-memory";
import { preferencesActions } from "../features/preferences/actions";
import { sessionActions } from "../features/session/actions";
import { AppShell } from "./app-shell";
import type { ReadyAppRuntime } from "./app-runtime";

jest.mock("expo-splash-screen", () => ({ hideAsync: jest.fn(() => Promise.resolve()), preventAutoHideAsync: jest.fn(() => Promise.resolve()) }));
jest.mock("expo-local-authentication", () => ({
	SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
	getEnrolledLevelAsync: jest.fn(() => Promise.resolve(3)),
	supportedAuthenticationTypesAsync: jest.fn(() => Promise.resolve([1])),
}));

function shellLayout(runtime: ReadyAppRuntime, fontsReady: boolean): () => React.JSX.Element {
	return function ShellLayout(): React.JSX.Element {
		return <AppShell runtime={runtime} fontsReady={fontsReady} />;
	};
}

async function renderShell(runtime: ReadyAppRuntime, fontsReady = true): Promise<void> {
	const view = renderRouter(
		{
			_layout: shellLayout(runtime, fontsReady),
			"config-error": markerScreen("config-error screen"),
			onboarding: markerScreen("onboarding screen"),
			"update-required": markerScreen("update-required screen"),
			lock: markerScreen("lock screen"),
			"(auth)/_layout": SlotLayout,
			"(auth)/sign-in": markerScreen("sign-in screen"),
			"(app)/_layout": SlotLayout,
			"(app)/index": markerScreen("home screen"),
		},
		{ initialUrl: "/" },
	);
	await view;
}

describe("AppShell — start sequence and root guard transitions", () => {
	it("keeps the splash screen and renders nothing until the typefaces are ready", async () => {
		const runtime = createTestRuntime();
		await renderShell(runtime, false);

		await waitFor(() => {
			expect(runtime.sessionStore.getState().status).toBe("signedOut");
		});
		expect(screen.queryByText("sign-in screen")).toBeNull();
		expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
	});

	it("hands the native splash over to the launch screen while the session is being restored (ADR 043)", async () => {
		// Secure Store never answers: the session stays "starting".
		memorySecureStore.getItemAsync.mockReturnValue(new Promise<string | null>((): void => undefined));
		const runtime = createTestRuntime();
		await renderShell(runtime);

		expect(await screen.findByTestId("launch-screen")).toHaveAccessibleName("Starter is starting");
		expect(SplashScreen.hideAsync).toHaveBeenCalled();
		expect(screen.queryByText("sign-in screen")).toBeNull();
	});

	it("keeps the splash screen until the session is restored, then shows sign-in without tokens", async () => {
		memorySecureStore.seed("prefs.onboarding.completed", "true");
		const runtime = createTestRuntime();
		await renderShell(runtime);

		expect(await screen.findByText("sign-in screen")).toBeOnTheScreen();
		expect(SplashScreen.hideAsync).toHaveBeenCalled();
	});

	it("opens the app with tokens and the lock off, then follows every transition", async () => {
		memorySecureStore.seed("prefs.onboarding.completed", "true");
		await createTestRuntime().tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
		const runtime = createTestRuntime();
		await renderShell(runtime);
		expect(await screen.findByText("home screen")).toBeOnTheScreen();

		await act((): void => {
			runtime.sessionStore.dispatch(sessionActions.locked());
		});
		expect(await screen.findByText("lock screen")).toBeOnTheScreen();

		await act((): void => {
			runtime.sessionStore.dispatch(sessionActions.unlocked({ scope: "full" }));
		});
		expect(await screen.findByText("home screen")).toBeOnTheScreen();

		await act((): void => {
			runtime.sessionStore.dispatch(sessionActions.expired());
		});
		expect(await screen.findByText("sign-in screen")).toBeOnTheScreen();

		await act((): void => {
			runtime.sessionStore.dispatch(sessionActions.upgradeRequired("2.0.0"));
		});
		expect(await screen.findByText("update-required screen")).toBeOnTheScreen();
	});

	it("opens the lock screen at a cold start when the lock is on", async () => {
		await createTestRuntime().tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
		memorySecureStore.seed("prefs.appLock.enabled", "true");
		memorySecureStore.seed("prefs.appLock.enrolledBiometrics", JSON.stringify("3:1"));
		const runtime = createTestRuntime();

		await renderShell(runtime);

		expect(await screen.findByText("lock screen")).toBeOnTheScreen();
	});

	it("starts signed out, as a new device, when nothing on the device can be read", async () => {
		const runtime = createTestRuntime();
		memorySecureStore.getItemAsync.mockRejectedValue(new Error("keychain"));

		await renderShell(runtime);

		expect(await screen.findByText("onboarding screen")).toBeOnTheScreen();
		expect(runtime.sessionStore.getState().status).toBe("signedOut");
	});
});

describe("AppShell — onboarding (ADR 041)", () => {
	it("shows onboarding first on a device that has never been through it, then sign-in once it is finished", async () => {
		const savePreferences = jest.fn((): Promise<void> => Promise.resolve());
		const runtime = createTestRuntime({ savePreferences });
		await renderShell(runtime);

		expect(await screen.findByText("onboarding screen")).toBeOnTheScreen();
		expect(screen.queryByText("sign-in screen")).toBeNull();

		await act((): void => {
			runtime.preferencesStore.dispatch(preferencesActions.onboardingCompleted());
		});

		expect(await screen.findByText("sign-in screen")).toBeOnTheScreen();
		// Recorded on the device, so it never shows again.
		expect(savePreferences).toHaveBeenCalledWith(expect.objectContaining({ onboardingCompleted: true }));
	});

	it("never interrupts a signed-in device, even one that has not seen onboarding", async () => {
		await createTestRuntime().tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
		const runtime = createTestRuntime();

		await renderShell(runtime);

		expect(await screen.findByText("home screen")).toBeOnTheScreen();
		expect(screen.queryByText("onboarding screen")).toBeNull();
	});
});

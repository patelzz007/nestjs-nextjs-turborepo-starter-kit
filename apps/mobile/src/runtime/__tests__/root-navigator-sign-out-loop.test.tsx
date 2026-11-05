import { act } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";
import * as React from "react";

import { createTestRuntime, markerScreen, gatedMarkerScreen } from "../../../test/app-harness";
import { testAccessToken } from "../../../test/jwt";
import { memorySecureStore } from "../../../test/secure-store-memory";
import * as AuthLayout from "../../app/auth/(forms)/_layout";
import * as AppLayout from "../../app/(app)/_layout";
import * as SettingsLayout from "../../app/(app)/settings/_layout";
import * as ProfileLayout from "../../app/(app)/profile/_layout";
import * as TwoFactorSettings from "../../app/(app)/settings/two-factor";
import * as SignIn from "../../app/auth/(forms)/sign-in";
import { fail } from "../../../test/api-stub";
import { AppShell } from "../app-shell";
import type { ReadyAppRuntime } from "../app-runtime";
import AuthFolderLayout from "../../app/auth/_layout";

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

const ONE_SECOND_MS = 1000;
const TWO_MINUTES_IN_SECONDS = 120;

describe("the session ending on a settings screen with params", () => {
	it("moves to sign-in once, without a navigation loop, when the account is gone (every request refused)", async () => {
		jest.useFakeTimers();
		memorySecureStore.seed("prefs.onboarding.completed", "true");
		await createTestRuntime().tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
		const runtime = createTestRuntime();
		const refused = fail(401, "UNAUTHORIZED", "Unauthorized");
		globalThis.fetch = jest.fn((): Promise<Response> =>
			Promise.resolve(new Response(JSON.stringify(refused.body), { status: refused.status, headers: { "content-type": "application/json" } })),
		);
		const errors = jest.spyOn(console, "error");
		await renderRouter(
			{
				_layout: shellLayout(runtime),
				"config-error": gatedMarkerScreen(["config-error"], "config-error screen"),
				"auth/_layout": AuthFolderLayout,
				"auth/onboarding": gatedMarkerScreen(["onboarding"], "onboarding screen"),
				"update-required": gatedMarkerScreen(["update-required"], "update-required screen"),
				lock: gatedMarkerScreen(["lock"], "lock screen"),
				"auth/(forms)/_layout": AuthLayout,
				"auth/(forms)/sign-in": SignIn,
				"auth/(forms)/enroll-two-factor": gatedMarkerScreen(["enroll-two-factor"], "enroll screen"),
				"auth/(forms)/verify-email": gatedMarkerScreen(["verify-email"], "verify-email screen"),
				"(app)/_layout": AppLayout,
				"(app)/index": markerScreen("home screen"),
				"(app)/analytics": markerScreen("analytics screen"),
				"(app)/search": markerScreen("search screen"),
				"(app)/profile/_layout": ProfileLayout,
				"(app)/profile/index": markerScreen("profile screen"),
				"(app)/settings/_layout": SettingsLayout,
				"(app)/settings/index": markerScreen("settings screen"),
				"(app)/settings/two-factor": TwoFactorSettings,
			},
			{ initialUrl: "/settings/two-factor?mode=setup" },
		);
		// Two minutes: long enough for the live stream's reconnect backoff to run several times.
		for (let second = 0; second < TWO_MINUTES_IN_SECONDS; second += 1) {
			await act(async (): Promise<void> => {
				await jest.advanceTimersByTimeAsync(ONE_SECOND_MS);
			});
		}
		expect(runtime.sessionStore.getState()).toEqual({ status: "signedOut", reason: "sessionExpired" });
		expect(screen.getByText("Welcome back")).toBeOnTheScreen();
		expect(errors.mock.calls.filter((call) => String(call.at(0)).includes("Maximum update depth"))).toEqual([]);
		jest.useRealTimers();
	});
});

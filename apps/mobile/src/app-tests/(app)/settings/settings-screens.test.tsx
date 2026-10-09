import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import * as LocalAuthentication from "expo-local-authentication";
import * as React from "react";

import { ok, stubApi } from "../../../../test/api-stub";
import { createTestRuntime, markerScreen, renderInApp, TEST_RAW_ENV, type TestRuntimeOverrides } from "../../../../test/app-harness";
import { testAccessToken } from "../../../../test/jwt";
import { memorySecureStore } from "../../../../test/secure-store-memory";
import { savePreferences } from "../../../features/preferences/persistence";
import AppLockScreen, { APP_LOCK_FAILED_MESSAGE, APP_LOCK_UNAVAILABLE_MESSAGE } from "../../../app/(app)/settings/app-lock";
import AppearanceScreen from "../../../app/(app)/settings/appearance";
import SettingsScreen from "../../../app/(app)/settings/index";

jest.mock("expo-local-authentication", () => ({
	SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
	getEnrolledLevelAsync: jest.fn(() => Promise.resolve(3)),
	supportedAuthenticationTypesAsync: jest.fn(() => Promise.resolve([2])),
	authenticateAsync: jest.fn(),
}));

const authenticate = jest.mocked(LocalAuthentication.authenticateAsync);

async function renderSettings(
	screens: Readonly<Record<string, () => React.JSX.Element>>,
	url: string,
	overrides: TestRuntimeOverrides = {},
): Promise<ReturnType<typeof createTestRuntime>> {
	const runtime = createTestRuntime(overrides, { status: "signedIn", session: { scope: "full" } });
	await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
	await renderInApp(runtime, screens, url);
	return runtime;
}

const SETTINGS_SCREENS = {
	"settings/index": SettingsScreen,
	"settings/appearance": markerScreen("appearance screen"),
	"settings/security": markerScreen("security screen"),
	"settings/devices": markerScreen("devices screen"),
	"settings/app-lock": markerScreen("app-lock screen"),
};

describe("Settings (§10.9)", () => {
	it("shows the current preferences and the About details (API address in development only)", async () => {
		stubApi({});
		await renderSettings(SETTINGS_SCREENS, "/settings");

		expect(screen.getByRole("button", { name: "Appearance, System" })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "App lock, Off" })).toBeOnTheScreen();
		expect(screen.getByLabelText("Version: 1.0.0")).toBeOnTheScreen();
		expect(screen.getByLabelText("API address: http://api.test")).toBeOnTheScreen();
	});

	it("hides the API address outside development", async () => {
		stubApi({});
		await renderSettings(SETTINGS_SCREENS, "/settings", { rawEnv: { ...TEST_RAW_ENV, isDevelopment: false, apiUrl: "https://api.example.com" } });
		expect(screen.queryByLabelText(/API address/)).toBeNull();
	});

	it.each([
		["Appearance, System", "appearance screen"],
		["Security", "security screen"],
		["Signed-in devices", "devices screen"],
		["App lock, Off", "app-lock screen"],
	])("opens %s", async (row, target) => {
		stubApi({});
		await renderSettings(SETTINGS_SCREENS, "/settings");
		await fireEvent.press(screen.getByRole("button", { name: row }));
		expect(await screen.findByText(target)).toBeOnTheScreen();
	});

	it("signs out after a confirmation: revokes this session and clears the tokens", async () => {
		const api = stubApi({ "POST /auth/logout": ok({ message: "Logged out successfully" }, 201) });
		const runtime = await renderSettings(SETTINGS_SCREENS, "/settings");

		await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
		expect(screen.getByText("You'll need your password to sign in again on this device.")).toBeOnTheScreen();
		await fireEvent.press(screen.getAllByRole("button", { name: "Sign out" }).at(-1) ?? screen.getByRole("button", { name: "Cancel" }));

		await waitFor(() => {
			expect(runtime.sessionStore.getState()).toEqual({ status: "signedOut", reason: "signedOut" });
		});
		expect(api.callsTo("POST /auth/logout").at(0)?.body).toBe(JSON.stringify({ refreshToken: "refresh-1" }));
		expect(memorySecureStore.peek("auth.accessToken")).toBeNull();
	});

	it("leaves even when the API cannot be reached", async () => {
		globalThis.fetch = jest.fn(() => Promise.reject(new TypeError("Network request failed")));
		const runtime = await renderSettings(SETTINGS_SCREENS, "/settings");

		await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
		await fireEvent.press(screen.getAllByRole("button", { name: "Sign out" }).at(-1) ?? screen.getByRole("button", { name: "Cancel" }));

		await waitFor(() => {
			expect(runtime.sessionStore.getState().status).toBe("signedOut");
		});
	});

	it("can cancel signing out", async () => {
		stubApi({});
		const runtime = await renderSettings(SETTINGS_SCREENS, "/settings");
		await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
		await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
		expect(screen.queryByText("You'll need your password to sign in again on this device.")).toBeNull();
		expect(runtime.sessionStore.getState().status).toBe("signedIn");
	});
});

describe("Appearance (§10.9)", () => {
	it("applies the choice at once and saves it in Secure Store", async () => {
		stubApi({});
		const applyTheme = jest.fn();
		const runtime = await renderSettings({ "settings/appearance": AppearanceScreen }, "/settings/appearance", {
			applyTheme,
			savePreferences,
		});

		expect(screen.getByRole("radio", { name: "System" })).toBeChecked();
		await fireEvent.press(screen.getByRole("radio", { name: "Dark" }));

		expect(applyTheme).toHaveBeenLastCalledWith("dark");
		expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
		expect(runtime.preferencesStore.getState().theme).toBe("dark");
		await waitFor(() => {
			expect(memorySecureStore.peek("prefs.theme")).toBe(JSON.stringify("dark"));
		});
	});
});

describe("App lock settings (§11)", () => {
	it("turns on after one successful check, then offers the timeout", async () => {
		stubApi({});
		authenticate.mockResolvedValue({ success: true });
		const runtime = await renderSettings({ "settings/app-lock": AppLockScreen }, "/settings/app-lock");

		expect(screen.getByText("The app lock is off.")).toBeOnTheScreen();
		expect(screen.queryByRole("radio")).toBeNull();
		await fireEvent.press(screen.getByRole("button", { name: "Turn on app lock" }));

		expect(await screen.findByText("The app lock is on.")).toBeOnTheScreen();
		expect(authenticate).toHaveBeenCalledTimes(1);
		expect(memorySecureStore.peek("prefs.appLock.enrolledBiometrics")).toBe(JSON.stringify("3:2"));
		expect(screen.getByRole("radio", { name: "After 1 minute" })).toBeChecked();

		await fireEvent.press(screen.getByRole("radio", { name: "Immediately" }));
		expect(runtime.preferencesStore.getState().appLock).toEqual({ enabled: true, timeoutMs: 0 });
	});

	it("turns off after one successful check", async () => {
		stubApi({});
		authenticate.mockResolvedValue({ success: true });
		const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
		runtime.preferencesStore.dispatch({ type: "[ Preferences ] App Lock Turned On" });
		await renderInApp(runtime, { "settings/app-lock": AppLockScreen }, "/settings/app-lock");

		await fireEvent.press(screen.getByRole("button", { name: "Turn off app lock" }));

		expect(await screen.findByText("The app lock is off.")).toBeOnTheScreen();
		expect(runtime.preferencesStore.getState().appLock.enabled).toBe(false);
	});

	it("changes nothing when the check fails, and says why", async () => {
		stubApi({});
		authenticate.mockResolvedValue({ success: false, error: "authentication_failed" });
		await renderSettings({ "settings/app-lock": AppLockScreen }, "/settings/app-lock");

		await fireEvent.press(screen.getByRole("button", { name: "Turn on app lock" }));

		expect(await screen.findByText(APP_LOCK_FAILED_MESSAGE)).toBeOnTheScreen();
		expect(screen.getByText("The app lock is off.")).toBeOnTheScreen();
	});

	it("says nothing when the prompt was dismissed", async () => {
		stubApi({});
		authenticate.mockResolvedValue({ success: false, error: "user_cancel" });
		await renderSettings({ "settings/app-lock": AppLockScreen }, "/settings/app-lock");

		await fireEvent.press(screen.getByRole("button", { name: "Turn on app lock" }));

		await waitFor(() => {
			expect(screen.getByRole("button", { name: "Turn on app lock" })).not.toBeBusy();
		});
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("explains a device without a passcode", async () => {
		stubApi({});
		jest.mocked(LocalAuthentication.getEnrolledLevelAsync).mockResolvedValueOnce(LocalAuthentication.SecurityLevel.NONE);
		await renderSettings({ "settings/app-lock": AppLockScreen }, "/settings/app-lock");

		await fireEvent.press(screen.getByRole("button", { name: "Turn on app lock" }));

		expect(await screen.findByText(APP_LOCK_UNAVAILABLE_MESSAGE)).toBeOnTheScreen();
		expect(authenticate).not.toHaveBeenCalled();
	});

	it("reports a failing native call as a failed check", async () => {
		stubApi({});
		authenticate.mockRejectedValue(new Error("native"));
		await renderSettings({ "settings/app-lock": AppLockScreen }, "/settings/app-lock");

		await fireEvent.press(screen.getByRole("button", { name: "Turn on app lock" }));

		expect(await screen.findByText(APP_LOCK_FAILED_MESSAGE)).toBeOnTheScreen();
	});
});

import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import * as LocalAuthentication from "expo-local-authentication";
import { Linking, Platform } from "react-native";

import { createTestRuntime, markerScreen, renderInApp, TEST_RAW_ENV } from "../../test/app-harness";
import { testAccessToken } from "../../test/jwt";
import { memorySecureStore } from "../../test/secure-store-memory";
import { sessionActions } from "../features/session/actions";
import LockScreen from "../app/lock";
import UpdateRequiredScreen from "../app/update-required";

jest.mock("expo-local-authentication", () => ({ authenticateAsync: jest.fn() }));

const authenticate = jest.mocked(LocalAuthentication.authenticateAsync);

describe("Update required (§10.13)", () => {
	async function renderUpdate(storeUrl: string | undefined, isDevelopment = false): Promise<void> {
		const runtime = createTestRuntime({ rawEnv: { ...TEST_RAW_ENV, isDevelopment, apiUrl: "https://api.example.com", iosStoreUrl: storeUrl, androidStoreUrl: storeUrl } });
		runtime.sessionStore.dispatch(sessionActions.upgradeRequired("2.0.0"));
		await renderInApp(runtime, { "update-required": UpdateRequiredScreen }, "/update-required");
	}

	it("explains the update and opens the store", async () => {
		const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
		await renderUpdate("https://apps.apple.com/app/id1");

		expect(screen.getByText("Installed version: 1.0.0. Oldest supported version: 2.0.0.")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Open the store" }));
		expect(openUrl).toHaveBeenCalledWith("https://apps.apple.com/app/id1");
		expect(Platform.OS).toBe("ios");
	});

	it("says so when the store cannot be opened", async () => {
		jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("no store"));
		await renderUpdate("https://apps.apple.com/app/id1");

		await fireEvent.press(screen.getByRole("button", { name: "Open the store" }));
		expect(await screen.findByText("The store could not be opened. Update the app from your device's app store.")).toBeOnTheScreen();
	});

	it("explains how to update in development (no store URL)", async () => {
		await renderUpdate(undefined, true);
		expect(screen.queryByRole("button", { name: "Open the store" })).toBeNull();
		expect(screen.getByText(/Development build: raise `version`/)).toBeOnTheScreen();
	});

	it("points to the store without a configured URL outside development", async () => {
		await renderUpdate(undefined, false);
		expect(screen.getByText("Update the app from your device's app store.")).toBeOnTheScreen();
	});
});

describe("Lock screen (§10.12, §11)", () => {
	async function renderLock(): Promise<ReturnType<typeof createTestRuntime>> {
		const runtime = createTestRuntime({}, { status: "locked" });
		await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
		await renderInApp(runtime, { lock: LockScreen, home: markerScreen("home") }, "/lock");
		return runtime;
	}

	it("asks once on open and unlocks on success", async () => {
		authenticate.mockResolvedValue({ success: true });
		const runtime = await renderLock();

		await waitFor(() => {
			expect(runtime.sessionStore.getState()).toEqual({ status: "signedIn", session: { scope: "full" } });
		});
		expect(authenticate).toHaveBeenCalledTimes(1);
		expect(authenticate).toHaveBeenCalledWith({ promptMessage: "Unlock to continue", disableDeviceFallback: false });
	});

	it("offers only Try again and Sign out after a failed check", async () => {
		authenticate.mockResolvedValueOnce({ success: false, error: "authentication_failed" }).mockResolvedValueOnce({ success: true });
		const runtime = await renderLock();

		expect(await screen.findByText("The check didn't pass. Try again, or sign out.")).toBeOnTheScreen();
		expect(screen.getAllByRole("button")).toHaveLength(2);
		expect(screen.getByRole("button", { name: "Try again" })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Sign out" })).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
		await waitFor(() => {
			expect(runtime.sessionStore.getState().status).toBe("signedIn");
		});
	});

	it("shows no message when the prompt was dismissed", async () => {
		authenticate.mockResolvedValue({ success: false, error: "user_cancel" });
		await renderLock();

		await waitFor(() => {
			expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
		});
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("explains a device that cannot check its owner", async () => {
		authenticate.mockResolvedValue({ success: false, error: "passcode_not_set" });
		await renderLock();
		expect(await screen.findByText(/This device can't check its owner right now/)).toBeOnTheScreen();
	});

	it("treats a failing check call as a failed check", async () => {
		authenticate.mockRejectedValue(new Error("native error"));
		await renderLock();
		expect(await screen.findByText("The check didn't pass. Try again, or sign out.")).toBeOnTheScreen();
	});

	it("signs out by forgetting the tokens, without reading the refresh token", async () => {
		authenticate.mockResolvedValue({ success: false, error: "user_cancel" });
		const runtime = await renderLock();
		memorySecureStore.getItemAsync.mockClear();

		await fireEvent.press(await screen.findByRole("button", { name: "Sign out" }));

		await waitFor(() => {
			expect(runtime.sessionStore.getState()).toEqual({ status: "signedOut", reason: "signedOut" });
		});
		expect(memorySecureStore.peek("auth.refreshToken")).toBeNull();
		expect(memorySecureStore.getItemAsync.mock.calls.map(([key]): string => key)).not.toContain("auth.refreshToken");
	});

	it("signs out when the stored session is unreadable after unlocking", async () => {
		authenticate.mockResolvedValue({ success: true });
		const runtime = createTestRuntime({}, { status: "locked" });
		memorySecureStore.seed("auth.accessToken", JSON.stringify("not-a-jwt"));
		await renderInApp(runtime, { lock: LockScreen }, "/lock");

		await waitFor(() => {
			expect(runtime.sessionStore.getState()).toEqual({ status: "signedOut", reason: "sessionExpired" });
		});
	});
});

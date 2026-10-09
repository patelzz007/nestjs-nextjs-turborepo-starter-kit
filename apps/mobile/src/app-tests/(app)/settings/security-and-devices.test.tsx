import { fireEvent, screen, waitFor } from "expo-router/testing-library";
import * as React from "react";

import { dynamic, fail, ok, stubApi } from "../../../../test/api-stub";
import { createTestRuntime, markerScreen, type RenderedApp, renderInApp } from "../../../../test/app-harness";
import { sessionJson, twoFactorSetupJson, userJson } from "../../../../test/fixtures";
import { testAccessToken } from "../../../../test/jwt";
import { memorySecureStore } from "../../../../test/secure-store-memory";
import DevicesScreen from "../../../app/(app)/settings/devices";
import SecurityScreen from "../../../app/(app)/settings/security";
import TwoFactorSetupScreen from "../../../app/(app)/settings/two-factor";

jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));

interface View {
	readonly runtime: ReturnType<typeof createTestRuntime>;
	readonly app: RenderedApp;
}

async function renderSignedIn(screens: Readonly<Record<string, () => React.JSX.Element>>, url: string): Promise<View> {
	const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
	await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken({}, "first"), refreshToken: "refresh-1" });
	const app = await renderInApp(runtime, screens, url);
	return { runtime, app };
}

const SECURITY_SCREENS = {
	"settings/security": SecurityScreen,
	"settings/two-factor": markerScreen("two-factor setup screen"),
	"settings/devices": markerScreen("devices screen"),
};

function refreshAnswer(nonce: string): ReturnType<typeof ok> {
	return ok({ message: "Tokens refreshed successfully", tokenTransport: "body", accessToken: testAccessToken({}, nonce), refreshToken: `refresh-${nonce}` });
}

describe("Security (§10.10)", () => {
	it("changes the password with the shared schema; the API signs every device out, so this one leaves", async () => {
		const api = stubApi({ "GET /auth/me": ok(userJson()), "POST /auth/change-password": ok({ message: "Password changed successfully" }) });
		const { runtime } = await renderSignedIn(SECURITY_SCREENS, "/settings/security");

		await fireEvent.changeText(screen.getByLabelText("Current password"), "Old@Pass12");
		await fireEvent.changeText(screen.getByLabelText("New password"), "New@Pass34");
		await fireEvent.changeText(screen.getByLabelText("Confirm new password"), "New@Pass34");
		await fireEvent.press(screen.getByRole("button", { name: "Change password" }));

		await waitFor(() => {
			expect(runtime.sessionStore.getState()).toEqual({ status: "signedOut", reason: "passwordChanged" });
		});
		expect(memorySecureStore.peek("auth.refreshToken")).toBeNull();
		expect(api.callsTo("POST /auth/change-password").at(0)?.body).toBe(
			JSON.stringify({ currentPassword: "Old@Pass12", newPassword: "New@Pass34", confirmPassword: "New@Pass34" }),
		);
	});

	it("validates the password change and shows a refusal", async () => {
		stubApi({ "GET /auth/me": ok(userJson()), "POST /auth/change-password": fail(400, "BAD_REQUEST", "Current password is incorrect") });
		const { runtime } = await renderSignedIn(SECURITY_SCREENS, "/settings/security");

		await fireEvent.changeText(screen.getByLabelText("Current password"), "Old@Pass12");
		await fireEvent.changeText(screen.getByLabelText("New password"), "New@Pass34");
		await fireEvent.changeText(screen.getByLabelText("Confirm new password"), "Other@Pass56");
		await fireEvent.press(screen.getByRole("button", { name: "Change password" }));
		expect(await screen.findByText("Passwords do not match")).toBeOnTheScreen();

		await fireEvent.changeText(screen.getByLabelText("Confirm new password"), "New@Pass34");
		await fireEvent.press(screen.getByRole("button", { name: "Change password" }));
		expect(await screen.findByText("Current password is incorrect")).toBeOnTheScreen();
		expect(runtime.sessionStore.getState().status).toBe("signedIn");
	});

	it("offers to turn 2FA on when it is off", async () => {
		stubApi({ "GET /auth/me": ok(userJson({ twoFactorEnabled: false })) });
		const { app } = await renderSignedIn(SECURITY_SCREENS, "/settings/security");

		expect(await screen.findByText("Off")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Turn on two-factor authentication" }));
		expect(await screen.findByText("two-factor setup screen")).toBeOnTheScreen();
		expect(app.pathnameWithParams()).toBe("/settings/two-factor?mode=setup");
	});

	it("shows 2FA on, the remaining backup codes, and generates new ones", async () => {
		stubApi({ "GET /auth/me": ok(userJson({ twoFactorEnabled: true })), "GET /auth/2fa/backup-codes/remaining": ok({ remaining: 1 }) });
		const { app } = await renderSignedIn(SECURITY_SCREENS, "/settings/security");

		expect(await screen.findByText("1 unused backup code remaining.")).toBeOnTheScreen();
		expect(screen.getByText("On")).toBeOnTheScreen();
		expect(screen.getByText("Only 1 backup code is left. Generate new ones in Security settings.")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Generate new backup codes" }));
		expect(await screen.findByText("two-factor setup screen")).toBeOnTheScreen();
		expect(app.pathnameWithParams()).toBe("/settings/two-factor?mode=rotate");
	});

	it("opens the device list", async () => {
		stubApi({ "GET /auth/me": ok(userJson()) });
		await renderSignedIn(SECURITY_SCREENS, "/settings/security");
		await fireEvent.press(screen.getByRole("button", { name: "Signed-in devices" }));
		expect(await screen.findByText("devices screen")).toBeOnTheScreen();
	});

	it("shows a load error for the 2FA status", async () => {
		stubApi({ "GET /auth/me": fail(403, "FORBIDDEN", "Status unavailable") });
		await renderSignedIn(SECURITY_SCREENS, "/settings/security");
		expect(await screen.findByText("Status unavailable")).toBeOnTheScreen();
	});
});

const SESSIONS = [
	sessionJson({ id: "6f1c3b8e-6a64-4b4e-9b7a-2f1f0a6f8d21", label: "Alex’s iPhone", isCurrent: true, clientType: "mobile" }),
	sessionJson({ id: "0b1c3b8e-6a64-4b4e-9b7a-2f1f0a6f8d22", label: "Chrome 141 on macOS", clientType: "web" }),
];

describe("Signed-in devices (§10.11)", () => {
	it("lists the devices, current first with a badge and no revoke", async () => {
		stubApi({ "GET /auth/sessions": ok(SESSIONS) });
		await renderSignedIn({ "settings/devices": DevicesScreen }, "/settings/devices");

		expect(await screen.findByText("Alex’s iPhone")).toBeOnTheScreen();
		expect(screen.getByText("This device")).toBeOnTheScreen();
		expect(screen.getByText("iPhone 15 Pro · iOS 26")).toBeOnTheScreen();
		expect(screen.getByText("Chrome 141 · macOS 16")).toBeOnTheScreen();
		expect(screen.queryByRole("button", { name: "Revoke Alex’s iPhone" })).toBeNull();
		expect(screen.getByRole("button", { name: "Revoke Chrome 141 on macOS" })).toBeOnTheScreen();
	});

	it("revokes another device after a confirmation naming it, then refreshes the list", async () => {
		let listed = SESSIONS;
		const api = stubApi({
			"GET /auth/sessions": dynamic(() => ok(listed)),
			"POST /auth/sessions/0b1c3b8e-6a64-4b4e-9b7a-2f1f0a6f8d22/revoke": dynamic(() => {
				listed = SESSIONS.slice(0, 1);
				return ok({ message: "Session revoked", revokedCurrentSession: false }, 201);
			}),
		});
		await renderSignedIn({ "settings/devices": DevicesScreen }, "/settings/devices");

		await fireEvent.press(await screen.findByRole("button", { name: "Revoke Chrome 141 on macOS" }));
		expect(screen.getByText("Sign out “Chrome 141 on macOS”?")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Sign out device" }));

		expect(await screen.findByText("Chrome 141 on macOS has been signed out.")).toBeOnTheScreen();
		await waitFor(() => {
			expect(screen.queryByRole("button", { name: "Revoke Chrome 141 on macOS" })).toBeNull();
		});
		expect(api.callsTo("GET /auth/sessions").length).toBeGreaterThanOrEqual(2);
	});

	it("keeps the dialog open with the error when the revoke fails, and can cancel", async () => {
		stubApi({
			"GET /auth/sessions": ok(SESSIONS),
			"POST /auth/sessions/0b1c3b8e-6a64-4b4e-9b7a-2f1f0a6f8d22/revoke": fail(404, "SESSION_NOT_FOUND", "No such session"),
		});
		await renderSignedIn({ "settings/devices": DevicesScreen }, "/settings/devices");

		await fireEvent.press(await screen.findByRole("button", { name: "Revoke Chrome 141 on macOS" }));
		await fireEvent.press(screen.getByRole("button", { name: "Sign out device" }));
		expect(await screen.findByText("No such session")).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
		await waitFor(() => {
			expect(screen.queryByText("Sign out “Chrome 141 on macOS”?")).toBeNull();
		});
	});

	it("shows the empty and the error states", async () => {
		stubApi({ "GET /auth/sessions": ok([]) });
		await renderSignedIn({ "settings/devices": DevicesScreen }, "/settings/devices");
		expect(await screen.findByText("No devices are signed in to your account.")).toBeOnTheScreen();
	});

	it("retries after a load error", async () => {
		let attempts = 0;
		stubApi({
			"GET /auth/sessions": dynamic(() => {
				attempts += 1;
				return attempts === 1 ? fail(403, "FORBIDDEN", "nope") : ok(SESSIONS);
			}),
		});
		await renderSignedIn({ "settings/devices": DevicesScreen }, "/settings/devices");

		expect(await screen.findByText("We couldn't load your devices. Check your connection and try again.")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
		expect(await screen.findByText("Alex’s iPhone")).toBeOnTheScreen();
	});

	it("signs out everywhere after a confirmation that includes this phone", async () => {
		const api = stubApi({ "GET /auth/sessions": ok(SESSIONS), "POST /auth/logout-all": ok({ message: "Logged out from all devices" }, 201) });
		const { runtime } = await renderSignedIn({ "settings/devices": DevicesScreen }, "/settings/devices");

		await fireEvent.press(await screen.findByRole("button", { name: "Sign out everywhere" }));
		const dialog = screen.getByText("Sign out of every device?");
		expect(dialog).toBeOnTheScreen();
		expect(screen.getByText(/including this phone/)).toBeOnTheScreen();
		await fireEvent.press(screen.getAllByRole("button", { name: "Sign out everywhere" }).at(-1) ?? dialog);

		await waitFor(() => {
			expect(runtime.sessionStore.getState()).toEqual({ status: "signedOut", reason: "signedOut" });
		});
		expect(api.callsTo("POST /auth/logout-all").at(0)?.body).toBe(JSON.stringify({ refreshToken: "refresh-1" }));
	});

	it("stays signed in and says so when sign out everywhere fails", async () => {
		stubApi({ "GET /auth/sessions": ok(SESSIONS), "POST /auth/logout-all": fail(503, "SERVICE_UNAVAILABLE", "down") });
		const { runtime } = await renderSignedIn({ "settings/devices": DevicesScreen }, "/settings/devices");

		await fireEvent.press(await screen.findByRole("button", { name: "Sign out everywhere" }));
		await fireEvent.press(screen.getAllByRole("button", { name: "Sign out everywhere" }).at(-1) ?? screen.getByRole("button", { name: "Cancel" }));

		expect(await screen.findByText("Your devices are still signed in. Please try again.")).toBeOnTheScreen();
		expect(runtime.sessionStore.getState().status).toBe("signedIn");
		expect(memorySecureStore.peek("auth.refreshToken")).not.toBeNull();
	});

	it("switches to the update screen when sign out everywhere answers 426", async () => {
		stubApi({ "GET /auth/sessions": ok(SESSIONS), "POST /auth/logout-all": fail(426, "APP_VERSION_UNSUPPORTED", "Update", { minimumVersion: "2.0.0" }) });
		const { runtime } = await renderSignedIn({ "settings/devices": DevicesScreen }, "/settings/devices");

		await fireEvent.press(await screen.findByRole("button", { name: "Sign out everywhere" }));
		await fireEvent.press(screen.getAllByRole("button", { name: "Sign out everywhere" }).at(-1) ?? screen.getByRole("button", { name: "Cancel" }));

		await waitFor(() => {
			expect(runtime.sessionStore.getState()).toEqual({ status: "upgradeRequired", minimumVersion: "2.0.0" });
		});
	});
});

describe("Turn on 2FA / new backup codes from Security", () => {
	const TWO_FACTOR_SCREENS = { "settings/two-factor": TwoFactorSetupScreen, "settings/security": markerScreen("security screen") };

	it("turns 2FA on and refreshes at once, so the token-version bump never signs this device out", async () => {
		const api = stubApi({
			"POST /auth/2fa/setup": ok(twoFactorSetupJson(), 201),
			"POST /auth/2fa/enable": ok({ message: "enabled" }, 201),
			"POST /auth/refresh": refreshAnswer("second"),
		});
		const { runtime } = await renderSignedIn(TWO_FACTOR_SCREENS, "/settings/two-factor?mode=setup");

		expect(screen.getByRole("header", { name: "Turn on two-factor authentication" })).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Set up authenticator app" }));
		await fireEvent.changeText(await screen.findByLabelText("Authentication code"), "123456");
		await fireEvent.press(screen.getByRole("button", { name: "Turn on two-factor authentication" }));

		expect(await screen.findByText("Two-factor authentication is on.")).toBeOnTheScreen();
		expect(api.callsTo("POST /auth/refresh")).toHaveLength(1);
		expect(memorySecureStore.peek("auth.refreshToken")).toBe(JSON.stringify("refresh-second"));
		expect(runtime.sessionStore.getState()).toEqual({ status: "signedIn", session: { scope: "full" } });

		await fireEvent.press(screen.getByRole("checkbox", { name: "I saved my backup codes" }));
		await fireEvent.press(screen.getByRole("button", { name: "Done" }));
		expect(await screen.findByText("security screen")).toBeOnTheScreen();
	});

	it("rotates: password + current code, then the new secret, the code, and the new backup codes", async () => {
		const api = stubApi({
			"POST /auth/2fa/rotate": ok(twoFactorSetupJson(), 201),
			"POST /auth/2fa/enable": ok({ message: "enabled" }, 201),
			"POST /auth/refresh": dynamic((call) => refreshAnswer(call.body?.includes("refresh-1") === true ? "second" : "third")),
		});
		await renderSignedIn(TWO_FACTOR_SCREENS, "/settings/two-factor?mode=rotate");

		expect(screen.getByRole("header", { name: "New backup codes" })).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Generate new codes" }));
		expect(await screen.findByText("Password is required")).toBeOnTheScreen();

		await fireEvent.changeText(screen.getByLabelText("Password"), "Secret@123");
		await fireEvent.press(screen.getByRole("button", { name: "Use a backup code instead" }));
		await fireEvent.changeText(screen.getByLabelText("Current backup code"), "abcdefghjkmnpqrs");
		await fireEvent.press(screen.getByRole("button", { name: "Generate new codes" }));

		await fireEvent.changeText(await screen.findByLabelText("Authentication code"), "123456");
		await fireEvent.press(screen.getByRole("button", { name: "Turn on two-factor authentication" }));
		expect(await screen.findByText("Two-factor authentication is on.")).toBeOnTheScreen();

		expect(api.callsTo("POST /auth/2fa/rotate").at(0)?.body).toBe(JSON.stringify({ password: "Secret@123", backupCode: "ABCDEFGHJKMNPQRS" }));
		// Rotating and enabling each bump the token version: one refresh after each.
		expect(api.callsTo("POST /auth/refresh")).toHaveLength(2);
	});

	it("rotates with an authenticator code too", async () => {
		const api = stubApi({ "POST /auth/2fa/rotate": fail(400, "BAD_REQUEST", "The code is not valid") });
		await renderSignedIn(TWO_FACTOR_SCREENS, "/settings/two-factor?mode=rotate");

		await fireEvent.changeText(screen.getByLabelText("Password"), "Secret@123");
		await fireEvent.changeText(screen.getByLabelText("Current authenticator code"), "654321");
		await fireEvent.press(screen.getByRole("button", { name: "Generate new codes" }));

		expect(await screen.findByText("The code is not valid")).toBeOnTheScreen();
		expect(api.callsTo("POST /auth/2fa/rotate").at(0)?.body).toBe(JSON.stringify({ password: "Secret@123", token: "654321" }));
	});

	it("falls back to setup for an unknown mode", async () => {
		stubApi({});
		await renderSignedIn(TWO_FACTOR_SCREENS, "/settings/two-factor?mode=everything");
		expect(screen.getByRole("header", { name: "Turn on two-factor authentication" })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Set up authenticator app" })).toBeOnTheScreen();
	});
});

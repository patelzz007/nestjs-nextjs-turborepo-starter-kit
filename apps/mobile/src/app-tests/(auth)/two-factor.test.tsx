import { fireEvent, screen, waitFor } from "expo-router/testing-library";

import { fail, ok, stubApi } from "../../../test/api-stub";
import { createTestRuntime, markerScreen, type RenderedApp, renderInApp } from "../../../test/app-harness";
import { mobileLoginJson } from "../../../test/fixtures";
import TwoFactorScreen from "../../app/(auth)/two-factor";

const SCREENS = {
	"two-factor": TwoFactorScreen,
	"sign-in": markerScreen("sign-in screen"),
	"verify-device": markerScreen("verify-device screen"),
};

async function renderTwoFactor(url = "/two-factor?tempToken=challenge-1"): Promise<{ readonly runtime: ReturnType<typeof createTestRuntime>; readonly app: RenderedApp }> {
	const runtime = createTestRuntime({}, { status: "signedOut", reason: "none" });
	const app = await renderInApp(runtime, SCREENS, url);
	return { runtime, app };
}

describe("Two-factor screen (§10.3)", () => {
	it("signs in with an authenticator code", async () => {
		const api = stubApi({ "POST /auth/login/2fa": ok(mobileLoginJson()) });
		const { runtime } = await renderTwoFactor();

		await fireEvent.changeText(screen.getByLabelText("Authentication code"), "123 456");
		await fireEvent.press(screen.getByRole("button", { name: "Verify" }));

		await waitFor(() => {
			expect(runtime.sessionStore.getState().status).toBe("signedIn");
		});
		expect(api.callsTo("POST /auth/login/2fa").at(0)?.body).toBe(JSON.stringify({ tempToken: "challenge-1", token: "123456" }));
	});

	it("continues to the emailed new-device code after the second factor (§7.8)", async () => {
		stubApi({ "POST /auth/login/2fa": ok({ requiresVerification: true, verificationId: "verification-9", message: "Check your email" }) });
		const { app } = await renderTwoFactor();

		await fireEvent.changeText(screen.getByLabelText("Authentication code"), "123456");
		await fireEvent.press(screen.getByRole("button", { name: "Verify" }));

		expect(await screen.findByText("verify-device screen")).toBeOnTheScreen();
		expect(app.pathnameWithParams()).toBe("/verify-device?verificationId=verification-9");
	});

	it("validates the code with the shared schema", async () => {
		const api = stubApi({});
		await renderTwoFactor();

		await fireEvent.changeText(screen.getByLabelText("Authentication code"), "12");
		await fireEvent.press(screen.getByRole("button", { name: "Verify" }));

		expect(await screen.findByText("Code must be 6 digits")).toBeOnTheScreen();
		expect(api.calls).toHaveLength(0);
	});

	it("signs in with a backup code (normalized as typed)", async () => {
		const api = stubApi({ "POST /auth/login/backup-code": ok(mobileLoginJson()) });
		const { runtime } = await renderTwoFactor();

		await fireEvent.press(screen.getByRole("button", { name: "Use a backup code" }));
		await fireEvent.changeText(screen.getByLabelText("Backup code"), "abcd-efgh-jkmn-pqrs");
		await fireEvent.press(screen.getByRole("button", { name: "Verify backup code" }));

		await waitFor(() => {
			expect(runtime.sessionStore.getState().status).toBe("signedIn");
		});
		expect(api.callsTo("POST /auth/login/backup-code").at(0)?.body).toBe(JSON.stringify({ tempToken: "challenge-1", backupCode: "ABCDEFGHJKMNPQRS" }));
	});

	it("shows a refused code and switches back to the authenticator", async () => {
		stubApi({ "POST /auth/login/backup-code": fail(401, "INVALID_BACKUP_CODE", "That backup code is not valid") });
		await renderTwoFactor();

		await fireEvent.press(screen.getByRole("button", { name: "Use a backup code" }));
		await fireEvent.changeText(screen.getByLabelText("Backup code"), "ABCDEFGHJKMNPQRS");
		await fireEvent.press(screen.getByRole("button", { name: "Verify backup code" }));
		expect(await screen.findByText("That backup code is not valid")).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("button", { name: "Use authenticator code instead" }));
		expect(screen.getByLabelText("Authentication code")).toBeOnTheScreen();
		expect(screen.queryByText("That backup code is not valid")).toBeNull();
	});

	it("explains a stale or crafted link and leads back to sign-in", async () => {
		stubApi({});
		await renderTwoFactor("/two-factor");

		expect(screen.getByText("This sign-in step is no longer valid. Please sign in again.")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Back to sign in" }));
		expect(await screen.findByText("sign-in screen")).toBeOnTheScreen();
	});

	it("can start over with a different account", async () => {
		stubApi({});
		await renderTwoFactor();

		await fireEvent.press(screen.getByRole("link", { name: "Use a different account" }));
		expect(await screen.findByText("sign-in screen")).toBeOnTheScreen();
	});
});

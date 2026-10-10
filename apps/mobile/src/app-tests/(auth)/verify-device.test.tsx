import { fireEvent, screen, waitFor } from "expo-router/testing-library";

import { fail, ok, stubApi } from "../../../test/api-stub";
import { createTestRuntime, markerScreen, renderInApp } from "../../../test/app-harness";
import { mobileLoginJson } from "../../../test/fixtures";
import { testAccessToken } from "../../../test/jwt";
import VerifyDeviceScreen from "../../app/(auth)/verify-device";

const SCREENS = { "verify-device": VerifyDeviceScreen, "sign-in": markerScreen("sign-in screen") };

async function renderVerify(url = "/verify-device?verificationId=verification-1"): Promise<ReturnType<typeof createTestRuntime>> {
	const runtime = createTestRuntime({}, { status: "signedOut", reason: "none" });
	await renderInApp(runtime, SCREENS, url);
	return runtime;
}

describe("Verify device screen (§10.2)", () => {
	it("finishes the sign-in with the emailed code", async () => {
		const api = stubApi({ "POST /auth/verify-login": ok(mobileLoginJson()) });
		const runtime = await renderVerify();

		await fireEvent.changeText(screen.getByLabelText("Verification code"), "654321");
		await fireEvent.press(screen.getByRole("button", { name: "Verify and sign in" }));

		await waitFor(() => {
			expect(runtime.sessionStore.getState()).toEqual({ status: "signedIn", session: { scope: "full" } });
		});
		expect(api.callsTo("POST /auth/verify-login").at(0)?.body).toBe(JSON.stringify({ verificationId: "verification-1", code: "654321" }));
	});

	it("chains into a forced enrollment, exactly like web", async () => {
		const restricted = testAccessToken({ sessionScope: "restricted" });
		stubApi({
			"POST /auth/verify-login": ok({
				requiresEnrollment: true,
				enrollmentReason: "mfa_enrollment",
				message: "Set up 2FA",
				tokenTransport: "body",
				accessToken: restricted,
				refreshToken: "refresh-1",
			}),
		});
		const runtime = await renderVerify();

		await fireEvent.changeText(screen.getByLabelText("Verification code"), "654321");
		await fireEvent.press(screen.getByRole("button", { name: "Verify and sign in" }));

		await waitFor(() => {
			expect(runtime.sessionStore.getState()).toEqual({ status: "signedIn", session: { scope: "restricted", enrollmentReason: "mfa_enrollment" } });
		});
	});

	it("shows a refused code", async () => {
		stubApi({ "POST /auth/verify-login": fail(400, "INVALID_CODE", "The code is incorrect or expired") });
		await renderVerify();

		await fireEvent.changeText(screen.getByLabelText("Verification code"), "000000");
		await fireEvent.press(screen.getByRole("button", { name: "Verify and sign in" }));

		expect(await screen.findByText("The code is incorrect or expired")).toBeOnTheScreen();
	});

	it("validates the code before sending it", async () => {
		const api = stubApi({});
		await renderVerify();

		await fireEvent.press(screen.getByRole("button", { name: "Verify and sign in" }));

		expect(await screen.findByText("Code must be 6 digits")).toBeOnTheScreen();
		expect(api.calls).toHaveLength(0);
	});

	it("explains a missing verification id and starts over", async () => {
		stubApi({});
		await renderVerify("/verify-device");

		await fireEvent.press(screen.getByRole("button", { name: "Back to sign in" }));
		expect(await screen.findByText("sign-in screen")).toBeOnTheScreen();
	});

	it("offers a different account", async () => {
		stubApi({});
		await renderVerify();

		expect(screen.getByText("Didn't get a code? Sign in again to send a new one.")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("link", { name: "Use a different account" }));
		expect(await screen.findByText("sign-in screen")).toBeOnTheScreen();
	});
});

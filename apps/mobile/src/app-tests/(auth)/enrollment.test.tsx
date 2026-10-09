import { act, fireEvent, screen, waitFor } from "expo-router/testing-library";
import * as Clipboard from "expo-clipboard";
import * as React from "react";
import { Linking, Share, Text } from "react-native";

import { fail, ok, stubApi } from "../../../test/api-stub";
import { createTestRuntime, renderInApp } from "../../../test/app-harness";
import { twoFactorSetupJson, userJson } from "../../../test/fixtures";
import { testAccessToken } from "../../../test/jwt";
import { NO_AUTHENTICATOR_MESSAGE } from "../../features/two-factor/two-factor-enrollment";
import AuthLayout from "../../app/(auth)/_layout";
import EnrollTwoFactorScreen from "../../app/(auth)/enroll-two-factor";
import SignInScreen from "../../app/(auth)/sign-in";
import VerifyEmailScreen from "../../app/(auth)/verify-email";

jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));

const RESTRICTED_MFA = testAccessToken({ sessionScope: "restricted", isEmailVerified: true }, "restricted");
const RESTRICTED_EMAIL = testAccessToken({ sessionScope: "restricted", isEmailVerified: false }, "email");
const FULL = testAccessToken({ sessionScope: "full" }, "full");

function Placeholder(): React.JSX.Element {
	return <Text>other step</Text>;
}

const SCREENS = {
	"(auth)/_layout": AuthLayout,
	"(auth)/sign-in": SignInScreen,
	"(auth)/sign-up": Placeholder,
	"(auth)/forgot-password": Placeholder,
	"(auth)/two-factor": Placeholder,
	"(auth)/verify-device": Placeholder,
	"(auth)/enroll-two-factor": EnrollTwoFactorScreen,
	"(auth)/verify-email": VerifyEmailScreen,
};

async function renderRestricted(accessToken: string, url: string): Promise<ReturnType<typeof createTestRuntime>> {
	const runtime = createTestRuntime({}, { status: "signedOut", reason: "none" });
	await runtime.tokenProvider.saveTokens({ accessToken, refreshToken: "refresh-1" });
	runtime.sessionStore.dispatch({
		type: "[ Session ] Signed In",
		session: { scope: "restricted", enrollmentReason: accessToken === RESTRICTED_EMAIL ? "email_verification" : "mfa_enrollment" },
	});
	await renderInApp(runtime, SCREENS, url);
	return runtime;
}

function refreshAnswer(accessToken: string): ReturnType<typeof ok> {
	return ok({ message: "Tokens refreshed successfully", tokenTransport: "body", accessToken, refreshToken: "refresh-2" });
}

describe("(auth) layout — a restricted session sees only its enrollment step", () => {
	it("keeps a 2FA-restricted session on the enrollment screen, even when sign-in is asked for", async () => {
		stubApi({});
		await renderRestricted(RESTRICTED_MFA, "/sign-in");
		expect(screen.getByText("Set up two-factor authentication")).toBeOnTheScreen();
		expect(screen.queryByText("Welcome back. Sign in to continue.")).toBeNull();
	});

	it("keeps an email-restricted session on the verify-email screen", async () => {
		stubApi({ "GET /auth/me": ok(userJson({ isEmailVerified: false })) });
		await renderRestricted(RESTRICTED_EMAIL, "/enroll-two-factor");
		expect(await screen.findByText("Verify your email")).toBeOnTheScreen();
	});
});

describe("Forced 2FA enrollment (§10.5)", () => {
	it("walks setup → authenticator → code → backup codes, then refreshes into a full session", async () => {
		const api = stubApi({
			"POST /auth/2fa/setup": ok(twoFactorSetupJson(), 201),
			"POST /auth/2fa/enable": ok({ message: "Two-factor authentication enabled" }, 201),
			"POST /auth/refresh": refreshAnswer(FULL),
		});
		const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
		const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
		const runtime = await renderRestricted(RESTRICTED_MFA, "/enroll-two-factor");

		await fireEvent.press(screen.getByRole("button", { name: "Set up authenticator app" }));
		await fireEvent.press(await screen.findByRole("button", { name: "Open in authenticator app" }));
		expect(openUrl).toHaveBeenCalledWith(expect.stringMatching(/^otpauth:\/\/totp\//));
		expect(screen.getByText("JBSW Y3DP EHPK 3PXP")).toBeOnTheScreen();
		expect(screen.getByLabelText("QR code for your authenticator app")).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("button", { name: "Copy setup key" }));
		await waitFor(() => {
			expect(Clipboard.setStringAsync).toHaveBeenCalledWith("JBSWY3DPEHPK3PXP");
		});
		expect(await screen.findByRole("button", { name: "Setup key copied" })).toBeOnTheScreen();

		await fireEvent.changeText(screen.getByLabelText("Authentication code"), "123456");
		await fireEvent.press(screen.getByRole("button", { name: "Turn on two-factor authentication" }));
		expect(await screen.findByText("Two-factor authentication is on.")).toBeOnTheScreen();
		// The restricted session waits for the backup codes before refreshing.
		expect(api.callsTo("POST /auth/refresh")).toHaveLength(0);

		await fireEvent.press(screen.getByRole("button", { name: "Copy all" }));
		await waitFor(() => {
			expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith(expect.stringContaining("ABCDEFGHJKMNPQRS\nABCDEFGHJKMNPQRT"));
		});
		await fireEvent.press(screen.getByRole("button", { name: "Share" }));
		expect(share).toHaveBeenCalledTimes(1);
		expect(JSON.stringify(share.mock.calls)).toContain("ABCDEFGHJKMNPQRS\\nABCDEFGHJKMNPQRT");

		expect(screen.getByRole("button", { name: "Continue to the app" })).toBeDisabled();
		await fireEvent.press(screen.getByRole("checkbox", { name: "I saved my backup codes" }));
		await fireEvent.press(screen.getByRole("button", { name: "Continue to the app" }));

		await waitFor(() => {
			expect(runtime.sessionStore.getState()).toEqual({ status: "signedIn", session: { scope: "full" } });
		});
		expect(api.callsTo("POST /auth/refresh").at(0)?.body).toBe(JSON.stringify({ refreshToken: "refresh-1" }));
	});

	it("explains how to add the key by hand when no authenticator opens the link", async () => {
		stubApi({ "POST /auth/2fa/setup": ok(twoFactorSetupJson(), 201) });
		jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("No app"));
		await renderRestricted(RESTRICTED_MFA, "/enroll-two-factor");

		await fireEvent.press(screen.getByRole("button", { name: "Set up authenticator app" }));
		await fireEvent.press(await screen.findByRole("button", { name: "Open in authenticator app" }));

		expect(await screen.findByText(NO_AUTHENTICATOR_MESSAGE)).toBeOnTheScreen();
	});

	it("shows a refused code and a failed setup", async () => {
		stubApi({ "POST /auth/2fa/setup": fail(500, "INTERNAL_ERROR", "Setup failed") });
		await renderRestricted(RESTRICTED_MFA, "/enroll-two-factor");
		await fireEvent.press(screen.getByRole("button", { name: "Set up authenticator app" }));
		expect(await screen.findByText("Setup failed")).toBeOnTheScreen();
	});

	it("reports a refresh that could not reach the API, and lets the user retry", async () => {
		stubApi({
			"POST /auth/2fa/setup": ok(twoFactorSetupJson(), 201),
			"POST /auth/2fa/enable": ok({ message: "ok" }, 201),
			"POST /auth/refresh": fail(503, "SERVICE_UNAVAILABLE", "down"),
		});
		await renderRestricted(RESTRICTED_MFA, "/enroll-two-factor");

		await fireEvent.press(screen.getByRole("button", { name: "Set up authenticator app" }));
		await fireEvent.changeText(await screen.findByLabelText("Authentication code"), "123456");
		await fireEvent.press(screen.getByRole("button", { name: "Turn on two-factor authentication" }));
		await fireEvent.press(await screen.findByRole("checkbox", { name: "I saved my backup codes" }));
		await fireEvent.press(screen.getByRole("button", { name: "Continue to the app" }));

		expect(await screen.findByText("We couldn't reach the server. Check your connection and try again.")).toBeOnTheScreen();
	});

	it("can sign out instead", async () => {
		stubApi({ "POST /auth/logout": ok({ message: "Logged out successfully" }, 201) });
		const runtime = await renderRestricted(RESTRICTED_MFA, "/enroll-two-factor");

		await act(async (): Promise<void> => {
			await fireEvent.press(screen.getByRole("button", { name: "Sign out" }));
		});

		await waitFor(() => {
			expect(runtime.sessionStore.getState()).toEqual({ status: "signedOut", reason: "signedOut" });
		});
	});
});

describe("Verify your email (restricted session)", () => {
	it("refreshes into a full session once the email is verified", async () => {
		stubApi({ "GET /auth/me": ok(userJson({ isEmailVerified: false })), "POST /auth/refresh": refreshAnswer(FULL) });
		const runtime = await renderRestricted(RESTRICTED_EMAIL, "/verify-email");

		expect(await screen.findByText("Open the verification link we sent to member@example.com on any device, then come back here.")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "I've verified my email" }));

		await waitFor(() => {
			expect(runtime.sessionStore.getState()).toEqual({ status: "signedIn", session: { scope: "full" } });
		});
	});

	it("says so when the email is still unverified, and resends the link", async () => {
		const api = stubApi({
			"GET /auth/me": ok(userJson({ isEmailVerified: false })),
			"POST /auth/refresh": refreshAnswer(RESTRICTED_EMAIL),
			"POST /auth/resend-verification": ok({ message: "sent" }),
		});
		await renderRestricted(RESTRICTED_EMAIL, "/verify-email");

		await fireEvent.press(await screen.findByRole("button", { name: "I've verified my email" }));
		expect(await screen.findByText("Your email isn't verified yet. Open the link we emailed you, then try again.")).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("button", { name: "Send the link again" }));
		expect(await screen.findByText("We sent a new verification link to member@example.com.")).toBeOnTheScreen();
		expect(api.callsTo("POST /auth/resend-verification").at(0)?.body).toBe(JSON.stringify({ email: "member@example.com" }));
	});
});

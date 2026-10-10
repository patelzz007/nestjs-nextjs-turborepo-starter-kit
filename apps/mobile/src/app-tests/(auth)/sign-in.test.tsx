import { APP_VERSION_HEADER, CLIENT_TYPE_HEADER, DEVICE_MODEL_HEADER, DEVICE_NAME_HEADER } from "@workspace/shared";
import { fireEvent, screen, waitFor } from "expo-router/testing-library";

import { fail, ok, stubApi } from "../../../test/api-stub";
import { createTestRuntime, markerScreen, type RenderedApp, renderInApp } from "../../../test/app-harness";
import { mobileLoginJson, userJson } from "../../../test/fixtures";
import { FULL_ACCESS_TOKEN, REFRESH_TOKEN } from "../../../test/jwt";
import { memorySecureStore } from "../../../test/secure-store-memory";
import type { SignedOutReason } from "../../features/session/state";
import SignInScreen from "../../app/(auth)/sign-in";

const SCREENS = {
	"sign-in": SignInScreen,
	"two-factor": markerScreen("two-factor screen"),
	"verify-device": markerScreen("verify-device screen"),
	"forgot-password": markerScreen("forgot-password screen"),
	"sign-up": markerScreen("sign-up screen"),
};

interface SignInView {
	readonly runtime: ReturnType<typeof createTestRuntime>;
	readonly app: RenderedApp;
}

async function renderSignIn(reason: SignedOutReason = "none"): Promise<SignInView> {
	const runtime = createTestRuntime({}, { status: "signedOut", reason });
	const app = await renderInApp(runtime, SCREENS, "/sign-in");
	return { runtime, app };
}

async function fillAndSubmit(email: string, password: string): Promise<void> {
	await fireEvent.changeText(screen.getByLabelText("Email"), email);
	await fireEvent.changeText(screen.getByLabelText("Password"), password);
	await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
}

describe("Sign in screen", () => {
	it("validates with the shared LoginSchema before calling the API", async () => {
		const api = stubApi({});
		await renderSignIn();

		await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));

		expect(await screen.findByText("Invalid email address")).toBeOnTheScreen();
		expect(screen.getByText("Password is required")).toBeOnTheScreen();
		expect(api.calls).toHaveLength(0);
	});

	it("stores the body tokens and reports a full session when the login finishes", async () => {
		const api = stubApi({ "POST /auth/login": ok(mobileLoginJson()) });
		const { runtime } = await renderSignIn();

		await fillAndSubmit("member@example.com", "Secret@123");

		await waitFor(() => {
			expect(runtime.sessionStore.getState()).toEqual({ status: "signedIn", session: { scope: "full" } });
		});
		expect(memorySecureStore.peek("auth.accessToken")).toBe(JSON.stringify(FULL_ACCESS_TOKEN));
		expect(memorySecureStore.peek("auth.refreshToken")).toBe(JSON.stringify(REFRESH_TOKEN));
		const [login] = api.callsTo("POST /auth/login");
		expect(login?.headers).toMatchObject({
			[CLIENT_TYPE_HEADER.toLowerCase()]: "mobile",
			[APP_VERSION_HEADER.toLowerCase()]: "1.0.0",
			[DEVICE_MODEL_HEADER.toLowerCase()]: "iPhone%2015%20Pro",
			[DEVICE_NAME_HEADER.toLowerCase()]: "Alex%E2%80%99s%20iPhone",
		});
		expect(login?.body).toBe(JSON.stringify({ email: "member@example.com", password: "Secret@123" }));
	});

	it("opens the two-factor step with the challenge token", async () => {
		stubApi({ "POST /auth/login": ok({ requiresTwoFactor: true, tempToken: "challenge-1", message: "2FA required" }) });
		const { app } = await renderSignIn();

		await fillAndSubmit("member@example.com", "Secret@123");

		expect(await screen.findByText("two-factor screen")).toBeOnTheScreen();
		expect(app.pathnameWithParams()).toBe("/two-factor?tempToken=challenge-1");
	});

	it("opens the new-device verification step", async () => {
		stubApi({ "POST /auth/login": ok({ requiresVerification: true, verificationId: "verification-1", message: "Check your email" }) });
		const { app } = await renderSignIn();

		await fillAndSubmit("member@example.com", "Secret@123");

		expect(await screen.findByText("verify-device screen")).toBeOnTheScreen();
		expect(app.pathnameWithParams()).toBe("/verify-device?verificationId=verification-1");
	});

	it("shows the API's refusal in friendly words and keeps the device signed out", async () => {
		stubApi({ "POST /auth/login": fail(401, "INVALID_CREDENTIALS", "Invalid credentials") });
		const { runtime } = await renderSignIn();

		await fillAndSubmit("member@example.com", "wrong");

		expect(await screen.findByText("Incorrect email or password. Please try again.")).toBeOnTheScreen();
		expect(runtime.sessionStore.getState()).toEqual({ status: "signedOut", reason: "none" });
		expect(memorySecureStore.peek("auth.accessToken")).toBeNull();
	});

	it("refuses a browser-shaped answer without tokens", async () => {
		stubApi({ "POST /auth/login": ok({ user: userJson() }) });
		await renderSignIn();

		await fillAndSubmit("member@example.com", "Secret@123");

		expect(await screen.findByText("Sign-in could not be completed on this device. Please try again.")).toBeOnTheScreen();
	});

	it("switches to the update screen state on a 426", async () => {
		stubApi({ "POST /auth/login": fail(426, "APP_VERSION_UNSUPPORTED", "Update the app", { reason: "below_minimum", minimumVersion: "2.0.0" }) });
		const { runtime } = await renderSignIn();

		await fillAndSubmit("member@example.com", "Secret@123");

		await waitFor(() => {
			expect(runtime.sessionStore.getState()).toEqual({ status: "upgradeRequired", minimumVersion: "2.0.0" });
		});
	});

	it.each([
		["sessionExpired", "Your session has ended. Please sign in again."],
		["appLockReset", "The biometrics on this device changed, so the app lock was turned off. Sign in with your password to continue."],
		["passwordChanged", "Your password was changed and every device was signed out. Sign in with your new password."],
	] satisfies [SignedOutReason, string][])("explains why the device was signed out (%s)", async (reason, notice) => {
		stubApi({});
		await renderSignIn(reason);

		expect(screen.getByText(notice)).toBeOnTheScreen();
	});

	it("shows no notice on a first visit", async () => {
		stubApi({});
		await renderSignIn("none");

		expect(screen.queryByTestId("signed-out-notice")).toBeNull();
	});

	it("links to forgot password and sign up", async () => {
		stubApi({});
		await renderSignIn();

		await fireEvent.press(screen.getByRole("link", { name: "Forgot password?" }));
		expect(await screen.findByText("forgot-password screen")).toBeOnTheScreen();
	});

	it("links to sign up from the footer", async () => {
		stubApi({});
		await renderSignIn();

		expect(screen.getByText("Don't have an account?")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("link", { name: "Create one" }));
		expect(await screen.findByText("sign-up screen")).toBeOnTheScreen();
	});

	it("offers one-tap demo logins in a development build, filling the form and signing in as that account (ADR 042)", async () => {
		const api = stubApi({ "POST /auth/login": ok(mobileLoginJson()) });
		const { runtime } = await renderSignIn();

		expect(await screen.findByRole("header", { name: "Quick sign-in (development)" })).toBeOnTheScreen();
		for (const label of ["Super Admin", "Admin", "Manager", "KL Owner", "Melaka Owner", "KL Cashier"]) {
			expect(screen.getByRole("button", { name: `Sign in as ${label}` })).toBeOnTheScreen();
		}
		await fireEvent.press(screen.getByRole("button", { name: "Sign in as KL Owner" }));

		await waitFor(() => {
			expect(runtime.sessionStore.getState().status).toBe("signedIn");
		});
		expect(screen.getByLabelText("Email")).toHaveDisplayValue("brew.owner@kl-rewards.demo");
		const [login] = api.callsTo("POST /auth/login");
		expect(login?.body).toBe(JSON.stringify({ email: "brew.owner@kl-rewards.demo", password: "BrewOwner@123" }));
	});

	it("never logs the login response (it carries tokens)", async () => {
		const log = jest.spyOn(console, "log");
		stubApi({ "POST /auth/login": ok(mobileLoginJson()) });
		const { runtime } = await renderSignIn();

		await fillAndSubmit("member@example.com", "Secret@123");

		await waitFor(() => {
			expect(runtime.sessionStore.getState().status).toBe("signedIn");
		});
		expect(log).not.toHaveBeenCalled();
	});
});

import { fireEvent, screen } from "expo-router/testing-library";

import { fail, ok, stubApi } from "../../../test/api-stub";
import { createTestRuntime, markerScreen, renderInApp } from "../../../test/app-harness";
import ForgotPasswordScreen from "../../app/(auth)/forgot-password";
import SignUpScreen from "../../app/(auth)/sign-up";

const SCREENS = { "sign-up": SignUpScreen, "forgot-password": ForgotPasswordScreen, "sign-in": markerScreen("sign-in screen") };

async function open(url: string): Promise<void> {
	await renderInApp(createTestRuntime({}, { status: "signedOut", reason: "none" }), SCREENS, url);
}

describe("Sign up (§10.4)", () => {
	it("creates the account with the shared SignupSchema and confirms by email", async () => {
		const api = stubApi({ "POST /auth/signup": ok({ message: "Account created" }, 201) });
		await open("/sign-up");

		await fireEvent.changeText(screen.getByLabelText("Full name"), "Alex Morgan");
		await fireEvent.changeText(screen.getByLabelText("Email"), "alex@example.com");
		await fireEvent.changeText(screen.getByLabelText("Password"), "Strong@Pass1");
		await fireEvent.press(screen.getByRole("button", { name: "Create account" }));

		expect(await screen.findByText("We sent a verification link to alex@example.com. Open it on any device, then come back and sign in.")).toBeOnTheScreen();
		expect(api.callsTo("POST /auth/signup").at(0)?.body).toBe(JSON.stringify({ email: "alex@example.com", password: "Strong@Pass1", fullName: "Alex Morgan" }));
		await fireEvent.press(screen.getByRole("button", { name: "Back to sign in" }));
		expect(await screen.findByText("sign-in screen")).toBeOnTheScreen();
	});

	it("validates every field before sending", async () => {
		const api = stubApi({});
		await open("/sign-up");

		await fireEvent.changeText(screen.getByLabelText("Password"), "weak");
		await fireEvent.press(screen.getByRole("button", { name: "Create account" }));

		expect(await screen.findByText("Full name must be at least 2 characters")).toBeOnTheScreen();
		expect(screen.getByText("Invalid email address")).toBeOnTheScreen();
		expect(api.calls).toHaveLength(0);
	});

	it("shows the API's refusal", async () => {
		stubApi({ "POST /auth/signup": fail(409, "CONFLICT", "An account with this email already exists") });
		await open("/sign-up");

		await fireEvent.changeText(screen.getByLabelText("Full name"), "Alex Morgan");
		await fireEvent.changeText(screen.getByLabelText("Email"), "alex@example.com");
		await fireEvent.changeText(screen.getByLabelText("Password"), "Strong@Pass1");
		await fireEvent.press(screen.getByRole("button", { name: "Create account" }));

		expect(await screen.findByText("An account with this email already exists")).toBeOnTheScreen();
	});

	it("leads back to sign-in", async () => {
		stubApi({});
		await open("/sign-up");
		await fireEvent.press(screen.getByRole("button", { name: "I already have an account" }));
		expect(await screen.findByText("sign-in screen")).toBeOnTheScreen();
	});
});

describe("Forgot password (§10.6)", () => {
	it("requests the reset email and confirms without saying whether the account exists", async () => {
		const api = stubApi({ "POST /auth/forgot-password": ok({ message: "If an account exists, we sent a link" }) });
		await open("/forgot-password");

		await fireEvent.changeText(screen.getByLabelText("Email"), "alex@example.com");
		await fireEvent.press(screen.getByRole("button", { name: "Send reset link" }));

		expect(
			await screen.findByText("If an account exists for alex@example.com, we sent a reset link. Open it on any device to choose a new password, then come back and sign in."),
		).toBeOnTheScreen();
		expect(api.callsTo("POST /auth/forgot-password")).toHaveLength(1);
	});

	it("validates the email and shows a failed request", async () => {
		stubApi({ "POST /auth/forgot-password": fail(429, "TOO_MANY_REQUESTS", "Too many requests, try again in 60 seconds") });
		await open("/forgot-password");

		await fireEvent.press(screen.getByRole("button", { name: "Send reset link" }));
		expect(await screen.findByText("Invalid email address")).toBeOnTheScreen();

		await fireEvent.changeText(screen.getByLabelText("Email"), "alex@example.com");
		await fireEvent.press(screen.getByRole("button", { name: "Send reset link" }));
		expect(await screen.findByText("Too many requests, try again in 60 seconds")).toBeOnTheScreen();
	});

	it("leads back to sign-in", async () => {
		stubApi({});
		await open("/forgot-password");
		await fireEvent.press(screen.getByRole("button", { name: "Back to sign in" }));
		expect(await screen.findByText("sign-in screen")).toBeOnTheScreen();
	});
});

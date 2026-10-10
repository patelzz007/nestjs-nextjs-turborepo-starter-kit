import { fireEvent, screen } from "expo-router/testing-library";

import { createTestRuntime, renderInApp } from "../../test/app-harness";
import OnboardingScreen from "../app/onboarding";

describe("Onboarding (ADR 041)", () => {
	it("welcomes the reader by the app's name and walks through what the app does", async () => {
		const runtime = createTestRuntime({}, { status: "signedOut", reason: "none" });
		await renderInApp(runtime, { onboarding: OnboardingScreen }, "/onboarding");

		expect(await screen.findByRole("header", { name: "Welcome to Starter" })).toBeOnTheScreen();
		expect(screen.getByRole("header", { name: "Secure by design" })).toBeOnTheScreen();
		expect(screen.getByRole("header", { name: "Made to feel like yours" })).toBeOnTheScreen();
		expect(screen.getByLabelText("Step 1 of 3")).toBeOnTheScreen();
	});

	it("records that onboarding is done when it is skipped", async () => {
		const runtime = createTestRuntime({}, { status: "signedOut", reason: "none" });
		await renderInApp(runtime, { onboarding: OnboardingScreen }, "/onboarding");

		await fireEvent.press(await screen.findByRole("button", { name: "Skip" }));

		expect(runtime.preferencesStore.getState().onboardingCompleted).toBe(true);
	});
});

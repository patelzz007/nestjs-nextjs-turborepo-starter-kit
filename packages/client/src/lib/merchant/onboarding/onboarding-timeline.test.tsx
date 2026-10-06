// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { currentStepIndex, isOnboardingStepDisabled, MerchantOnboardingCompactProgress, MerchantOnboardingTimeline, type OnboardingTimelineStep } from "./onboarding-timeline";

type StepId = "alpha" | "beta" | "gamma";

const STEPS: readonly OnboardingTimelineStep<StepId>[] = [
	{ id: "alpha", label: "Alpha", description: "First step" },
	{ id: "beta", label: "Beta", description: "Second step" },
	{ id: "gamma", label: "Gamma", description: "Third step" },
];

afterEach((): void => {
	cleanup();
});

describe("isOnboardingStepDisabled", () => {
	it("allows earlier steps and the current one, never a later one", (): void => {
		expect([0, 1, 2].map((index) => isOnboardingStepDisabled(index, 1, false))).toEqual([false, false, true]);
	});

	it("locks every step but the current one while navigation is disabled", (): void => {
		expect([0, 1, 2].map((index) => isOnboardingStepDisabled(index, 1, true))).toEqual([true, false, true]);
	});
});

describe("currentStepIndex", () => {
	it("finds the current step's position", (): void => {
		expect(currentStepIndex(STEPS, "gamma")).toBe(2);
	});

	it("falls back to the first step for an id that is not in the list", (): void => {
		expect(currentStepIndex(STEPS.slice(1), "alpha")).toBe(0);
	});
});

function stepStates(): (string | undefined)[] {
	return Array.from(document.querySelectorAll<HTMLElement>('[data-slot="stepper-item"]')).map((item) => item.dataset.state);
}

describe("MerchantOnboardingTimeline", () => {
	it("lists every step with its description and marks progress through them", (): void => {
		render(<MerchantOnboardingTimeline steps={STEPS} currentStepId="beta" onStepSelect={vi.fn<(stepId: StepId) => void>()} />);
		const nav = screen.getByRole("tablist", { name: "Application steps" });
		expect(within(nav).getAllByRole("tab")).toHaveLength(STEPS.length);
		expect(screen.getByText("Third step")).toBeTruthy();
		expect(stepStates()).toEqual(["completed", "active", "inactive"]);
		expect(screen.getByRole("tab", { name: /Beta/ }).getAttribute("aria-selected")).toBe("true");
	});

	it("reports progress as the share of completed steps", (): void => {
		render(<MerchantOnboardingTimeline steps={STEPS} currentStepId="gamma" onStepSelect={vi.fn<(stepId: StepId) => void>()} />);
		const progress = screen.getByRole("progressbar");
		expect(progress.getAttribute("aria-valuenow")).toBe("2");
		expect(progress.getAttribute("aria-valuemax")).toBe(String(STEPS.length));
	});

	it("goes back to a completed step but never forward", (): void => {
		const handleStepSelect = vi.fn<(stepId: StepId) => void>();
		render(<MerchantOnboardingTimeline steps={STEPS} currentStepId="beta" onStepSelect={handleStepSelect} />);
		const gamma = screen.getByRole("tab", { name: /Gamma/ });
		expect(gamma.hasAttribute("disabled")).toBe(true);
		fireEvent.click(gamma);
		fireEvent.click(screen.getByRole("tab", { name: /Beta/ }));
		expect(handleStepSelect).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("tab", { name: /Alpha/ }));
		expect(handleStepSelect).toHaveBeenCalledExactlyOnceWith("alpha");
	});

	it("locks going back while navigation is disabled", (): void => {
		const handleStepSelect = vi.fn<(stepId: StepId) => void>();
		render(<MerchantOnboardingTimeline steps={STEPS} currentStepId="gamma" onStepSelect={handleStepSelect} isNavigationDisabled />);
		for (const name of [/Alpha/, /Beta/]) {
			const tab = screen.getByRole("tab", { name });
			expect(tab.hasAttribute("disabled")).toBe(true);
			fireEvent.click(tab);
		}
		expect(handleStepSelect).not.toHaveBeenCalled();
	});
});

describe("MerchantOnboardingCompactProgress", () => {
	it("renders the same steps horizontally, names kept for assistive technology", (): void => {
		render(<MerchantOnboardingCompactProgress steps={STEPS} currentStepId="beta" onStepSelect={vi.fn<(stepId: StepId) => void>()} />);
		const nav = screen.getByRole("tablist", { name: "Application steps" });
		expect(nav.dataset.orientation).toBe("horizontal");
		expect(
			within(nav)
				.getAllByRole("tab")
				.map((tab) => tab.textContent),
		).toEqual(["AlphaFirst step", "2BetaSecond step", "3GammaThird step"]);
	});
});

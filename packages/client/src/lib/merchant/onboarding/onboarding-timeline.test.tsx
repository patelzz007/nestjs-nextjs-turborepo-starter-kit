// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { currentStepIndex, MerchantOnboardingCompactProgress, MerchantOnboardingTimeline, onboardingStepStatus, type OnboardingTimelineStep } from "./onboarding-timeline";

type StepId = "alpha" | "beta" | "gamma";

const STEPS: readonly OnboardingTimelineStep<StepId>[] = [
	{ id: "alpha", label: "Alpha", description: "First step" },
	{ id: "beta", label: "Beta", description: "Second step" },
	{ id: "gamma", label: "Gamma", description: "Third step" },
];

afterEach((): void => {
	cleanup();
});

describe("onboardingStepStatus", () => {
	it("marks earlier steps complete, the current one current and later ones upcoming", (): void => {
		expect([0, 1, 2].map((index) => onboardingStepStatus(index, 1))).toEqual(["complete", "current", "upcoming"]);
	});

	it("has no complete steps on the first step", (): void => {
		expect([0, 1, 2].map((index) => onboardingStepStatus(index, 0))).toEqual(["current", "upcoming", "upcoming"]);
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

describe("MerchantOnboardingTimeline", () => {
	it("lists every step with its description and marks the current one", (): void => {
		render(<MerchantOnboardingTimeline steps={STEPS} currentStepId="beta" onStepSelect={vi.fn<(stepId: StepId) => void>()} />);
		const items = within(screen.getByRole("list", { name: "Application steps" })).getAllByRole("listitem");
		expect(items).toHaveLength(STEPS.length);
		expect(screen.getByText("Third step")).toBeTruthy();
		expect(items.map((item) => item.getAttribute("aria-current"))).toEqual([null, "step", null]);
	});

	it("reports progress as the share of completed steps", (): void => {
		render(<MerchantOnboardingTimeline steps={STEPS} currentStepId="gamma" onStepSelect={vi.fn<(stepId: StepId) => void>()} />);
		const progress = screen.getByRole("progressbar");
		expect(progress.getAttribute("aria-valuenow")).toBe("2");
		expect(progress.getAttribute("aria-valuemax")).toBe(String(STEPS.length));
	});

	it("only lets the user go back to completed steps", (): void => {
		const handleStepSelect = vi.fn<(stepId: StepId) => void>();
		render(<MerchantOnboardingTimeline steps={STEPS} currentStepId="beta" onStepSelect={handleStepSelect} />);
		const buttons = screen.getAllByRole("button");
		expect(buttons).toHaveLength(1);
		const [backToAlpha] = buttons;
		expect(backToAlpha?.textContent).toContain("Alpha");
		if (backToAlpha !== undefined) {
			fireEvent.click(backToAlpha);
		}
		expect(handleStepSelect).toHaveBeenCalledExactlyOnceWith("alpha");
	});

	it("locks going back while navigation is disabled", (): void => {
		const handleStepSelect = vi.fn<(stepId: StepId) => void>();
		render(<MerchantOnboardingTimeline steps={STEPS} currentStepId="gamma" onStepSelect={handleStepSelect} isNavigationDisabled />);
		const buttons = screen.getAllByRole("button");
		expect(buttons.every((button) => button.hasAttribute("disabled"))).toBe(true);
		for (const button of buttons) {
			fireEvent.click(button);
		}
		expect(handleStepSelect).not.toHaveBeenCalled();
	});
});

describe("MerchantOnboardingCompactProgress", () => {
	it("renders a horizontal, non-interactive step list with named steps", (): void => {
		render(<MerchantOnboardingCompactProgress steps={STEPS} currentStepId="beta" />);
		const list = screen.getByRole("list", { name: "Application steps" });
		expect(list.dataset.orientation).toBe("horizontal");
		expect(screen.queryAllByRole("button")).toHaveLength(0);
		expect(screen.getByText("Alpha (completed)")).toBeTruthy();
		expect(screen.getByText("Beta (current step)")).toBeTruthy();
		expect(screen.getByText("Gamma")).toBeTruthy();
	});
});

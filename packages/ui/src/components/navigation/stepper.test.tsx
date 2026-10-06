// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Stepper, StepperContent, StepperDescription, StepperIndicator, StepperItem, StepperStep, StepperTitle, StepperTrigger, type StepperItemStatus } from "./stepper";

afterEach((): void => {
	cleanup();
});

interface FixtureStep {
	readonly id: string;
	readonly title: string;
	readonly status: StepperItemStatus;
}

const STEPS: readonly FixtureStep[] = [
	{ id: "one", title: "First", status: "complete" },
	{ id: "two", title: "Second", status: "current" },
	{ id: "three", title: "Third", status: "upcoming" },
];

function renderSteps(orientation: "vertical" | "horizontal" = "vertical"): void {
	render(
		<Stepper aria-label="Progress" orientation={orientation}>
			{STEPS.map((step) => (
				<StepperItem key={step.id} status={step.status}>
					<StepperStep>
						<StepperIndicator>{step.id}</StepperIndicator>
						<StepperContent>
							<StepperTitle>{step.title}</StepperTitle>
							<StepperDescription>{`${step.title} description`}</StepperDescription>
						</StepperContent>
					</StepperStep>
				</StepperItem>
			))}
		</Stepper>,
	);
}

describe("Stepper", () => {
	it("renders an ordered list with one list item per step", (): void => {
		renderSteps();
		const list = screen.getByRole("list", { name: "Progress" });
		expect(list.tagName).toBe("OL");
		expect(screen.getAllByRole("listitem")).toHaveLength(STEPS.length);
	});

	it("marks only the current step with aria-current=step", (): void => {
		renderSteps();
		const items = screen.getAllByRole("listitem");
		expect(items.map((item) => item.getAttribute("aria-current"))).toEqual([null, "step", null]);
	});

	it("exposes each step's status as data-status for styling", (): void => {
		renderSteps();
		const items = screen.getAllByRole("listitem");
		expect(items.map((item) => item.dataset.status)).toEqual(["complete", "current", "upcoming"]);
	});

	it.each(["vertical", "horizontal"] satisfies ("vertical" | "horizontal")[])("reflects the %s orientation on the root", (orientation): void => {
		renderSteps(orientation);
		expect(screen.getByRole("list").dataset.orientation).toBe(orientation);
	});

	it("hides the indicator from assistive technology so the title carries the name", (): void => {
		renderSteps();
		expect(screen.getByText("one").getAttribute("aria-hidden")).toBe("true");
		expect(screen.getByText("First")).toBeTruthy();
	});

	it("sets the indicator size through the size variant", (): void => {
		render(<Stepper aria-label="Small" size="sm" />);
		expect(screen.getByRole("list").className).toContain("[--stepper-indicator-size:--spacing(6)]");
	});
});

describe("StepperTrigger", () => {
	it("is a non-submitting button that calls onClick", (): void => {
		const handleClick = vi.fn<() => void>();
		render(
			<Stepper aria-label="Progress">
				<StepperItem status="complete">
					<StepperTrigger onClick={handleClick}>
						<StepperTitle>Revisit</StepperTitle>
					</StepperTrigger>
				</StepperItem>
			</Stepper>,
		);
		const trigger = screen.getByRole("button", { name: "Revisit" });
		expect(trigger.getAttribute("type")).toBe("button");
		fireEvent.click(trigger);
		expect(handleClick).toHaveBeenCalledTimes(1);
	});

	it("forwards its ref to the button element", (): void => {
		const ref = React.createRef<HTMLButtonElement>();
		render(<StepperTrigger ref={ref}>Go</StepperTrigger>);
		expect(ref.current?.tagName).toBe("BUTTON");
	});
});

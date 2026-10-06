// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	Stepper,
	StepperContent,
	StepperDescription,
	StepperIndicator,
	StepperItem,
	StepperNav,
	StepperPanel,
	StepperSeparator,
	StepperTitle,
	StepperTrigger,
	type StepIndicators,
} from "./stepper";

afterEach((): void => {
	cleanup();
});

const STEP_TITLES: readonly string[] = ["First", "Second", "Third"];

interface FixtureProps {
	readonly value: number;
	readonly onValueChange?: (value: number) => void;
	readonly indicators?: StepIndicators;
	readonly disabledStep?: number;
	readonly loadingStep?: number;
}

function Fixture({ value, onValueChange, indicators, disabledStep, loadingStep }: FixtureProps): React.JSX.Element {
	return (
		<Stepper value={value} onValueChange={onValueChange} orientation="vertical" indicators={indicators}>
			<StepperNav aria-label="Progress">
				{STEP_TITLES.map((title, index) => (
					<StepperItem key={title} step={index + 1} disabled={disabledStep === index + 1} loading={loadingStep === index + 1}>
						<StepperTrigger>
							<StepperIndicator>{index + 1}</StepperIndicator>
							<StepperTitle>{title}</StepperTitle>
							<StepperDescription>{`${title} description`}</StepperDescription>
						</StepperTrigger>
						{index < STEP_TITLES.length - 1 ? <StepperSeparator /> : null}
					</StepperItem>
				))}
			</StepperNav>
			<StepperPanel>
				{STEP_TITLES.map((title, index) => (
					<StepperContent key={title} value={index + 1}>{`${title} content`}</StepperContent>
				))}
			</StepperPanel>
		</Stepper>
	);
}

function items(): HTMLElement[] {
	return Array.from(document.querySelectorAll<HTMLElement>('[data-slot="stepper-item"]'));
}

describe("Stepper", () => {
	it("renders a labelled tablist with one tab per step", (): void => {
		render(<Fixture value={2} />);
		expect(screen.getByRole("tablist", { name: "Progress" }).dataset.orientation).toBe("vertical");
		expect(screen.getAllByRole("tab")).toHaveLength(STEP_TITLES.length);
	});

	it("derives each step's state from the controlled value", (): void => {
		render(<Fixture value={2} />);
		expect(items().map((item) => item.dataset.state)).toEqual(["completed", "active", "inactive"]);
	});

	it("selects only the active tab and keeps it as the single tab stop", (): void => {
		render(<Fixture value={2} />);
		const tabs = screen.getAllByRole("tab");
		expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual(["false", "true", "false"]);
		expect(tabs.map((tab) => tab.tabIndex)).toEqual([-1, 0, -1]);
	});

	it("shows only the active step's panel, labelled by its tab", (): void => {
		render(<Fixture value={2} />);
		const panel = screen.getByRole("tabpanel");
		expect(panel.textContent).toBe("Second content");
		expect(panel.getAttribute("aria-labelledby")).toBe(screen.getByRole("tab", { name: /Second/ }).id);
	});

	it("asks the parent for a step instead of changing it itself", (): void => {
		const handleValueChange = vi.fn<(value: number) => void>();
		render(<Fixture value={2} onValueChange={handleValueChange} />);
		fireEvent.click(screen.getByRole("tab", { name: /First/ }));
		expect(handleValueChange).toHaveBeenCalledExactlyOnceWith(1);
		expect(items()[1]?.dataset.state).toBe("active");
	});

	it("disables a step's trigger", (): void => {
		const handleValueChange = vi.fn<(value: number) => void>();
		render(<Fixture value={1} onValueChange={handleValueChange} disabledStep={3} />);
		const third = screen.getByRole("tab", { name: /Third/ });
		expect(third.hasAttribute("disabled")).toBe(true);
		fireEvent.click(third);
		expect(handleValueChange).not.toHaveBeenCalled();
	});

	it("replaces indicator content per state with the root's indicators", (): void => {
		render(<Fixture value={2} loadingStep={2} indicators={{ completed: "done", loading: "busy" }} />);
		const indicators = Array.from(document.querySelectorAll('[data-slot="stepper-indicator"]')).map((indicator) => indicator.textContent);
		expect(indicators).toEqual(["done", "busy", "3"]);
	});

	it("moves focus between enabled triggers with the arrow keys, wrapping at the ends", (): void => {
		render(<Fixture value={1} />);
		const [first, second, third] = screen.getAllByRole("tab");
		first?.focus();
		if (first !== undefined) fireEvent.keyDown(first, { key: "ArrowDown" });
		expect(document.activeElement).toBe(second);
		if (second !== undefined) fireEvent.keyDown(second, { key: "End" });
		expect(document.activeElement).toBe(third);
		if (third !== undefined) fireEvent.keyDown(third, { key: "ArrowDown" });
		expect(document.activeElement).toBe(first);
	});

	it("gives two steppers on one page distinct tab ids", (): void => {
		render(
			<>
				<Fixture value={1} />
				<Fixture value={1} />
			</>,
		);
		const ids = screen.getAllByRole("tab").map((tab) => tab.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("forwards refs to the trigger button", (): void => {
		const ref = React.createRef<HTMLButtonElement>();
		render(
			<Stepper value={1}>
				<StepperNav>
					<StepperItem step={1}>
						<StepperTrigger ref={ref}>Go</StepperTrigger>
					</StepperItem>
				</StepperNav>
			</Stepper>,
		);
		expect(ref.current?.tagName).toBe("BUTTON");
	});

	it("sizes the indicator through its size variant", (): void => {
		render(
			<Stepper value={1}>
				<StepperNav>
					<StepperItem step={1}>
						<StepperIndicator size="md">1</StepperIndicator>
					</StepperItem>
				</StepperNav>
			</Stepper>,
		);
		expect(document.querySelector('[data-slot="stepper-indicator"]')?.className).toContain("size-8");
	});
});

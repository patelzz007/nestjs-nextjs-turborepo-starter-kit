import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { Stepper, stepStateFor, type StepState, type StepperStep } from "../stepper";

const STEPS: readonly StepperStep[] = [
	{ key: "details", title: "Details" },
	{ key: "shipping", title: "Shipping", description: "Where it goes" },
	{ key: "payment", title: "Payment", disabled: true },
	{ key: "review", title: "Review" },
];

function shortStepLabel(step: number, stepCount: number, title: string): string {
	return `${title} (${String(step)}/${String(stepCount)})`;
}

const GERMAN_STATE_LABELS: Readonly<Record<StepState, string>> = { completed: "erledigt", active: "aktuell", inactive: "offen" };

const SHIPPING = 2;
const PAYMENT = 3;
const REVIEW = 4;

describe("stepStateFor", () => {
	it("marks earlier steps completed, the active one active and later ones inactive", () => {
		expect(stepStateFor(1, SHIPPING, false)).toBe("completed");
		expect(stepStateFor(SHIPPING, SHIPPING, false)).toBe("active");
		expect(stepStateFor(PAYMENT, SHIPPING, false)).toBe("inactive");
		expect(stepStateFor(REVIEW, SHIPPING, true)).toBe("completed");
	});
});

describe("Stepper", () => {
	it("reads each step's position, title and state, as tabs when it can be changed", async () => {
		const onChange = jest.fn();
		await render(<Stepper steps={STEPS} value={SHIPPING} onChange={onChange} accessibilityLabel="Checkout progress" testID="stepper" />);

		expect(screen.getByTestId("stepper")).toHaveAccessibleName("Checkout progress");
		expect(screen.getByRole("tab", { name: "Step 1 of 4: Details, completed" })).toBeOnTheScreen();
		expect(screen.getByRole("tab", { name: "Step 2 of 4: Shipping, current" })).toBeSelected();
		expect(screen.getByRole("tab", { name: "Step 4 of 4: Review, upcoming" })).not.toBeSelected();
		expect(screen.getByText("Where it goes")).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("tab", { name: "Step 1 of 4: Details, completed" }));
		expect(onChange).toHaveBeenCalledWith(1);
	});

	it("blocks a disabled step, and every step while disabled or loading", async () => {
		const onChange = jest.fn();
		await render(<Stepper steps={STEPS} value={SHIPPING} onChange={onChange} />);
		const payment = screen.getByRole("tab", { name: "Step 3 of 4: Payment, upcoming" });
		expect(payment).toBeDisabled();
		await fireEvent.press(payment);
		expect(onChange).not.toHaveBeenCalled();

		await render(<Stepper steps={STEPS} value={SHIPPING} onChange={onChange} loading />);
		const active = screen.getByRole("tab", { name: "Step 2 of 4: Shipping, current" });
		expect(active).toBeBusy();
		expect(screen.getByRole("tab", { name: "Step 1 of 4: Details, completed" })).toBeDisabled();

		await render(<Stepper steps={STEPS} value={SHIPPING} onChange={onChange} disabled loading testID="stepper" />);
		expect(screen.getByTestId("stepper")).toHaveProp("className", expect.stringContaining("opacity-60"));
	});

	it("is a read-only progress display without onChange", async () => {
		await render(<Stepper steps={STEPS} value={PAYMENT} orientation="vertical" size="sm" />);

		expect(screen.queryByRole("tab")).toBeNull();
		expect(screen.getByLabelText("Step 3 of 4: Payment, current")).toBeOnTheScreen();
		expect(screen.getByText("Payment")).toHaveProp("className", expect.stringContaining("text-xs"));
	});

	it("takes overridden copy", async () => {
		await render(<Stepper steps={STEPS} value={1} formatStepLabel={shortStepLabel} stateLabels={GERMAN_STATE_LABELS} />);

		expect(screen.getByLabelText("Details (1/4), aktuell")).toBeOnTheScreen();
		expect(screen.getByLabelText("Review (4/4), offen")).toBeOnTheScreen();
	});

	it("forwards its ref and merges className last", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<Stepper ref={ref} steps={STEPS} value={1} className="gap-4" testID="stepper" />);

		expect(ref.current).not.toBeNull();
		const className = String(screen.getByTestId("stepper").props.className);
		expect(className).toContain("gap-4");
		expect(className).not.toContain("gap-2");
	});
});

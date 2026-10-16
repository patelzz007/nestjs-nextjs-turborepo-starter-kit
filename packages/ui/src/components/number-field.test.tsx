// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NumberField, NumberFieldDecrement, NumberFieldGroup, NumberFieldIncrement, NumberFieldInput, NumberFieldScrubArea } from "./number-field";
import { UiKitTestProviders } from "../testing/ui-kit-test-providers";

afterEach((): void => {
	cleanup();
});

interface FixtureProps {
	readonly value?: number | null;
	readonly defaultValue?: number;
	readonly onValueChange?: (value: number | null) => void;
	readonly disabled?: boolean;
	readonly invalid?: boolean;
	readonly size?: "sm" | "default" | "lg";
}

function Fixture({ value, defaultValue, onValueChange, disabled, invalid, size }: FixtureProps): React.JSX.Element {
	return (
		<NumberField value={value} defaultValue={defaultValue} onValueChange={onValueChange} disabled={disabled} aria-invalid={invalid} size={size}>
			<NumberFieldScrubArea label="Quantity" />
			<NumberFieldGroup>
				<NumberFieldDecrement />
				<NumberFieldInput />
				<NumberFieldIncrement />
			</NumberFieldGroup>
		</NumberField>
	);
}

describe("NumberField", () => {
	it("labels the input from the scrub area and names the stepper buttons from the kit labels", (): void => {
		render(<Fixture defaultValue={3} />, { wrapper: UiKitTestProviders });
		const input = screen.getByRole("textbox", { name: "Quantity" });
		expect(input).toHaveProperty("value", "3");
		expect(screen.getByRole("button", { name: "Increase" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Decrease" })).toBeTruthy();
	});

	it("steps an uncontrolled value and reports it through onValueChange", (): void => {
		const onValueChange = vi.fn();
		render(<Fixture defaultValue={3} onValueChange={onValueChange} />, { wrapper: UiKitTestProviders });
		fireEvent.click(screen.getByRole("button", { name: "Increase" }));
		expect(onValueChange).toHaveBeenLastCalledWith(4, expect.anything());
		expect(screen.getByRole("textbox")).toHaveProperty("value", "4");
		fireEvent.click(screen.getByRole("button", { name: "Decrease" }));
		expect(screen.getByRole("textbox")).toHaveProperty("value", "3");
	});

	it("follows a controlled value", (): void => {
		const onValueChange = vi.fn();
		const { rerender } = render(<Fixture value={5} onValueChange={onValueChange} />, { wrapper: UiKitTestProviders });
		fireEvent.click(screen.getByRole("button", { name: "Increase" }));
		expect(onValueChange).toHaveBeenLastCalledWith(6, expect.anything());
		expect(screen.getByRole("textbox")).toHaveProperty("value", "5");
		rerender(<Fixture value={9} onValueChange={onValueChange} />);
		expect(screen.getByRole("textbox")).toHaveProperty("value", "9");
	});

	it("applies the disabled state to the group and disables the controls", (): void => {
		const { container } = render(<Fixture defaultValue={1} disabled />, { wrapper: UiKitTestProviders });
		const group = container.querySelector<HTMLElement>('[data-slot="number-field-group"]');
		expect(group?.className).toContain("cursor-not-allowed");
		expect(screen.getByRole("textbox")).toHaveProperty("disabled", true);
		expect(screen.getByRole("button", { name: "Increase" })).toHaveProperty("disabled", true);
	});

	it("marks the group and the input invalid for aria-invalid", (): void => {
		const { container } = render(<Fixture defaultValue={1} invalid />, { wrapper: UiKitTestProviders });
		const group = container.querySelector<HTMLElement>('[data-slot="number-field-group"]');
		expect(group?.getAttribute("aria-invalid")).toBe("true");
		expect(group?.className).toContain("border-destructive");
		expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe("true");
	});

	it("sizes every part from the root size", (): void => {
		const { container } = render(<Fixture defaultValue={1} size="lg" />, { wrapper: UiKitTestProviders });
		expect(container.querySelector('[data-slot="number-field"]')?.getAttribute("data-size")).toBe("lg");
		expect(container.querySelector('[data-slot="number-field-group"]')?.className).toContain("h-10");
		expect(screen.getByRole("button", { name: "Increase" }).className).toContain("px-3");
	});

	it("reads copy overrides from labels", (): void => {
		render(
			<NumberField labels={{ increment: "Plus" }}>
				<NumberFieldGroup>
					<NumberFieldInput aria-label="Count" />
					<NumberFieldIncrement />
				</NumberFieldGroup>
			</NumberField>,
			{ wrapper: UiKitTestProviders },
		);
		expect(screen.getByRole("button", { name: "Plus" })).toBeTruthy();
	});

	it("throws for a part outside a NumberField", (): void => {
		expect((): void => {
			render(<NumberFieldInput />, { wrapper: UiKitTestProviders });
		}).toThrow("NumberFieldInput must be used within a NumberField component.");
	});

	it("forwards every part's ref and merges className", (): void => {
		const rootRef = React.createRef<HTMLDivElement>();
		const groupRef = React.createRef<HTMLDivElement>();
		const inputRef = React.createRef<HTMLInputElement>();
		const incrementRef = React.createRef<HTMLButtonElement>();
		const decrementRef = React.createRef<HTMLButtonElement>();
		render(
			<NumberField ref={rootRef} className="max-w-40">
				<NumberFieldGroup ref={groupRef} className="shadow-none">
					<NumberFieldDecrement ref={decrementRef} />
					<NumberFieldInput ref={inputRef} aria-label="Count" className="font-mono" />
					<NumberFieldIncrement ref={incrementRef} />
				</NumberFieldGroup>
			</NumberField>,
			{ wrapper: UiKitTestProviders },
		);
		expect(rootRef.current?.className).toContain("max-w-40");
		expect(groupRef.current?.className).toContain("shadow-none");
		expect(inputRef.current?.className).toContain("font-mono");
		expect(incrementRef.current?.dataset.slot).toBe("number-field-increment");
		expect(decrementRef.current?.dataset.slot).toBe("number-field-decrement");
	});
});

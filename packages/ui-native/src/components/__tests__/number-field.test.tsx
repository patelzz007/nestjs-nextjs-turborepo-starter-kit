import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { TextInputInstance } from "react-native";

import { clampToStep, NumberField, parseNumberText } from "../number-field";

describe("clampToStep and parseNumberText", () => {
	it("snap a value to the step from the minimum, within the bounds, without floating noise", () => {
		expect(clampToStep(7, 0, 100, 5)).toBe(5);
		expect(clampToStep(8, 0, 100, 5)).toBe(10);
		expect(clampToStep(140, 0, 100, 5)).toBe(100);
		expect(clampToStep(-3, 0, undefined, 1)).toBe(0);
		expect(clampToStep(0.30000000000000004, undefined, undefined, 0.1)).toBe(0.3);
	});

	it("read a typed text as a number, or nothing", () => {
		expect(parseNumberText(" 1,250 ")).toBe(1250);
		expect(parseNumberText("")).toBeNull();
		expect(parseNumberText("abc")).toBeNull();
	});
});

/** A price in whole dollars. */
function asDollars(value: number): string {
	return `$${String(value)}`;
}

describe("NumberField", () => {
	it("steps the value with its buttons, within its bounds", async () => {
		const onChange = jest.fn();
		const view = await render(<NumberField value={9} onChange={onChange} max={10} accessibilityLabel="Quantity" />);
		await fireEvent.press(screen.getByRole("button", { name: "Increase" }));
		expect(onChange).toHaveBeenLastCalledWith(10);
		await fireEvent.press(screen.getByRole("button", { name: "Decrease" }));
		expect(onChange).toHaveBeenLastCalledWith(8);

		await view.rerender(<NumberField value={10} onChange={onChange} max={10} accessibilityLabel="Quantity" />);
		expect(screen.getByRole("button", { name: "Increase" })).toBeDisabled();
	});

	it("reads a typed value when it loses focus, clamped and stepped, and clears on an empty text", async () => {
		const onChange = jest.fn();
		await render(<NumberField value={5} onChange={onChange} min={0} max={50} step={5} accessibilityLabel="Amount" testID="field" />);
		const input = screen.getByTestId("field");
		await fireEvent(input, "focus");
		await fireEvent.changeText(input, "23");
		await fireEvent(input, "blur");
		expect(onChange).toHaveBeenLastCalledWith(25);
		await fireEvent(input, "focus");
		await fireEvent.changeText(input, "");
		await fireEvent(input, "blur");
		expect(onChange).toHaveBeenLastCalledWith(null);
	});

	it("is adjustable for screen readers, with its value and bounds", async () => {
		const onChange = jest.fn();
		await render(<NumberField value={3} onChange={onChange} min={0} max={9} accessibilityLabel="Guests" testID="field" />);
		const input = screen.getByTestId("field");
		expect(input).toHaveProp("accessibilityValue", { now: 3, min: 0, max: 9, text: "3" });
		await fireEvent(input, "accessibilityAction", { nativeEvent: { actionName: "increment" } });
		expect(onChange).toHaveBeenLastCalledWith(4);
		await fireEvent(input, "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
		expect(onChange).toHaveBeenLastCalledWith(2);
	});

	it("shows the formatted value, and its steppers as a spinner", async () => {
		await render(<NumberField value={20} onChange={jest.fn()} formatValue={asDollars} layout="spinner" accessibilityLabel="Price" testID="field" />);
		expect(screen.getByTestId("field")).toHaveProp("value", "$20");
		expect(screen.getAllByRole("button")).toHaveLength(2);
	});

	it("takes no input while disabled, and forwards its ref", async () => {
		const ref = React.createRef<TextInputInstance>();
		await render(<NumberField ref={ref} value={1} onChange={jest.fn()} disabled accessibilityLabel="Count" testID="field" />);
		expect(screen.getByTestId("field")).toHaveProp("editable", false);
		expect(screen.getByRole("button", { name: "Increase" })).toBeDisabled();
		expect(ref.current).not.toBeNull();
	});
});

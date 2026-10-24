import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { TextInputInstance } from "react-native";

import { Field } from "../field";
import { InputOTP } from "../input-otp";

function digitsOnly(value: string): string {
	return value.replace(/\D/gu, "");
}

describe("InputOTP", () => {
	it("is one accessible input drawn as one cell per character", async () => {
		await render(<InputOTP accessibilityLabel="Verification code" value="12" onChange={jest.fn()} length={4} testID="otp" />);

		const input = screen.getByLabelText("Verification code");
		expect(input).toHaveDisplayValue("12");
		expect(input).toHaveProp("maxLength", 4);
		expect(input).toHaveProp("textContentType", "oneTimeCode");
		expect(screen.getAllByTestId("otp-cell", { includeHiddenElements: true })).toHaveLength(4);
		expect(screen.getByText("1", { includeHiddenElements: true })).toBeOnTheScreen();
		expect(screen.getByText("2", { includeHiddenElements: true })).toBeOnTheScreen();
	});

	it("reports changes, shaped and cut to its length, and completion", async () => {
		const onChange = jest.fn();
		const onComplete = jest.fn();
		await render(<InputOTP accessibilityLabel="Code" value="" onChange={onChange} onComplete={onComplete} length={4} normalize={digitsOnly} />);

		await fireEvent.changeText(screen.getByLabelText("Code"), "1a2");
		expect(onChange).toHaveBeenLastCalledWith("12");
		expect(onComplete).not.toHaveBeenCalled();

		await fireEvent.changeText(screen.getByLabelText("Code"), "123456");
		expect(onChange).toHaveBeenLastCalledWith("1234");
		expect(onComplete).toHaveBeenCalledWith("1234");
	});

	it("reports focus and blur, and marks the next cell while focused", async () => {
		const onFocus = jest.fn();
		const onBlur = jest.fn();
		await render(<InputOTP accessibilityLabel="Code" value="1" onChange={jest.fn()} onFocus={onFocus} onBlur={onBlur} length={3} testID="otp" />);

		await fireEvent(screen.getByLabelText("Code"), "focus");
		expect(onFocus).toHaveBeenCalledTimes(1);
		const [first, second] = screen.getAllByTestId("otp-cell", { includeHiddenElements: true });
		expect(first).not.toHaveProp("className", expect.stringContaining("border-ring"));
		expect(second).toHaveProp("className", expect.stringContaining("border-ring"));
		await fireEvent(screen.getByLabelText("Code"), "blur");
		expect(onBlur).toHaveBeenCalledTimes(1);
	});

	it("follows the state precedence", async () => {
		await render(<InputOTP accessibilityLabel="Code" value="" onChange={jest.fn()} length={2} invalid testID="otp" />);
		const [cell] = screen.getAllByTestId("otp-cell", { includeHiddenElements: true });
		expect(cell).toHaveProp("className", expect.stringContaining("border-destructive"));

		await render(<InputOTP accessibilityLabel="Code" value="" onChange={jest.fn()} length={2} invalid loading testID="otp" />);
		expect(screen.getByLabelText("Code")).toBeBusy();
		expect(screen.getByLabelText("Code")).toHaveProp("editable", false);
		const [busyCell] = screen.getAllByTestId("otp-cell", { includeHiddenElements: true });
		expect(busyCell).not.toHaveProp("className", expect.stringContaining("border-destructive"));
	});

	it("takes its name and error from an enclosing field", async () => {
		await render(
			<Field label="Authentication code" error="Wrong code">
				<InputOTP value="" onChange={jest.fn()} />
			</Field>,
		);

		expect(screen.getByLabelText("Authentication code")).toBeOnTheScreen();
		expect(screen.getByRole("alert")).toHaveTextContent("Wrong code");
	});

	it("forwards its ref and merges the caller's className last", async () => {
		const ref = React.createRef<TextInputInstance>();
		await render(<InputOTP ref={ref} accessibilityLabel="Code" value="" onChange={jest.fn()} className="justify-center gap-4" />);

		expect(ref.current).not.toBeNull();
		const className = String(screen.getByLabelText("Code").parent?.props.className);
		expect(className).toContain("justify-center");
		expect(className).toContain("gap-4");
		expect(className).not.toContain("gap-2");
	});
});

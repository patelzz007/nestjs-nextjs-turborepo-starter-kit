import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { TextInput } from "react-native";

import { Input, inputVariants } from "../input";

function digitsOnly(value: string): string {
	return value.replace(/\D/gu, "");
}

/** The input's visible box: the `View` around the `TextInput`. */
function boxClassName(label: string): string {
	return String(screen.getByLabelText(label).parent?.props.className);
}

describe("Input", () => {
	it("is named by its accessibility label, shows its value and reports changes", async () => {
		const onChange = jest.fn();
		await render(<Input accessibilityLabel="Email" value="a@example.com" onChange={onChange} />);

		const input = screen.getByLabelText("Email");
		expect(input).toHaveDisplayValue("a@example.com");
		await fireEvent.changeText(input, "b@example.com");
		expect(onChange).toHaveBeenCalledWith("b@example.com");
	});

	it("shapes the text before reporting it", async () => {
		const onChange = jest.fn();
		await render(<Input accessibilityLabel="Code" value="" onChange={onChange} normalize={digitsOnly} />);

		await fireEvent.changeText(screen.getByLabelText("Code"), "12a3");
		expect(onChange).toHaveBeenCalledWith("123");
	});

	it("reports focus and blur, and shows focus on its border", async () => {
		const onFocus = jest.fn();
		const onBlur = jest.fn();
		await render(<Input accessibilityLabel="Name" value="" onChange={jest.fn()} onFocus={onFocus} onBlur={onBlur} />);

		await fireEvent(screen.getByLabelText("Name"), "focus");
		expect(onFocus).toHaveBeenCalledTimes(1);
		expect(boxClassName("Name")).toContain("border-ring");
		await fireEvent(screen.getByLabelText("Name"), "blur");
		expect(onBlur).toHaveBeenCalledTimes(1);
		expect(boxClassName("Name")).not.toContain("border-ring");
	});

	it("shows the caller's validation outcome, and an error outranks focus", async () => {
		await render(<Input accessibilityLabel="Name" value="" onChange={jest.fn()} invalid />);
		await fireEvent(screen.getByLabelText("Name"), "focus");

		expect(boxClassName("Name")).toContain("border-destructive");
		expect(boxClassName("Name")).not.toContain("border-ring");
	});

	it("follows the state precedence: disabled over loading over error", async () => {
		await render(<Input accessibilityLabel="Name" value="" onChange={jest.fn()} invalid loading disabled />);
		expect(screen.getByLabelText("Name")).toBeDisabled();
		expect(boxClassName("Name")).not.toContain("border-destructive");

		await render(<Input accessibilityLabel="Name" value="" onChange={jest.fn()} invalid loading />);
		expect(screen.getByLabelText("Name")).toBeBusy();
		expect(screen.getByLabelText("Name")).toHaveProp("editable", false);
		expect(boxClassName("Name")).not.toContain("border-destructive");
	});

	it("has sizes and a borderless variant", () => {
		expect(inputVariants({ size: "sm" })).toContain("min-h-10");
		expect(inputVariants({ size: "md" })).toContain("min-h-12");
		expect(inputVariants({ size: "lg" })).toContain("min-h-14");
		expect(inputVariants({ variant: "ghost" })).toContain("border-transparent");
		expect(inputVariants({ variant: "ghost", focused: true })).not.toContain("border-ring");
	});

	it("renders leading and trailing content inside its box", async () => {
		await render(<Input accessibilityLabel="Amount" value="" onChange={jest.fn()} leading={<Input accessibilityLabel="Inner" value="" onChange={jest.fn()} />} />);

		expect(screen.getByLabelText("Inner")).toBeOnTheScreen();
	});

	it("forwards its ref to the TextInput and merges the caller's className last on its box", async () => {
		const ref = React.createRef<TextInput>();
		await render(<Input ref={ref} accessibilityLabel="Name" value="" onChange={jest.fn()} className="flex-1 px-6" testID="name" />);

		expect(ref.current).not.toBeNull();
		expect(screen.getByTestId("name")).toBeOnTheScreen();
		expect(boxClassName("Name")).toContain("flex-1");
		expect(boxClassName("Name")).toContain("px-6");
		expect(boxClassName("Name")).not.toContain("px-3.5");
	});
});

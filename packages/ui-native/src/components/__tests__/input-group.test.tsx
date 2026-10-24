import { fireEvent, render, screen } from "@testing-library/react-native";
import AtSignIcon from "lucide-react-native/icons/at-sign";
import * as React from "react";
import { Pressable, type TextInputInstance, type TextInstance } from "react-native";

import { InputGroup, InputGroupText } from "../input-group";

const UNIT = "kg";

describe("InputGroup", () => {
	it("is an input named by its label, with text addons before and after", async () => {
		const onChange = jest.fn();
		await render(<InputGroup accessibilityLabel="Price" value="12" onChange={onChange} leadingText="$" trailingText="USD" />);

		const input = screen.getByLabelText("Price");
		expect(input).toHaveDisplayValue("12");
		expect(screen.getByText("$")).toBeOnTheScreen();
		expect(screen.getByText("USD")).toBeOnTheScreen();
		await fireEvent.changeText(input, "15");
		expect(onChange).toHaveBeenCalledWith("15");
	});

	it("hides its decorative addons from screen readers", async () => {
		await render(<InputGroup accessibilityLabel="Website" value="" onChange={jest.fn()} leadingText="https://" leadingIcon={AtSignIcon} />);

		expect(screen.getByText("https://")).toHaveProp("accessible", false);
		expect(screen.getByLabelText("Website")).toBeOnTheScreen();
	});

	it("draws a glyph addon and any trailing element", async () => {
		const onClear = jest.fn();
		await render(
			<InputGroup
				accessibilityLabel="Username"
				value="alex"
				onChange={jest.fn()}
				trailingIcon={AtSignIcon}
				trailing={<Pressable accessibilityRole="button" accessibilityLabel="Clear" onPress={onClear} />}
			/>,
		);

		await fireEvent.press(screen.getByRole("button", { name: "Clear" }));
		expect(onClear).toHaveBeenCalledTimes(1);
	});

	it("follows the input's state precedence", async () => {
		await render(<InputGroup accessibilityLabel="Price" value="" onChange={jest.fn()} leadingText="$" invalid disabled />);

		expect(screen.getByLabelText("Price")).toBeDisabled();
		expect(String(screen.getByLabelText("Price").parent?.props.className)).not.toContain("border-destructive");
	});

	it("forwards its ref to the TextInput and merges the caller's className last", async () => {
		const ref = React.createRef<TextInputInstance>();
		await render(<InputGroup ref={ref} accessibilityLabel="Price" value="" onChange={jest.fn()} size="sm" className="rounded-full" />);

		expect(ref.current).not.toBeNull();
		const className = String(screen.getByLabelText("Price").parent?.props.className);
		expect(className).toContain("rounded-full");
		expect(className).toContain("min-h-10");
		expect(className).not.toContain("rounded-lg");
	});

	it("exports a text addon part that forwards its ref", async () => {
		const ref = React.createRef<TextInstance>();
		await render(
			<InputGroupText ref={ref} size="lg" className="text-foreground">
				{UNIT}
			</InputGroupText>,
		);

		expect(ref.current).not.toBeNull();
		const className = String(screen.getByText("kg").props.className);
		expect(className).toContain("text-lg");
		expect(className).toContain("text-foreground");
		expect(className).not.toContain("text-muted-foreground");
	});
});

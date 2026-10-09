import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { TextInput } from "react-native";

import { TextField } from "./text-field";

function toUpperCase(value: string): string {
	return value.toUpperCase();
}

describe("TextField", () => {
	it("is named by its label and reports changes (onChange ← onChangeText)", async () => {
		const onChange = jest.fn();
		await render(<TextField label="Email" value="" onChange={onChange} />);

		await fireEvent.changeText(screen.getByLabelText("Email"), "a@example.com");
		expect(onChange).toHaveBeenCalledWith("a@example.com");
	});

	it("shapes the input before reporting it", async () => {
		const onChange = jest.fn();
		await render(<TextField label="Code" value="" onChange={onChange} normalize={toUpperCase} />);

		await fireEvent.changeText(screen.getByLabelText("Code"), "abc");
		expect(onChange).toHaveBeenCalledWith("ABC");
	});

	it("shows the controlled value, a hint and an error announced as an alert", async () => {
		await render(<TextField label="Password" value="secret" onChange={jest.fn()} hint="At least 8 characters" error="Too short" secureTextEntry />);

		expect(screen.getByLabelText("Password")).toHaveDisplayValue("secret");
		expect(screen.getByText("At least 8 characters")).toBeOnTheScreen();
		expect(screen.getByRole("alert")).toHaveTextContent("Too short");
	});

	it("shows no error element without an error", async () => {
		await render(<TextField label="Name" value="" onChange={jest.fn()} error="" />);
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("reports focus and blur, and forwards its ref", async () => {
		const onBlur = jest.fn();
		const onFocus = jest.fn();
		const ref = React.createRef<TextInput>();
		await render(<TextField ref={ref} label="Name" value="" onChange={jest.fn()} onBlur={onBlur} onFocus={onFocus} />);

		await fireEvent(screen.getByLabelText("Name"), "focus");
		await fireEvent(screen.getByLabelText("Name"), "blur");
		expect(onFocus).toHaveBeenCalledTimes(1);
		expect(onBlur).toHaveBeenCalledTimes(1);
		expect(ref.current).not.toBeNull();
	});
});

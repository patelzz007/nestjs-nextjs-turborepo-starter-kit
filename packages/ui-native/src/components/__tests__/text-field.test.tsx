import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { TextInputInstance } from "react-native";

import { TextField } from "../text-field";

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

	it("masks a password and shows or hides it with the eye button", async () => {
		await render(<TextField label="Password" value="secret" onChange={jest.fn()} secureTextEntry testID="password" />);

		expect(screen.getByLabelText("Password")).toHaveProp("secureTextEntry", true);
		await fireEvent.press(screen.getByRole("button", { name: "Show password" }));
		expect(screen.getByLabelText("Password")).toHaveProp("secureTextEntry", false);
		await fireEvent.press(screen.getByRole("button", { name: "Hide password" }));
		expect(screen.getByLabelText("Password")).toHaveProp("secureTextEntry", true);
		expect(screen.getByTestId("password-visibility")).toBeOnTheScreen();
	});

	it("names the eye button after its field", async () => {
		await render(<TextField label="Current password" value="" onChange={jest.fn()} secureTextEntry />);

		expect(screen.getByRole("button", { name: "Show current password" })).toBeOnTheScreen();
	});

	it("has no eye button on an ordinary field", async () => {
		await render(<TextField label="Email" value="" onChange={jest.fn()} />);

		expect(screen.queryByRole("button")).toBeNull();
		expect(screen.getByLabelText("Email")).toHaveProp("secureTextEntry", false);
	});

	it("shows no error element without an error", async () => {
		await render(<TextField label="Name" value="" onChange={jest.fn()} error="" />);
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("reports focus and blur, and forwards its ref", async () => {
		const onBlur = jest.fn();
		const onFocus = jest.fn();
		const ref = React.createRef<TextInputInstance>();
		await render(<TextField ref={ref} label="Name" value="" onChange={jest.fn()} onBlur={onBlur} onFocus={onFocus} />);

		await fireEvent(screen.getByLabelText("Name"), "focus");
		await fireEvent(screen.getByLabelText("Name"), "blur");
		expect(onFocus).toHaveBeenCalledTimes(1);
		expect(onBlur).toHaveBeenCalledTimes(1);
		expect(ref.current).not.toBeNull();
	});

	it("is a multi-line textarea when asked", async () => {
		await render(<TextField label="Comment" value="" onChange={jest.fn()} multiline />);

		expect(screen.getByLabelText("Comment")).toHaveProp("multiline", true);
		expect(screen.getByLabelText("Comment")).toHaveProp("textAlignVertical", "top");
	});

	it("takes no input while disabled, not editable or loading", async () => {
		await render(<TextField label="Name" value="" onChange={jest.fn()} disabled />);
		expect(screen.getByLabelText("Name")).toBeDisabled();

		await render(<TextField label="Name" value="" onChange={jest.fn()} editable={false} />);
		expect(screen.getByLabelText("Name")).toBeDisabled();

		await render(<TextField label="Name" value="" onChange={jest.fn()} loading />);
		expect(screen.getByLabelText("Name")).toBeBusy();
		expect(screen.getByLabelText("Name")).toHaveProp("editable", false);
	});

	it("merges the caller's className last on its container", async () => {
		await render(<TextField label="Name" value="" onChange={jest.fn()} className="mt-4 gap-3" testID="name" />);

		const container = screen.getByTestId("name").parent?.parent;
		const className = String(container?.props.className);
		expect(className).toContain("mt-4");
		expect(className).toContain("gap-3");
		expect(className).not.toContain("gap-1.5");
	});

	it("passes its variant through to the input", async () => {
		await render(<TextField label="Search" value="" onChange={jest.fn()} variant="ghost" />);
		expect(JSON.stringify(screen.toJSON())).toContain("border-transparent");

		await render(<TextField label="Search" value="" onChange={jest.fn()} />);
		expect(JSON.stringify(screen.toJSON())).not.toContain("border-transparent");
	});
});

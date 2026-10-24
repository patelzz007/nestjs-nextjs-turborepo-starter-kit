import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { TextInputInstance } from "react-native";

import { PasswordInput } from "../password-input";

describe("PasswordInput", () => {
	it("masks the password and shows or hides it with its eye button", async () => {
		await render(<PasswordInput accessibilityLabel="Password" value="secret" onChange={jest.fn()} testID="password" />);

		const input = screen.getByLabelText("Password");
		expect(input).toHaveProp("secureTextEntry", true);
		expect(input).toHaveDisplayValue("secret");
		await fireEvent.press(screen.getByRole("button", { name: "Show password" }));
		expect(screen.getByLabelText("Password")).toHaveProp("secureTextEntry", false);
		await fireEvent.press(screen.getByRole("button", { name: "Hide password" }));
		expect(screen.getByLabelText("Password")).toHaveProp("secureTextEntry", true);
		expect(screen.getByTestId("password-visibility")).toBeOnTheScreen();
	});

	it("reports changes, focus and blur", async () => {
		const onChange = jest.fn();
		const onFocus = jest.fn();
		const onBlur = jest.fn();
		await render(<PasswordInput accessibilityLabel="Password" value="" onChange={onChange} onFocus={onFocus} onBlur={onBlur} />);

		const input = screen.getByLabelText("Password");
		await fireEvent(input, "focus");
		await fireEvent.changeText(input, "hunter2");
		await fireEvent(input, "blur");
		expect(onChange).toHaveBeenCalledWith("hunter2");
		expect(onFocus).toHaveBeenCalledTimes(1);
		expect(onBlur).toHaveBeenCalledTimes(1);
	});

	it("takes its eye button's names from the caller", async () => {
		await render(<PasswordInput accessibilityLabel="Token" value="" onChange={jest.fn()} showLabel="Show token" hideLabel="Hide token" />);

		expect(screen.getByRole("button", { name: "Show token" })).toBeOnTheScreen();
	});

	it("lets the caller own whether the password is showing", async () => {
		const onVisibleChange = jest.fn();
		await render(<PasswordInput accessibilityLabel="Password" value="secret" onChange={jest.fn()} visible onVisibleChange={onVisibleChange} />);

		expect(screen.getByLabelText("Password")).toHaveProp("secureTextEntry", false);
		await fireEvent.press(screen.getByRole("button", { name: "Hide password" }));
		expect(onVisibleChange).toHaveBeenCalledWith(false);
		// Still showing: the caller has not changed `visible`.
		expect(screen.getByLabelText("Password")).toHaveProp("secureTextEntry", false);
	});

	it("follows the state precedence", async () => {
		await render(<PasswordInput accessibilityLabel="Password" value="" onChange={jest.fn()} invalid />);
		expect(String(screen.getByLabelText("Password").parent?.props.className)).toContain("border-destructive");

		await render(<PasswordInput accessibilityLabel="Password" value="" onChange={jest.fn()} invalid disabled />);
		expect(screen.getByLabelText("Password")).toBeDisabled();
		expect(String(screen.getByLabelText("Password").parent?.props.className)).not.toContain("border-destructive");
	});

	it("gives its eye button a 44 pt touch area at every size", async () => {
		await render(<PasswordInput accessibilityLabel="Password" value="" onChange={jest.fn()} size="sm" />);

		const toggle = screen.getByRole("button", { name: "Show password" });
		expect(toggle).toHaveProp("className", expect.stringContaining("size-8"));
		expect(toggle).toHaveProp("hitSlop", 6);
	});

	it("forwards its ref and merges the caller's className last", async () => {
		const ref = React.createRef<TextInputInstance>();
		await render(<PasswordInput ref={ref} accessibilityLabel="Password" value="" onChange={jest.fn()} className="bg-muted" />);

		expect(ref.current).not.toBeNull();
		const className = String(screen.getByLabelText("Password").parent?.props.className);
		expect(className).toContain("bg-muted");
		expect(className).not.toContain("bg-card");
	});
});

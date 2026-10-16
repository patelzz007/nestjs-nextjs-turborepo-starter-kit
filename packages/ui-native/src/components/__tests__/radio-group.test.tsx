import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { View } from "react-native";

import { RadioGroup, type RadioOption } from "../radio-group";

type Theme = "system" | "light" | "dark";

const OPTIONS: readonly RadioOption<Theme>[] = [
	{ value: "system", label: "System", description: "Follow the device" },
	{ value: "light", label: "Light" },
	{ value: "dark", label: "Dark" },
];

/** Every class name in the rendered tree (Uniwind is not compiled under Jest, so classes are checked as written). */
function renderedClassNames(): string {
	return JSON.stringify(screen.toJSON());
}

describe("RadioGroup", () => {
	it("is a named radio group that marks the selected option and reports a new choice", async () => {
		const onChange = jest.fn();
		await render(<RadioGroup label="Theme" options={OPTIONS} value="light" onChange={onChange} />);

		expect(screen.getByLabelText("Theme")).toHaveProp("accessibilityRole", "radiogroup");
		expect(screen.getAllByRole("radio")).toHaveLength(OPTIONS.length);
		expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
		expect(screen.getByRole("radio", { name: "Dark" })).not.toBeChecked();
		expect(screen.getByText("Follow the device")).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("radio", { name: "Dark" }));
		expect(onChange).toHaveBeenCalledWith("dark");
	});

	it("reports nothing when the chosen option is pressed again", async () => {
		const onChange = jest.fn();
		await render(<RadioGroup label="Theme" options={OPTIONS} value="light" onChange={onChange} />);

		await fireEvent.press(screen.getByRole("radio", { name: "Light" }));
		expect(onChange).not.toHaveBeenCalled();
	});

	it("can start with nothing chosen", async () => {
		await render(<RadioGroup<Theme> label="Theme" options={OPTIONS} value={null} onChange={jest.fn()} />);

		for (const radio of screen.getAllByRole("radio")) {
			expect(radio).not.toBeChecked();
		}
	});

	it("works with numeric values and can be disabled", async () => {
		const onChange = jest.fn();
		await render(
			<RadioGroup
				label="Timeout"
				options={[
					{ value: 0, label: "Immediately" },
					{ value: 60_000, label: "After 1 minute" },
				]}
				value={60_000}
				onChange={onChange}
				disabled
			/>,
		);

		expect(screen.getByRole("radio", { name: "After 1 minute" })).toBeChecked();
		expect(screen.getByRole("radio", { name: "Immediately" })).toBeDisabled();
		await fireEvent.press(screen.getByRole("radio", { name: "Immediately" }));
		expect(onChange).not.toHaveBeenCalled();
	});

	it("disables a single option, and the whole group while loading", async () => {
		await render(<RadioGroup label="Theme" options={[...OPTIONS, { value: "dim", label: "Dim", disabled: true }]} value="light" onChange={jest.fn()} />);
		expect(screen.getByRole("radio", { name: "Dim" })).toBeDisabled();
		expect(screen.getByRole("radio", { name: "Dark" })).not.toBeDisabled();

		await render(<RadioGroup label="Theme" options={OPTIONS} value="light" onChange={jest.fn()} loading />);
		expect(screen.getByRole("radio", { name: "Dark" })).toBeBusy();
		expect(screen.getByRole("radio", { name: "Dark" })).toBeDisabled();
	});

	it("shows the error state on its rings while invalid, unless disabled", async () => {
		await render(<RadioGroup label="Theme" options={OPTIONS} value={null} onChange={jest.fn()} invalid />);
		expect(renderedClassNames()).toContain("border-destructive");

		await render(<RadioGroup label="Theme" options={OPTIONS} value={null} onChange={jest.fn()} invalid disabled />);
		expect(renderedClassNames()).not.toContain("border-destructive");
	});

	it("has a card variant that outlines the chosen option", async () => {
		await render(<RadioGroup label="Theme" options={OPTIONS} value="dark" onChange={jest.fn()} variant="card" />);
		expect(screen.getByRole("radio", { name: "Dark" })).toHaveProp("className", expect.stringContaining("border-primary"));
		expect(screen.getByRole("radio", { name: "Light" })).not.toHaveProp("className", expect.stringContaining("border-primary"));
	});

	it("forwards its ref and merges the caller's className last", async () => {
		const ref = React.createRef<View>();
		await render(<RadioGroup ref={ref} label="Theme" options={OPTIONS} value="dark" onChange={jest.fn()} className="gap-4" />);

		expect(ref.current).not.toBeNull();
		const className = String(screen.getByLabelText("Theme").props.className);
		expect(className).toContain("gap-4");
		expect(className).not.toContain("gap-1");
	});

	it("reports focus and blur from its options", async () => {
		const onFocus = jest.fn();
		const onBlur = jest.fn();
		await render(<RadioGroup label="Theme" options={OPTIONS} value="dark" onChange={jest.fn()} onFocus={onFocus} onBlur={onBlur} />);
		await fireEvent(screen.getByRole("radio", { name: "Light" }), "focus");
		await fireEvent(screen.getByRole("radio", { name: "Light" }), "blur");
		expect(onFocus).toHaveBeenCalledTimes(1);
		expect(onBlur).toHaveBeenCalledTimes(1);
	});
});

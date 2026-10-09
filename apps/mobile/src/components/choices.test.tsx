import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";

import { Checkbox } from "./checkbox";
import { RadioGroup } from "./radio-group";

describe("Checkbox", () => {
	it("is a controlled, accessible checkbox", async () => {
		const onChange = jest.fn();
		const { rerender } = await render(<Checkbox label="I saved my backup codes" checked={false} onChange={onChange} />);

		const checkbox = screen.getByRole("checkbox", { name: "I saved my backup codes" });
		expect(checkbox).not.toBeChecked();
		await fireEvent.press(checkbox);
		expect(onChange).toHaveBeenCalledWith(true);

		await rerender(<Checkbox label="I saved my backup codes" checked onChange={onChange} />);
		expect(screen.getByRole("checkbox")).toBeChecked();
		await fireEvent.press(screen.getByRole("checkbox"));
		expect(onChange).toHaveBeenLastCalledWith(false);
	});

	it("can be disabled", async () => {
		await render(<Checkbox label="Agree" checked={false} onChange={jest.fn()} disabled />);
		expect(screen.getByRole("checkbox")).toBeDisabled();
	});
});

describe("RadioGroup", () => {
	const OPTIONS = [
		{ value: "system", label: "System", description: "Follow the device" },
		{ value: "light", label: "Light" },
		{ value: "dark", label: "Dark" },
	];

	it("marks the selected option and reports a new choice", async () => {
		const onChange = jest.fn();
		await render(<RadioGroup label="Theme" options={OPTIONS} value="light" onChange={onChange} />);

		expect(screen.getAllByRole("radio")).toHaveLength(3);
		expect(screen.getByRole("radio", { name: "Light" })).toBeChecked();
		expect(screen.getByRole("radio", { name: "Dark" })).not.toBeChecked();
		expect(screen.getByText("Follow the device")).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("radio", { name: "Dark" }));
		expect(onChange).toHaveBeenCalledWith("dark");
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
	});
});

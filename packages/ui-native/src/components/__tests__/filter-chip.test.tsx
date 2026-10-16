import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { View } from "react-native";

import { FilterChip, type FilterChipOption } from "../filter-chip";

type State = "open" | "closed";

const OPTIONS: readonly FilterChipOption<State>[] = [
	{ value: "open", label: "Open" },
	{ value: "closed", label: "Closed" },
];

describe("FilterChip", () => {
	it("shows the current choice, named with what it filters", async () => {
		await render(<FilterChip<State> title="State" options={OPTIONS} value="open" onChange={jest.fn()} />);

		const chip = screen.getByRole("button", { name: "State: Open" });
		expect(chip).toBeOnTheScreen();
		expect(chip).not.toBeExpanded();
		expect(screen.queryByRole("radio")).toBeNull();
	});

	it("opens a sheet with the current choice checked, and reports a new one", async () => {
		const onChange = jest.fn();
		await render(<FilterChip<State> title="State" options={OPTIONS} value="open" onChange={onChange} />);

		await fireEvent.press(screen.getByRole("button", { name: "State: Open" }));
		expect(screen.getByRole("button", { name: "State: Open" })).toBeExpanded();
		expect(screen.getByRole("header", { name: "State" })).toBeOnTheScreen();
		expect(screen.getByRole("radio", { name: "Open" })).toBeChecked();

		await fireEvent.press(screen.getByRole("radio", { name: "Closed" }));

		expect(onChange).toHaveBeenCalledWith("closed");
		expect(screen.queryByRole("radio")).toBeNull();
	});

	it("closes without reporting when the current choice is picked again", async () => {
		const onChange = jest.fn();
		await render(<FilterChip<State> title="State" options={OPTIONS} value="open" onChange={onChange} />);

		await fireEvent.press(screen.getByRole("button", { name: "State: Open" }));
		await fireEvent.press(screen.getByRole("radio", { name: "Open" }));

		expect(onChange).not.toHaveBeenCalled();
		expect(screen.queryByRole("radio")).toBeNull();
	});

	it("does not open while disabled or loading", async () => {
		await render(<FilterChip<State> title="State" options={OPTIONS} value="open" onChange={jest.fn()} disabled />);
		expect(screen.getByRole("button", { name: "State: Open" })).toBeDisabled();
		await fireEvent.press(screen.getByRole("button", { name: "State: Open" }));
		expect(screen.queryByRole("radio")).toBeNull();

		await render(<FilterChip<State> title="State" options={OPTIONS} value="open" onChange={jest.fn()} loading />);
		expect(screen.getByRole("button", { name: "State: Open" })).toBeBusy();
	});

	it("outlines itself while invalid, unless disabled", async () => {
		await render(<FilterChip<State> title="State" options={OPTIONS} value="open" onChange={jest.fn()} invalid />);
		expect(screen.getByRole("button")).toHaveProp("className", expect.stringContaining("border-destructive"));

		await render(<FilterChip<State> title="State" options={OPTIONS} value="open" onChange={jest.fn()} invalid disabled />);
		expect(screen.getByRole("button")).not.toHaveProp("className", expect.stringContaining("border-destructive"));
	});

	it("has a filled variant and a compact size whose touch area still reaches 44 pt", async () => {
		await render(<FilterChip<State> title="State" options={OPTIONS} value="open" onChange={jest.fn()} variant="filled" size="sm" />);
		const chip = screen.getByRole("button");
		expect(chip).toHaveProp("className", expect.stringContaining("bg-muted"));
		expect(chip).toHaveProp("className", expect.stringContaining("min-h-8"));
		expect(chip).toHaveProp("hitSlop", 6);
	});

	it("forwards its ref, merges the caller's className last and reports focus and blur", async () => {
		const ref = React.createRef<View>();
		const onFocus = jest.fn();
		const onBlur = jest.fn();
		await render(<FilterChip<State> ref={ref} title="State" options={OPTIONS} value="open" onChange={jest.fn()} onFocus={onFocus} onBlur={onBlur} className="px-5" />);

		expect(ref.current).not.toBeNull();
		const chip = screen.getByRole("button");
		expect(String(chip.props.className)).toContain("px-5");
		expect(String(chip.props.className)).not.toContain("px-3.5");
		await fireEvent(chip, "focus");
		await fireEvent(chip, "blur");
		expect(onFocus).toHaveBeenCalledTimes(1);
		expect(onBlur).toHaveBeenCalledTimes(1);
	});
});

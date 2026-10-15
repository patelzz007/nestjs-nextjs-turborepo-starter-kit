import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";

import { FilterChip, type FilterChipOption } from "./filter-chip";

type State = "open" | "closed";

const OPTIONS: readonly FilterChipOption<State>[] = [
	{ value: "open", label: "Open" },
	{ value: "closed", label: "Closed" },
];

describe("FilterChip", () => {
	it("shows the current choice, named with what it filters", async () => {
		await render(<FilterChip<State> title="State" options={OPTIONS} value="open" onChange={jest.fn()} />);

		expect(screen.getByRole("button", { name: "State: Open" })).toBeOnTheScreen();
		expect(screen.queryByRole("radio")).toBeNull();
	});

	it("opens a sheet with the current choice checked, and reports a new one", async () => {
		const onChange = jest.fn();
		await render(<FilterChip<State> title="State" options={OPTIONS} value="open" onChange={onChange} />);

		await fireEvent.press(screen.getByRole("button", { name: "State: Open" }));
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
});

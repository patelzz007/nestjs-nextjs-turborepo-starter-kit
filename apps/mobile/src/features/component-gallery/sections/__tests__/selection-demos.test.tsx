import { fireEvent, render, screen, within } from "@testing-library/react-native";
import * as React from "react";

import { SelectionDemos } from "../selection-demos";

/** A measured slider track, so the slider takes touches. */
const TRACK_LAYOUT = { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 24 } } };
const INCREMENT = { nativeEvent: { actionName: "increment" } };

const DEMO_TITLES: readonly string[] = ["Checkbox", "RadioGroup", "SegmentedControl", "SelectField", "FilterChip", "Switch", "Toggle", "ToggleGroup", "Slider", "Combobox"];

describe("SelectionDemos", () => {
	it("shows one demo block per component", async () => {
		await render(<SelectionDemos />);
		for (const title of DEMO_TITLES) {
			expect(within(screen.getByTestId(`demo-${title}`)).getByText(title)).toBeOnTheScreen();
		}
	});

	it("checks the terms, which clears the required error", async () => {
		await render(<SelectionDemos />);
		const block = within(screen.getByTestId("demo-Checkbox"));

		const terms = block.getByRole("checkbox", { name: "I accept the terms" });
		expect(terms).not.toBeChecked();
		expect(terms).toHaveProp("accessibilityHint", "Required to continue");
		await fireEvent.press(terms);
		expect(block.getByRole("checkbox", { name: "I accept the terms" })).toBeChecked();
	});

	it("turns a switch off and on", async () => {
		await render(<SelectionDemos />);
		const block = within(screen.getByTestId("demo-Switch"));

		expect(block.getByRole("switch", { name: "Notifications" })).toBeChecked();
		await fireEvent.press(block.getByRole("switch", { name: "Notifications" }));
		expect(block.getByRole("switch", { name: "Notifications" })).not.toBeChecked();
	});

	it("picks and drops working days", async () => {
		await render(<SelectionDemos />);
		const block = within(screen.getByTestId("demo-ToggleGroup"));

		expect(block.getByText("2 days picked")).toBeOnTheScreen();
		const days = within(block.getByLabelText("Working days"));
		await fireEvent.press(days.getByRole("checkbox", { name: "Friday" }));
		expect(days.getByRole("checkbox", { name: "Friday" })).toBeChecked();
		expect(block.getByText("3 days picked")).toBeOnTheScreen();
	});

	it("steps the volume with screen-reader actions", async () => {
		await render(<SelectionDemos />);
		const block = within(screen.getByTestId("demo-Slider"));

		await fireEvent(block.getByTestId("demo-slider-volume-rail"), "layout", TRACK_LAYOUT);
		await fireEvent(block.getByRole("adjustable", { name: "Volume" }), "accessibilityAction", INCREMENT);
		expect(block.getByText("Volume: 41 %")).toBeOnTheScreen();
	});

	it("chooses a country from the combobox search", async () => {
		await render(<SelectionDemos />);
		const block = within(screen.getByTestId("demo-Combobox"));

		expect(block.getByText("Choose a country.")).toBeOnTheScreen();
		await fireEvent.press(block.getByRole("combobox", { name: "Country, Search for a country" }));
		await fireEvent.changeText(screen.getByLabelText("Search country"), "tokyo");
		await fireEvent.press(screen.getByRole("radio", { name: "Japan" }));

		expect(block.getByRole("combobox", { name: "Country, Japan" })).toBeOnTheScreen();
		expect(block.queryByText("Choose a country.")).toBeNull();
	});
});

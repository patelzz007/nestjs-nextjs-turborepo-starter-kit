import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { filterSelectOptions, SelectField, type SelectOption } from "../select-field";

type Fruit = "apple" | "banana" | "cherry";

const OPTIONS: readonly SelectOption<Fruit>[] = [
	{ value: "apple", label: "Apple", description: "Crunchy" },
	{ value: "banana", label: "Banana" },
	{ value: "cherry", label: "Cherry", description: "Small and red" },
];

function field(overrides: Partial<React.ComponentProps<typeof SelectField<Fruit>>> = {}): React.JSX.Element {
	return <SelectField<Fruit> label="Fruit" options={OPTIONS} value="apple" onChange={jest.fn()} {...overrides} />;
}

describe("SelectField", () => {
	it("shows the chosen option as a closed combobox", async () => {
		await render(field());

		const combobox = screen.getByRole("combobox", { name: "Fruit, Apple" });
		expect(combobox).toBeOnTheScreen();
		expect(combobox).not.toBeExpanded();
		expect(screen.getByText("Crunchy")).toBeOnTheScreen();
		expect(screen.queryByRole("radio")).toBeNull();
	});

	it("opens a list with the chosen option checked, and reports a new choice", async () => {
		const onChange = jest.fn();
		await render(field({ onChange }));

		await fireEvent.press(screen.getByRole("combobox"));

		expect(screen.getByRole("radio", { name: "Apple" })).toBeChecked();
		expect(screen.getByRole("radio", { name: "Banana" })).not.toBeChecked();
		await fireEvent.press(screen.getByRole("radio", { name: "Cherry" }));

		expect(onChange).toHaveBeenCalledWith("cherry");
		expect(screen.queryByRole("radio")).toBeNull();
	});

	it("closes without reporting when the current option is chosen again, or on Close", async () => {
		const onChange = jest.fn();
		await render(field({ onChange }));

		await fireEvent.press(screen.getByRole("combobox"));
		await fireEvent.press(screen.getByRole("radio", { name: "Apple" }));
		await fireEvent.press(screen.getByRole("combobox"));
		await fireEvent.press(screen.getByRole("button", { name: "Close fruit" }));

		expect(onChange).not.toHaveBeenCalled();
		expect(screen.queryByRole("radio")).toBeNull();
	});

	it("filters the options with the search box, and says when nothing matches", async () => {
		await render(field({ searchable: true, noMatchesMessage: "No fruit." }));

		await fireEvent.press(screen.getByRole("combobox"));
		await fireEvent.changeText(screen.getByLabelText("Search fruit"), "RED");

		expect(screen.getAllByRole("radio")).toHaveLength(1);
		expect(screen.getByRole("radio", { name: "Cherry" })).toBeOnTheScreen();
		await fireEvent.changeText(screen.getByLabelText("Search fruit"), "kiwi");
		expect(screen.getByText("No fruit.")).toBeOnTheScreen();
	});

	it("starts with an empty search every time it opens", async () => {
		await render(field({ searchable: true }));

		await fireEvent.press(screen.getByRole("combobox"));
		await fireEvent.changeText(screen.getByLabelText("Search fruit"), "ban");
		await fireEvent.press(screen.getByRole("button", { name: "Close fruit" }));
		await fireEvent.press(screen.getByRole("combobox"));

		expect(screen.getByLabelText("Search fruit")).toHaveDisplayValue("");
		expect(screen.getAllByRole("radio")).toHaveLength(3);
	});

	it("has no search box unless asked", async () => {
		await render(field());

		await fireEvent.press(screen.getByRole("combobox"));

		expect(screen.queryByLabelText("Search fruit")).toBeNull();
	});

	it("shows a placeholder while nothing is chosen", async () => {
		await render(field({ value: null, placeholder: "Pick a fruit" }));

		expect(screen.getByRole("combobox", { name: "Fruit, Pick a fruit" })).toBeOnTheScreen();
		expect(screen.getByText("Pick a fruit")).toBeOnTheScreen();
	});

	it("shows a hint, and the error it is given in the error state", async () => {
		await render(field({ hint: "Your favourite", error: "Choose a fruit." }));

		expect(screen.getByText("Your favourite")).toBeOnTheScreen();
		expect(screen.getByRole("alert")).toHaveTextContent("Choose a fruit.");
		expect(screen.getByRole("combobox")).toHaveProp("className", expect.stringContaining("border-destructive"));
	});

	it("does not open while disabled, and shows busy while loading", async () => {
		await render(field({ disabled: true, invalid: true }));
		const combobox = screen.getByRole("combobox");
		expect(combobox).toBeDisabled();
		expect(combobox).not.toHaveProp("className", expect.stringContaining("border-destructive"));
		await fireEvent.press(combobox);
		expect(screen.queryByRole("radio")).toBeNull();

		await render(field({ loading: true }));
		expect(screen.getByRole("combobox")).toBeBusy();
	});

	it("marks itself expanded while the sheet is open, and skips disabled options", async () => {
		const onChange = jest.fn();
		await render(field({ onChange, options: [...OPTIONS.slice(0, 2), { value: "cherry", label: "Cherry", disabled: true }] }));

		await fireEvent.press(screen.getByRole("combobox"));
		expect(screen.getByRole("combobox")).toBeExpanded();
		expect(screen.getByRole("radio", { name: "Cherry" })).toBeDisabled();
		await fireEvent.press(screen.getByRole("radio", { name: "Cherry" }));
		expect(onChange).not.toHaveBeenCalled();
	});

	it("has a muted variant and a compact size", async () => {
		await render(field({ variant: "muted", size: "sm" }));
		const className = String(screen.getByRole("combobox").props.className);
		expect(className).toContain("bg-muted");
		expect(className).toContain("min-h-11");
	});

	it("forwards its ref to the trigger, merges the caller's className last and reports focus and blur", async () => {
		const ref = React.createRef<ViewInstance>();
		const onFocus = jest.fn();
		const onBlur = jest.fn();
		await render(
			<SelectField<Fruit> ref={ref} label="Fruit" options={OPTIONS} value="apple" onChange={jest.fn()} onFocus={onFocus} onBlur={onBlur} className="mt-4" testID="fruit" />,
		);

		expect(ref.current).not.toBeNull();
		expect(screen.getByTestId("fruit").parent?.props.className).toEqual(expect.stringContaining("mt-4"));
		await fireEvent(screen.getByRole("combobox"), "focus");
		await fireEvent(screen.getByRole("combobox"), "blur");
		expect(onFocus).toHaveBeenCalledTimes(1);
		expect(onBlur).toHaveBeenCalledTimes(1);
	});
});

describe("filterSelectOptions", () => {
	it("matches label or description, ignoring case and surrounding spaces", () => {
		expect(filterSelectOptions(OPTIONS, "  CRUNCH ").map((option) => option.value)).toEqual(["apple"]);
		expect(filterSelectOptions(OPTIONS, "an").map((option) => option.value)).toEqual(["banana", "cherry"]);
	});

	it("keeps every option for an empty query", () => {
		expect(filterSelectOptions(OPTIONS, " ")).toBe(OPTIONS);
	});
});

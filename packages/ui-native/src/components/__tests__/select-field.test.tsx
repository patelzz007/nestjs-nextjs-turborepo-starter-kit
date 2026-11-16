import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";

import { filterSelectOptions, MultiSelectField, SelectField, selectListRowsOf, type SelectOption, toggleSelectValue } from "../select-field";
import { SHEET_MOTION } from "../../lib/motion";

type Fruit = "apple" | "banana" | "cherry";

const OPTIONS: readonly SelectOption<Fruit>[] = [
	{ value: "apple", label: "Apple", description: "Crunchy" },
	{ value: "banana", label: "Banana" },
	{ value: "cherry", label: "Cherry", description: "Small and red" },
];

function field(overrides: Partial<React.ComponentProps<typeof SelectField<Fruit>>> = {}): React.JSX.Element {
	return <SelectField<Fruit> label="Fruit" options={OPTIONS} value="apple" onChange={jest.fn()} {...overrides} />;
}

/** Sheets leave with an animation (lib/use-overlay-presence): the clock is the test's, so leaving is checked exactly. */
beforeEach((): void => {
	jest.useFakeTimers();
});

afterEach((): void => {
	jest.useRealTimers();
});

/** Lets the sheet finish leaving: it stays up for its exit, then unmounts. */
async function finishLeaving(): Promise<void> {
	await act((): void => {
		jest.advanceTimersByTime(SHEET_MOTION.exit.duration);
	});
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
		await finishLeaving();
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
		await finishLeaving();
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

const GROUPED: readonly SelectOption<Fruit>[] = [
	{ value: "banana", label: "Banana", group: "Yellow" },
	{ value: "apple", label: "Apple", group: "Red", trailing: <Text>Crisp</Text> },
	{ value: "cherry", label: "Cherry", group: "Red", leading: <Text>●</Text> },
];

describe("selectListRowsOf", () => {
	it("keeps each group's options together under its heading, the groups in the order they first appear", () => {
		const rows = selectListRowsOf(GROUPED, true);
		expect(rows.map((row) => row.key)).toEqual(["group:Yellow", "banana", "group:Red", "apple", "cherry"]);
		expect(rows.flatMap((row) => (row.kind === "heading" ? [row.separated] : []))).toEqual([false, true]);
	});

	it("lists options without a group first, with no heading", () => {
		expect(selectListRowsOf(OPTIONS, false).map((row) => row.kind)).toEqual(["option", "option", "option"]);
	});
});

describe("toggleSelectValue", () => {
	it("adds a value at the end, or takes it out", () => {
		expect(toggleSelectValue(["apple"], "banana")).toEqual(["apple", "banana"]);
		expect(toggleSelectValue(["apple", "banana"], "apple")).toEqual(["banana"]);
	});
});

describe("SelectField extras", () => {
	it("lists grouped options under headings, with their leading and trailing parts and the tick at the start", async () => {
		await render(field({ options: GROUPED, value: "cherry", indicatorPosition: "start", groupSeparators: true }));
		expect(screen.getByText("●")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("combobox"));
		expect(screen.getByRole("header", { name: "Red" })).toBeOnTheScreen();
		expect(screen.getByText("Crisp", { includeHiddenElements: true })).toBeOnTheScreen();
		expect(screen.getByRole("radio", { name: "Cherry" })).toBeChecked();
	});

	it("shows a prefix and the caller's drawing of the value, and clears it from its own button", async () => {
		const onClear = jest.fn();
		await render(field({ prefix: "Status:", renderValue: (option) => <Text>{`[${option.label}]`}</Text>, onClear, testID: "fruit" }));
		expect(screen.getByText("Status:")).toBeOnTheScreen();
		expect(screen.getByText("[Apple]")).toBeOnTheScreen();
		expect(screen.getByRole("combobox", { name: "Fruit, Apple" })).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Clear fruit" }));
		expect(onClear).toHaveBeenCalledTimes(1);
	});

	it("has no clear button while nothing is chosen, and a ghost variant without a fill", async () => {
		await render(field({ value: null, onClear: jest.fn(), variant: "ghost" }));
		expect(screen.queryByRole("button", { name: "Clear fruit" })).toBeNull();
		expect(screen.getByRole("combobox")).toHaveProp("className", expect.stringContaining("bg-transparent"));
	});

	it("tints the first match and picks it with the keyboard's Return key", async () => {
		const onChange = jest.fn();
		await render(field({ value: null, onChange, searchable: true, autoHighlight: true }));
		await fireEvent.press(screen.getByRole("combobox"));
		const search = screen.getByLabelText("Search fruit");
		await fireEvent.changeText(search, "rr");
		await fireEvent(search, "submitEditing");
		expect(onChange).toHaveBeenCalledWith("cherry");
	});
});

/** Draws a multiple select's value as a count. */
function countFruit(chosen: readonly SelectOption<Fruit>[]): React.JSX.Element {
	return <Text>{`${String(chosen.length)} fruit`}</Text>;
}

describe("MultiSelectField", () => {
	it("ticks several options in a sheet that stays open, and lists them as removable chips", async () => {
		const onChange = jest.fn();
		await render(<MultiSelectField<Fruit> label="Fruit" options={OPTIONS} values={["apple", "cherry"]} onChange={onChange} />);
		expect(screen.getByRole("combobox", { name: "Fruit, Apple, Cherry" })).toBeOnTheScreen();
		expect(screen.getByText("2 selected")).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("button", { name: "Remove Apple" }));
		expect(onChange).toHaveBeenLastCalledWith(["cherry"]);

		await fireEvent.press(screen.getByRole("combobox"));
		expect(screen.getByRole("checkbox", { name: "Cherry" })).toBeChecked();
		await fireEvent.press(screen.getByRole("checkbox", { name: "Banana" }));
		expect(onChange).toHaveBeenLastCalledWith(["apple", "cherry", "banana"]);
		expect(screen.getByRole("checkbox", { name: "Banana" })).toBeOnTheScreen();
	});

	it("draws static chips without remove buttons, a summary line, or the caller's drawing", async () => {
		await render(<MultiSelectField<Fruit> label="Fruit" options={OPTIONS} values={["apple"]} onChange={jest.fn()} chips="static" />);
		expect(screen.getByText("Apple")).toBeOnTheScreen();
		expect(screen.queryByRole("button", { name: "Remove Apple" })).toBeNull();

		await render(<MultiSelectField<Fruit> label="Fruit" options={OPTIONS} values={["apple", "banana"]} onChange={jest.fn()} chips="none" />);
		expect(screen.getByText("Apple, Banana")).toBeOnTheScreen();

		await render(<MultiSelectField<Fruit> label="Fruit" options={OPTIONS} values={["banana"]} onChange={jest.fn()} renderValues={countFruit} />);
		expect(screen.getByText("1 fruit")).toBeOnTheScreen();
	});
});

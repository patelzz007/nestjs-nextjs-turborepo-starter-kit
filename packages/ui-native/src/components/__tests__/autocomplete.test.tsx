import { fireEvent, render, screen, within } from "@testing-library/react-native";
import * as React from "react";
import type { TextInputInstance } from "react-native";

import { Autocomplete, matchesQuery, type AutocompleteItem } from "../autocomplete";

const ITEMS: readonly AutocompleteItem[] = [
	{ value: "Accordion", group: "Disclosure" },
	{ value: "Alert", group: "Feedback" },
	{ value: "Avatar", description: "A person's picture", group: "Media" },
	{ value: "Button", group: "Actions" },
];

function Controlled(props: Partial<React.ComponentProps<typeof Autocomplete>>): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return <Autocomplete value={value} onChange={setValue} items={ITEMS} accessibilityLabel="Component" testID="field" {...props} />;
}

describe("matchesQuery", () => {
	it("matches every word of the query anywhere in the item, case and accents ignored", () => {
		expect(matchesQuery({ value: "Avatar", description: "A person's picture" }, "PERSON av")).toBe(true);
		expect(matchesQuery({ value: "Fenêtre" }, "fenetre")).toBe(true);
		expect(matchesQuery({ value: "Button" }, "alert")).toBe(false);
	});
});

describe("Autocomplete", () => {
	it("lists matching suggestions under their group as it is typed, and fills the field with the one tapped", async () => {
		await render(<Controlled />);
		const field = screen.getByTestId("field");
		await fireEvent(field, "focus");
		await fireEvent.changeText(field, "a");
		const list = screen.getByTestId("field-list");
		expect(within(list).getByRole("header", { name: "Feedback" })).toBeOnTheScreen();
		await fireEvent.press(within(list).getByRole("button", { name: "Avatar, A person's picture" }));
		expect(field).toHaveProp("value", "Avatar");
		expect(screen.queryByTestId("field-list")).toBeNull();
	});

	it("takes the highlighted first match on return", async () => {
		await render(<Controlled autoHighlight />);
		const field = screen.getByTestId("field");
		await fireEvent(field, "focus");
		await fireEvent.changeText(field, "but");
		expect(screen.getByRole("button", { name: "Button" })).toHaveProp("accessibilityState", { selected: true });
		await fireEvent(field, "submitEditing");
		expect(field).toHaveProp("value", "Button");
	});

	it("clears its text, and opens the full list from its trigger", async () => {
		await render(<Controlled showClear showTrigger />);
		await fireEvent.press(screen.getByRole("button", { name: "Show suggestions" }));
		expect(within(screen.getByTestId("field-list")).getAllByRole("button")).toHaveLength(ITEMS.length);
		await fireEvent.changeText(screen.getByTestId("field"), "zz");
		expect(screen.getByText("No matches")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Clear" }));
		expect(screen.getByTestId("field")).toHaveProp("value", "");
	});

	it("shows a status line, and leaves filtering to the caller with filter={null}", async () => {
		await render(<Autocomplete value="zz" onChange={jest.fn()} items={ITEMS} filter={null} status="4 results" accessibilityLabel="Search" testID="field" />);
		await fireEvent(screen.getByTestId("field"), "focus");
		expect(screen.getByText("4 results")).toBeOnTheScreen();
		expect(within(screen.getByTestId("field-list")).getAllByRole("button")).toHaveLength(ITEMS.length);
	});

	it("takes no input while disabled, and forwards its ref", async () => {
		const ref = React.createRef<TextInputInstance>();
		await render(<Autocomplete ref={ref} value="" onChange={jest.fn()} items={ITEMS} disabled showTrigger accessibilityLabel="Search" testID="field" />);
		expect(screen.getByTestId("field")).toHaveProp("editable", false);
		expect(screen.getByRole("button", { name: "Show suggestions" })).toBeDisabled();
		expect(ref.current).not.toBeNull();
	});
});

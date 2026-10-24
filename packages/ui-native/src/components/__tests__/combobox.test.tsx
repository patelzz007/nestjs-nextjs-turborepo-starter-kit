import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { Combobox, type ComboboxOption } from "../combobox";

type Country = "fr" | "de" | "jp";

const OPTIONS: readonly ComboboxOption<Country>[] = [
	{ value: "fr", label: "France", description: "Europe" },
	{ value: "de", label: "Germany", description: "Europe" },
	{ value: "jp", label: "Japan", description: "Asia" },
];

describe("Combobox", () => {
	it("is a combobox named by its label and its choice, with a placeholder while nothing is chosen", async () => {
		const { rerender } = await render(<Combobox<Country> label="Country" options={OPTIONS} value={null} onChange={jest.fn()} />);
		expect(screen.getByRole("combobox", { name: "Country, Select an option" })).not.toBeExpanded();

		await rerender(<Combobox<Country> label="Country" options={OPTIONS} value="jp" onChange={jest.fn()} placeholder="Choose a country" />);
		expect(screen.getByRole("combobox", { name: "Country, Japan" })).toBeOnTheScreen();
	});

	it("opens a focused search that filters the options, and reports a choice", async () => {
		const onChange = jest.fn();
		await render(<Combobox<Country> label="Country" options={OPTIONS} value={null} onChange={onChange} />);

		await fireEvent.press(screen.getByRole("combobox"));
		const search = screen.getByLabelText("Search country");
		expect(search).toHaveProp("autoFocus", true);
		expect(screen.getAllByRole("radio")).toHaveLength(OPTIONS.length);

		await fireEvent.changeText(search, "asia");
		expect(screen.getAllByRole("radio")).toHaveLength(1);
		await fireEvent.press(screen.getByRole("radio", { name: "Japan" }));

		expect(onChange).toHaveBeenCalledWith("jp");
		expect(screen.queryByRole("radio")).toBeNull();
	});

	it("starts with an empty search each time, and says when nothing matches", async () => {
		await render(<Combobox<Country> label="Country" options={OPTIONS} value="fr" onChange={jest.fn()} noMatchesMessage="No such country." />);

		await fireEvent.press(screen.getByRole("combobox"));
		await fireEvent.changeText(screen.getByLabelText("Search country"), "atlantis");
		expect(screen.getByText("No such country.")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Close country" }));
		await fireEvent.press(screen.getByRole("combobox"));

		expect(screen.getByLabelText("Search country")).toHaveDisplayValue("");
	});

	it("does not open while disabled, and shows the error it is given", async () => {
		await render(<Combobox<Country> label="Country" options={OPTIONS} value={null} onChange={jest.fn()} error="Choose a country." />);
		expect(screen.getByRole("alert")).toHaveTextContent("Choose a country.");
		expect(screen.getByRole("combobox")).toHaveProp("className", expect.stringContaining("border-destructive"));

		await render(<Combobox<Country> label="Country" options={OPTIONS} value={null} onChange={jest.fn()} disabled />);
		await fireEvent.press(screen.getByRole("combobox"));
		expect(screen.queryByLabelText("Search country")).toBeNull();
	});

	it("forwards its ref to the trigger and takes a compact size", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<Combobox<Country> ref={ref} label="Country" options={OPTIONS} value={null} onChange={jest.fn()} size="sm" />);

		expect(ref.current).not.toBeNull();
		expect(screen.getByRole("combobox")).toHaveProp("className", expect.stringContaining("min-h-11"));
	});
});

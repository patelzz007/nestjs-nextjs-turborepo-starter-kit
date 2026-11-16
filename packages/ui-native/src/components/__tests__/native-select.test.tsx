import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { showSystemPicker, type SystemPickerRequest } from "../../lib/system-picker";
import { NativeSelect, sheetOptionsOf, type NativeSelectOption } from "../native-select";

jest.mock("../../lib/system-picker", (): { readonly showSystemPicker: jest.Mock } => ({ showSystemPicker: jest.fn() }));

const FRUITS: readonly NativeSelectOption<string>[] = [
	{ value: "apple", label: "Apple", group: "Fruits" },
	{ value: "grapes", label: "Grapes", group: "Fruits", disabled: true },
	{ value: "carrot", label: "Carrot", group: "Vegetables" },
];

describe("sheetOptionsOf", () => {
	it("heads each group at its first option, and keeps disabled options disabled", () => {
		expect(sheetOptionsOf(FRUITS)).toStrictEqual([
			{ value: "apple", label: "Apple", description: "Fruits" },
			{ value: "grapes", label: "Grapes", disabled: true },
			{ value: "carrot", label: "Carrot", description: "Vegetables" },
		]);
	});
});

describe("NativeSelect", () => {
	it("opens the system picker where there is one, with its disabled options, and reports the picked option", async () => {
		jest.mocked(showSystemPicker).mockImplementation((request: SystemPickerRequest): boolean => {
			request.onPick(2);
			return true;
		});
		const onChange = jest.fn();
		await render(<NativeSelect label="Food" options={FRUITS} value={null} onChange={onChange} placeholder="Pick one" />);
		await fireEvent.press(screen.getByRole("combobox", { name: /Food/u }));
		expect(showSystemPicker).toHaveBeenCalledWith(expect.objectContaining({ title: "Food", options: ["Apple", "Grapes", "Carrot"], cancel: "Cancel", disabledIndices: [1] }));
		expect(onChange).toHaveBeenCalledWith("carrot");
		expect(screen.queryByText("Carrot")).toBeNull();
	});

	it("lists the options in the kit's sheet where there is none, and shows the picked one", async () => {
		jest.mocked(showSystemPicker).mockReturnValue(false);
		const onChange = jest.fn();
		const ref = React.createRef<ViewInstance>();
		await render(<NativeSelect ref={ref} label="Food" options={FRUITS} value="apple" onChange={onChange} testID="select" />);
		expect(screen.getByText("Apple")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("combobox", { name: /Food/u }));
		await fireEvent.press(screen.getByText("Carrot"));
		expect(onChange).toHaveBeenCalledWith("carrot");
		expect(ref.current).not.toBeNull();
	});
});

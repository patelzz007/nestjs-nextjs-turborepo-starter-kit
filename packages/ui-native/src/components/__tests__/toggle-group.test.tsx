import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { ToggleGroup, toggleGroupValues, type ToggleGroupOption } from "../toggle-group";

type Style = "bold" | "italic" | "underline";

const OPTIONS: readonly ToggleGroupOption<Style>[] = [
	{ value: "bold", label: "Bold" },
	{ value: "italic", label: "Italic" },
	{ value: "underline", label: "Underline", accessibilityLabel: "Underlined" },
];

describe("ToggleGroup", () => {
	describe('type="single"', () => {
		it("is a radio group that reports a new choice and keeps the current one", async () => {
			const onChange = jest.fn();
			await render(<ToggleGroup<Style> type="single" label="Text style" options={OPTIONS} value="bold" onChange={onChange} />);

			expect(screen.getByLabelText("Text style")).toHaveProp("role", "radiogroup");
			expect(screen.getByRole("radio", { name: "Bold" })).toBeChecked();
			expect(screen.getByRole("radio", { name: "Underlined" })).not.toBeChecked();

			await fireEvent.press(screen.getByRole("radio", { name: "Bold" }));
			expect(onChange).not.toHaveBeenCalled();
			await fireEvent.press(screen.getByRole("radio", { name: "Italic" }));
			expect(onChange).toHaveBeenCalledWith("italic");
		});

		it("releases the pressed chip when deselectable", async () => {
			const onChange = jest.fn();
			await render(<ToggleGroup<Style> type="single" deselectable label="Text style" options={OPTIONS} value="bold" onChange={onChange} />);

			await fireEvent.press(screen.getByRole("radio", { name: "Bold" }));
			expect(onChange).toHaveBeenCalledWith(null);
		});
	});

	describe('type="multiple"', () => {
		it("is a group of checkboxes that reports the new set in the options' order", async () => {
			const onChange = jest.fn();
			await render(<ToggleGroup<Style> type="multiple" label="Text style" options={OPTIONS} value={["underline"]} onChange={onChange} />);

			expect(screen.getByLabelText("Text style")).toHaveProp("role", "group");
			expect(screen.getByRole("checkbox", { name: "Underlined" })).toBeChecked();

			await fireEvent.press(screen.getByRole("checkbox", { name: "Bold" }));
			expect(onChange).toHaveBeenLastCalledWith(["bold", "underline"]);
			await fireEvent.press(screen.getByRole("checkbox", { name: "Underlined" }));
			expect(onChange).toHaveBeenLastCalledWith([]);
		});
	});

	it("blocks presses while disabled or loading, and disables single options", async () => {
		const onChange = jest.fn();
		await render(<ToggleGroup<Style> type="single" label="Text style" options={OPTIONS} value="bold" onChange={onChange} disabled />);
		expect(screen.getByRole("radio", { name: "Italic" })).toBeDisabled();
		await fireEvent.press(screen.getByRole("radio", { name: "Italic" }));

		await render(<ToggleGroup<Style> type="single" label="Text style" options={OPTIONS} value="bold" onChange={onChange} loading />);
		expect(screen.getByRole("radio", { name: "Italic" })).toBeBusy();
		await fireEvent.press(screen.getByRole("radio", { name: "Italic" }));
		expect(onChange).not.toHaveBeenCalled();

		await render(<ToggleGroup<Style> type="single" label="Text style" options={[{ value: "bold", label: "Bold", disabled: true }]} value={null} onChange={onChange} />);
		expect(screen.getByRole("radio", { name: "Bold" })).toBeDisabled();
	});

	it("outlines its chips while invalid, unless disabled", async () => {
		await render(<ToggleGroup<Style> type="single" label="Text style" options={OPTIONS} value={null} onChange={jest.fn()} invalid />);
		expect(screen.getByRole("radio", { name: "Bold" })).toHaveProp("className", expect.stringContaining("border-destructive"));

		await render(<ToggleGroup<Style> type="single" label="Text style" options={OPTIONS} value={null} onChange={jest.fn()} invalid disabled />);
		expect(screen.getByRole("radio", { name: "Bold" })).not.toHaveProp("className", expect.stringContaining("border-destructive"));
	});

	it("passes its variant and size to its chips", async () => {
		await render(<ToggleGroup<Style> type="single" label="Text style" options={OPTIONS} value="bold" onChange={jest.fn()} variant="outline" size="sm" />);
		const chip = screen.getByRole("radio", { name: "Italic" });
		expect(chip).toHaveProp("className", expect.stringContaining("border-input"));
		expect(chip).toHaveProp("hitSlop", 4);
	});

	it("forwards its ref, merges the caller's className last and reports focus and blur", async () => {
		const ref = React.createRef<ViewInstance>();
		const onFocus = jest.fn();
		const onBlur = jest.fn();
		await render(
			<ToggleGroup<Style>
				ref={ref}
				type="multiple"
				label="Text style"
				options={OPTIONS}
				value={[]}
				onChange={jest.fn()}
				onFocus={onFocus}
				onBlur={onBlur}
				className="gap-4"
			/>,
		);

		expect(ref.current).not.toBeNull();
		const className = String(screen.getByLabelText("Text style").props.className);
		expect(className).toContain("gap-4");
		expect(className).not.toContain("gap-2");
		await fireEvent(screen.getByRole("checkbox", { name: "Bold" }), "focus");
		await fireEvent(screen.getByRole("checkbox", { name: "Bold" }), "blur");
		expect(onFocus).toHaveBeenCalledTimes(1);
		expect(onBlur).toHaveBeenCalledTimes(1);
	});
});

describe("toggleGroupValues", () => {
	it("adds or removes the pressed value, keeping the options' order", () => {
		expect(toggleGroupValues(OPTIONS, ["underline"], "bold")).toEqual(["bold", "underline"]);
		expect(toggleGroupValues(OPTIONS, ["bold", "underline"], "bold")).toEqual(["underline"]);
	});
});

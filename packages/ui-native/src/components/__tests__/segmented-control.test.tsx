import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { View } from "react-native";

import { SegmentedControl, type SegmentedOption } from "../segmented-control";

type Range = "week" | "month" | "quarter";

const OPTIONS: readonly SegmentedOption<Range>[] = [
	{ value: "week", label: "7D", accessibilityLabel: "Last 7 days" },
	{ value: "month", label: "30D" },
	{ value: "quarter", label: "90D" },
];

const TRACK_WIDTH = 300;

function layoutOf(width: number): { readonly nativeEvent: { readonly layout: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } } } {
	return { nativeEvent: { layout: { x: 0, y: 0, width, height: 44 } } };
}

describe("SegmentedControl", () => {
	it("is a radio group whose segments are named in full", async () => {
		await render(<SegmentedControl label="Date range" options={OPTIONS} value="week" onChange={jest.fn()} testID="range" />);
		await fireEvent(screen.getByTestId("range"), "layout", layoutOf(TRACK_WIDTH));

		expect(screen.getByLabelText("Date range")).toHaveProp("accessibilityRole", "radiogroup");
		expect(screen.getByRole("radio", { name: "Last 7 days" })).toBeChecked();
		expect(screen.getByRole("radio", { name: "30D" })).not.toBeChecked();
	});

	it("reports a new choice, and nothing for the current one", async () => {
		const onChange = jest.fn();
		await render(<SegmentedControl label="Date range" options={OPTIONS} value="week" onChange={onChange} />);

		await fireEvent.press(screen.getByRole("radio", { name: "Last 7 days" }));
		expect(onChange).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByRole("radio", { name: "90D" }));
		expect(onChange).toHaveBeenCalledWith("quarter");
	});

	it("blocks presses while disabled or loading", async () => {
		const onChange = jest.fn();
		await render(<SegmentedControl label="Date range" options={OPTIONS} value="week" onChange={onChange} disabled />);
		expect(screen.getByRole("radio", { name: "30D" })).toBeDisabled();
		await fireEvent.press(screen.getByRole("radio", { name: "30D" }));

		await render(<SegmentedControl label="Date range" options={OPTIONS} value="week" onChange={onChange} loading />);
		expect(screen.getByLabelText("Date range")).toBeBusy();
		await fireEvent.press(screen.getByRole("radio", { name: "30D" }));
		expect(onChange).not.toHaveBeenCalled();
	});

	it("outlines the track while invalid, unless disabled", async () => {
		await render(<SegmentedControl label="Date range" options={OPTIONS} value="week" onChange={jest.fn()} invalid />);
		expect(screen.getByLabelText("Date range")).toHaveProp("className", expect.stringContaining("border-destructive"));

		await render(<SegmentedControl label="Date range" options={OPTIONS} value="week" onChange={jest.fn()} invalid disabled />);
		expect(screen.getByLabelText("Date range")).not.toHaveProp("className", expect.stringContaining("border-destructive"));
	});

	it("has an outline variant and a compact size whose segments still reach 44 pt", async () => {
		await render(<SegmentedControl label="Date range" options={OPTIONS} value="week" onChange={jest.fn()} variant="outline" size="sm" />);

		expect(screen.getByLabelText("Date range")).toHaveProp("className", expect.stringContaining("border-border"));
		const segment = screen.getByRole("radio", { name: "30D" });
		expect(segment).toHaveProp("className", expect.stringContaining("min-h-9"));
		expect(segment).toHaveProp("hitSlop", 4);
	});

	it("forwards its ref and merges the caller's className last", async () => {
		const ref = React.createRef<View>();
		await render(<SegmentedControl ref={ref} label="Date range" options={OPTIONS} value="week" onChange={jest.fn()} className="self-stretch p-2" />);

		expect(ref.current).not.toBeNull();
		const className = String(screen.getByLabelText("Date range").props.className);
		expect(className).toContain("p-2");
		expect(className).not.toContain("p-1");
	});

	it("reports focus and blur from its segments", async () => {
		const onFocus = jest.fn();
		const onBlur = jest.fn();
		await render(<SegmentedControl label="Date range" options={OPTIONS} value="week" onChange={jest.fn()} onFocus={onFocus} onBlur={onBlur} />);
		await fireEvent(screen.getByRole("radio", { name: "30D" }), "focus");
		await fireEvent(screen.getByRole("radio", { name: "30D" }), "blur");
		expect(onFocus).toHaveBeenCalledTimes(1);
		expect(onBlur).toHaveBeenCalledTimes(1);
	});
});

import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { View } from "react-native";

import { clampSliderValue, Slider, sliderFractionOf, sliderValueAt, snapSliderValue } from "../slider";

const TRACK_WIDTH = 300;
/** The md thumb's side: its centre follows the finger. */
const THUMB = 24;
const RANGE = { min: 0, max: 100, step: 1 };

function layoutOf(width: number): { readonly nativeEvent: { readonly layout: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } } } {
	return { nativeEvent: { layout: { x: 0, y: 0, width, height: THUMB } } };
}

function touchAt(locationX: number, pageX: number): { readonly nativeEvent: { readonly locationX: number; readonly pageX: number } } {
	return { nativeEvent: { locationX, pageX } };
}

function action(actionName: string): { readonly nativeEvent: { readonly actionName: string } } {
	return { nativeEvent: { actionName } };
}

function asPercent(value: number): string {
	return `${String(value)} %`;
}

async function renderMeasured(element: React.JSX.Element): Promise<void> {
	await render(element);
	await fireEvent(screen.getByTestId("volume-rail"), "layout", layoutOf(TRACK_WIDTH));
}

describe("Slider", () => {
	it("is an adjustable control named by its label, with its value and bounds", async () => {
		await render(<Slider accessibilityLabel="Volume" value={40} onChange={jest.fn()} formatValue={asPercent} />);

		const slider = screen.getByRole("adjustable", { name: "Volume" });
		expect(slider).toHaveProp("accessibilityValue", { min: 0, max: 100, now: 40, text: "40 %" });
	});

	it("reports values while dragged, and the final one when let go", async () => {
		const onChange = jest.fn();
		const onChangeEnd = jest.fn();
		await renderMeasured(<Slider accessibilityLabel="Volume" value={10} onChange={onChange} onChangeEnd={onChangeEnd} testID="volume" />);
		const slider = screen.getByRole("adjustable");

		// The middle of the thumb's travel is half way.
		await fireEvent(slider, "responderGrant", touchAt(THUMB / 2 + (TRACK_WIDTH - THUMB) / 2, 200));
		expect(onChange).toHaveBeenLastCalledWith(50);
		await fireEvent(slider, "responderMove", touchAt(0, 200 + (TRACK_WIDTH - THUMB) / 10));
		expect(onChange).toHaveBeenLastCalledWith(60);
		// Past the end, it stops at the maximum.
		await fireEvent(slider, "responderMove", touchAt(0, 900));
		expect(onChange).toHaveBeenLastCalledWith(100);
		await fireEvent(slider, "responderRelease", touchAt(0, 900));

		expect(onChangeEnd).toHaveBeenCalledTimes(1);
		expect(onChangeEnd).toHaveBeenCalledWith(100);
	});

	it("steps by `step` on screen-reader increments and decrements, within its bounds", async () => {
		const onChange = jest.fn();
		const onChangeEnd = jest.fn();
		const { rerender } = await render(<Slider accessibilityLabel="Volume" value={40} step={5} onChange={onChange} onChangeEnd={onChangeEnd} testID="volume" />);
		await fireEvent(screen.getByTestId("volume-rail"), "layout", layoutOf(TRACK_WIDTH));

		await fireEvent(screen.getByRole("adjustable"), "accessibilityAction", action("increment"));
		expect(onChange).toHaveBeenLastCalledWith(45);
		expect(onChangeEnd).toHaveBeenLastCalledWith(45);
		await fireEvent(screen.getByRole("adjustable"), "accessibilityAction", action("decrement"));
		expect(onChange).toHaveBeenLastCalledWith(35);

		onChange.mockClear();
		await rerender(<Slider accessibilityLabel="Volume" value={100} step={5} onChange={onChange} testID="volume" />);
		await fireEvent(screen.getByRole("adjustable"), "accessibilityAction", action("increment"));
		expect(onChange).not.toHaveBeenCalled();
	});

	it("ignores drags and steps while disabled or loading", async () => {
		const onChange = jest.fn();
		await renderMeasured(<Slider accessibilityLabel="Volume" value={40} onChange={onChange} disabled testID="volume" />);
		expect(screen.getByRole("adjustable")).toBeDisabled();
		await fireEvent(screen.getByRole("adjustable"), "responderGrant", touchAt(TRACK_WIDTH / 2, 0));
		await fireEvent(screen.getByRole("adjustable"), "accessibilityAction", action("increment"));

		await renderMeasured(<Slider accessibilityLabel="Volume" value={40} onChange={onChange} loading testID="volume" />);
		expect(screen.getByRole("adjustable")).toBeBusy();
		await fireEvent(screen.getByRole("adjustable"), "accessibilityAction", action("increment"));
		expect(onChange).not.toHaveBeenCalled();
	});

	it("shows the error state on its range and thumb while invalid, unless disabled", async () => {
		await render(<Slider accessibilityLabel="Volume" value={40} onChange={jest.fn()} invalid />);
		expect(JSON.stringify(screen.toJSON())).toContain("border-destructive");

		await render(<Slider accessibilityLabel="Volume" value={40} onChange={jest.fn()} invalid disabled />);
		expect(JSON.stringify(screen.toJSON())).not.toContain("border-destructive");
	});

	it("has a compact size", async () => {
		await render(<Slider accessibilityLabel="Volume" value={40} onChange={jest.fn()} size="sm" />);
		expect(JSON.stringify(screen.toJSON())).toContain("size-5");
	});

	it("forwards its ref and merges the caller's className last", async () => {
		const ref = React.createRef<View>();
		await render(<Slider ref={ref} accessibilityLabel="Volume" value={40} onChange={jest.fn()} className="mx-2 min-h-12" />);

		expect(ref.current).not.toBeNull();
		const className = String(screen.getByRole("adjustable").props.className);
		expect(className).toContain("min-h-12");
		expect(className).not.toContain("min-h-11");
	});
});

describe("slider value math", () => {
	it("clamps to the bounds", () => {
		expect(clampSliderValue(-5, 0, 10)).toBe(0);
		expect(clampSliderValue(15, 0, 10)).toBe(10);
		expect(clampSliderValue(7, 0, 10)).toBe(7);
	});

	it("snaps to the nearest step from the minimum, without floating-point noise", () => {
		expect(snapSliderValue(0.31, { min: 0, max: 1, step: 0.1 })).toBe(0.3);
		expect(snapSliderValue(17, { min: 5, max: 50, step: 5 })).toBe(15);
		expect(snapSliderValue(99, { min: 0, max: 50, step: 5 })).toBe(50);
	});

	it("places a value along the track", () => {
		expect(sliderFractionOf(25, 0, 100)).toBe(0.25);
		expect(sliderFractionOf(5, 5, 5)).toBe(0);
	});

	it("reads the value under a touch, with the ends half a thumb in", () => {
		expect(sliderValueAt(THUMB / 2, TRACK_WIDTH, THUMB, RANGE)).toBe(0);
		expect(sliderValueAt(TRACK_WIDTH - THUMB / 2, TRACK_WIDTH, THUMB, RANGE)).toBe(100);
		expect(sliderValueAt(0, TRACK_WIDTH, THUMB, RANGE)).toBe(0);
		expect(sliderValueAt(TRACK_WIDTH / 2, THUMB, THUMB, RANGE)).toBe(0);
	});
});

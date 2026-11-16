import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { moveThumb, nearestThumb, RangeSlider } from "../range-slider";
import { Slider } from "../slider";

const RANGE = { min: 0, max: 100, step: 1 };
const LABELS: readonly string[] = ["Minimum", "Maximum"];

describe("moveThumb and nearestThumb", () => {
	it("keep a thumb between its neighbours, the least gap apart, and within the bounds", () => {
		expect(moveThumb([20, 60], 0, 70, RANGE, 5)).toStrictEqual([55, 60]);
		expect(moveThumb([20, 60], 1, 10, RANGE, 5)).toStrictEqual([20, 25]);
		expect(moveThumb([20, 60], 1, 140, RANGE, 0)).toStrictEqual([20, 100]);
	});

	it("pick the thumb nearest to a touch, the later one on a tie", () => {
		expect(nearestThumb([10, 40, 80], 45)).toBe(1);
		expect(nearestThumb([50, 50], 50)).toBe(1);
	});
});

describe("RangeSlider", () => {
	it("moves the nearest thumb where the track is touched, and reports the end of the drag", async () => {
		const onChange = jest.fn();
		const onChangeEnd = jest.fn();
		await render(<RangeSlider value={[25, 75]} onChange={onChange} onChangeEnd={onChangeEnd} thumbLabels={LABELS} testID="range" />);
		const touchArea = screen.getByTestId("range");
		await fireEvent(screen.getByTestId("range-rail"), "layout", { nativeEvent: { layout: { width: 224, height: 24 } } });
		await fireEvent(touchArea, "responderGrant", { nativeEvent: { locationX: 212, locationY: 12 } });
		expect(onChange).toHaveBeenLastCalledWith([25, 100]);
		await fireEvent(touchArea, "responderRelease");
		expect(onChangeEnd).toHaveBeenCalled();
	});

	it("names each thumb, and steps it for a screen reader within its neighbours", async () => {
		const onChange = jest.fn();
		const ref = React.createRef<ViewInstance>();
		await render(<RangeSlider ref={ref} value={[25, 26]} onChange={onChange} thumbLabels={LABELS} minDistance={1} testID="range" />);
		const minimum = screen.getByLabelText("Minimum");
		expect(minimum).toHaveProp("accessibilityValue", { min: 0, max: 100, now: 25 });
		await fireEvent(minimum, "accessibilityAction", { nativeEvent: { actionName: "increment" } });
		expect(onChange).toHaveBeenLastCalledWith([25, 26]);
		await fireEvent(minimum, "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
		expect(onChange).toHaveBeenLastCalledWith([24, 26]);
		expect(ref.current).not.toBeNull();
	});

	it("takes no steps while disabled", async () => {
		const onChange = jest.fn();
		await render(<RangeSlider value={[25, 75]} onChange={onChange} thumbLabels={LABELS} disabled />);
		await fireEvent(screen.getByLabelText("Maximum"), "accessibilityAction", { nativeEvent: { actionName: "increment" } });
		expect(onChange).not.toHaveBeenCalled();
	});
});

function asPercent(value: number): string {
	return String(value) + "%";
}

describe("Slider extras", () => {
	it("labels its marks under the track and rides its value in a bubble", async () => {
		const marks = [{ value: 0, label: "0" }, { value: 50 }, { value: 100, label: "100" }];
		await render(
			<Slider
				value={40}
				onChange={jest.fn()}
				accessibilityLabel="Volume"
				marks={marks}
				showValueBubble
				formatValue={asPercent}
				trackClassName="bg-tone-yellow-soft"
				testID="slider"
			/>,
		);
		await fireEvent(screen.getByTestId("slider-rail"), "layout", { nativeEvent: { layout: { width: 224, height: 24 } } });
		expect(screen.getByText("40%")).toBeOnTheScreen();
		expect(screen.getByText("100", { includeHiddenElements: true })).toBeOnTheScreen();
	});
});

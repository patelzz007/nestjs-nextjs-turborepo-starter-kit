import { fireEvent, render, screen, within } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import * as React from "react";

import { describeKpiChange, KpiTile, type KpiChange } from "../kpi-tile";
import { RankedBarList } from "../ranked-bar-list";
import { SegmentedControl, type SegmentedOption } from "@workspace/ui-native/components/segmented-control";
import { ShareBar, type ShareSegment } from "../share-bar";
import { Sparkline } from "../sparkline";
import { axisLabelsOf, TrendChart, type TrendSeries } from "../trend-chart";

/** Axis labels, the readout and sparklines are hidden from screen readers (the plot speaks for them): query them anyway. */
const HIDDEN = { includeHiddenElements: true };

/** A layout event as React Native reports one. */
function layoutOf(width: number): { readonly nativeEvent: { readonly layout: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } } } {
	return { nativeEvent: { layout: { x: 0, y: 0, width, height: 168 } } };
}

/** A touch at `locationX` on the element it lands on. */
function touchAt(locationX: number): { readonly nativeEvent: { readonly locationX: number; readonly locationY: number } } {
	return { nativeEvent: { locationX, locationY: 40 } };
}

function formatRinggit(value: number): string {
	return `RM ${String(value)}`;
}

describe("TrendChart", () => {
	const SPENT: TrendSeries = { key: "spent", label: "Spent", color: "chart-1", values: [10, 45, 25, 0, 30] };
	const BUCKETS = ["Wed, 1 Oct", "Thu, 2 Oct", "Fri, 3 Oct", "Sat, 4 Oct", "Sun, 5 Oct"];
	const TICKS = ["1 Oct", "2 Oct", "3 Oct", "4 Oct", "5 Oct"];

	async function renderChart(series: readonly TrendSeries[] = [SPENT]): Promise<void> {
		await render(
			<TrendChart
				title="Spending over time"
				series={series}
				bucketLabels={BUCKETS}
				tickLabels={TICKS}
				formatValue={formatRinggit}
				formatTick={formatRinggit}
				hint="Touch the chart to see each day"
				testID="chart"
			/>,
		);
		await fireEvent(screen.getByTestId("chart-frame"), "layout", layoutOf(312));
	}

	it("draws the series with round ticks and the first, middle and last bucket", async () => {
		await renderChart();

		expect(screen.getByTestId("chart-spent")).toBeOnTheScreen();
		expect(screen.getByText("RM 60", HIDDEN)).toBeOnTheScreen();
		expect(screen.getByText("RM 0", HIDDEN)).toBeOnTheScreen();
		expect(screen.getByText("1 Oct", HIDDEN)).toBeOnTheScreen();
		expect(screen.getByText("3 Oct", HIDDEN)).toBeOnTheScreen();
		expect(screen.getByText("5 Oct", HIDDEN)).toBeOnTheScreen();
		expect(screen.queryByText("2 Oct", HIDDEN)).toBeNull();
		expect(screen.getByText("Touch the chart to see each day")).toBeOnTheScreen();
	});

	it("keeps the tick values beside the plot, never inside it where a line could cross them", async () => {
		await renderChart();
		const plot = screen.getByTestId("chart-frame");

		expect(within(plot).queryByText("RM 60", HIDDEN)).toBeNull();
		expect(within(plot).queryByText("RM 0", HIDDEN)).toBeNull();
		expect(screen.getByText("RM 60", HIDDEN)).toBeOnTheScreen();
	});

	it("reads out the bucket under a finger, and follows it as it moves", async () => {
		const selection = jest.spyOn(Haptics, "selectionAsync");
		await renderChart();
		const plot = screen.getByTestId("chart-plot");

		// The plot spans 300 pt between its 6 pt insets: x 81 is nearest the second of five values.
		await fireEvent(plot, "responderGrant", touchAt(81));
		expect(screen.getByText("Thu, 2 Oct", HIDDEN)).toBeOnTheScreen();
		expect(screen.getByText("RM 45", HIDDEN)).toBeOnTheScreen();
		expect(plot).toHaveAccessibilityValue({ text: "Thu, 2 Oct: Spent RM 45" });

		await fireEvent(plot, "responderMove", touchAt(306));
		expect(screen.getByText("Sun, 5 Oct", HIDDEN)).toBeOnTheScreen();
		expect(selection).toHaveBeenCalledTimes(2);

		// The same bucket again: no new tick under the finger.
		await fireEvent(plot, "responderMove", touchAt(300));
		expect(selection).toHaveBeenCalledTimes(2);
		selection.mockRestore();
	});

	it("steps through the buckets with the screen reader's adjustable actions", async () => {
		await renderChart();
		const plot = screen.getByTestId("chart-plot");

		expect(plot).toHaveAccessibleName("Spending over time");
		expect(plot).toHaveAccessibilityValue({ text: "Touch the chart to see each day" });
		await fireEvent(plot, "accessibilityAction", { nativeEvent: { actionName: "increment" } });
		expect(plot).toHaveAccessibilityValue({ text: "Wed, 1 Oct: Spent RM 10" });
		await fireEvent(plot, "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
		expect(plot).toHaveAccessibilityValue({ text: "Wed, 1 Oct: Spent RM 10" });
		await fireEvent(plot, "accessibilityAction", { nativeEvent: { actionName: "increment" } });
		expect(plot).toHaveAccessibilityValue({ text: "Thu, 2 Oct: Spent RM 45" });
	});

	it("starts from the last bucket when the first step is back", async () => {
		await renderChart();
		const plot = screen.getByTestId("chart-plot");

		await fireEvent(plot, "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
		expect(plot).toHaveAccessibilityValue({ text: "Sun, 5 Oct: Spent RM 30" });
	});

	it("names two series in a legend and in the readout", async () => {
		const redeemed: TrendSeries = { key: "redeemed", label: "Redeemed", color: "chart-2", values: [1, 2, 0, 0, 3] };
		await renderChart([{ ...SPENT, label: "Claimed" }, redeemed]);

		expect(screen.getByLabelText("Legend: Claimed, Redeemed")).toBeOnTheScreen();
		await fireEvent(screen.getByTestId("chart-plot"), "responderGrant", touchAt(6));
		expect(screen.getByTestId("chart-plot")).toHaveAccessibilityValue({ text: "Wed, 1 Oct: Claimed RM 10, Redeemed RM 1" });
	});

	it("draws nothing until it knows its width", async () => {
		await render(
			<TrendChart
				title="Spending"
				series={[SPENT]}
				bucketLabels={BUCKETS}
				tickLabels={TICKS}
				formatValue={formatRinggit}
				formatTick={formatRinggit}
				hint="Touch"
				testID="chart"
			/>,
		);

		expect(screen.queryByTestId("chart-spent")).toBeNull();
	});
});

describe("axisLabelsOf", () => {
	it("keeps a short range's labels and thins a long one to its ends and middle", () => {
		expect(axisLabelsOf(["a", "b"])).toStrictEqual(["a", "b"]);
		expect(axisLabelsOf(["a", "b", "c", "d", "e", "f"])).toStrictEqual(["a", "c", "f"]);
	});
});

describe("Sparkline", () => {
	it("draws once measured, hidden from screen readers", async () => {
		await render(<Sparkline values={[1, 3, 2]} color="chart-1" testID="spark" />);
		const box = screen.getByTestId("spark", HIDDEN);

		expect(box.props.accessibilityElementsHidden).toBe(true);
		expect(screen.queryByTestId("spark-line", HIDDEN)).toBeNull();
		await fireEvent(box, "layout", layoutOf(120));
		expect(screen.getByTestId("spark-line", HIDDEN)).toBeOnTheScreen();
	});
});

describe("KpiTile", () => {
	const UP: KpiChange = { status: "change", direction: "up", sentiment: "positive", label: "+12.4%" };

	it("reads as one sentence: label, value and how it moved", async () => {
		await render(<KpiTile label="Total spent" value="RM 412.30" change={UP} comparisonLabel="vs previous 30 days" size="hero" testID="kpi" />);

		expect(screen.getByTestId("kpi")).toHaveAccessibleName("Total spent: RM 412.30. Up +12.4% vs previous 30 days");
		expect(screen.getByText("+12.4%")).toBeOnTheScreen();
		expect(screen.getByText("vs previous 30 days")).toBeOnTheScreen();
	});

	it("says when there is nothing to compare with, without a period", async () => {
		await render(
			<KpiTile
				label="Shop visits"
				value="4"
				change={{ status: "noPrevious", label: "No data in the previous period" }}
				comparisonLabel="vs previous 7 days"
				trend={{ values: [0, 1], color: "chart-1" }}
			/>,
		);

		expect(screen.getByText("No data in the previous period")).toBeOnTheScreen();
		expect(screen.queryByText("vs previous 7 days")).toBeNull();
	});

	it("describes falls and flat changes in words", () => {
		expect(describeKpiChange({ status: "change", direction: "down", sentiment: "negative", label: "-3%" }, "vs previous 7 days")).toBe("Down -3% vs previous 7 days");
		expect(describeKpiChange({ status: "change", direction: "flat", sentiment: "neutral", label: "0%" }, "vs previous 7 days")).toBe("No change vs previous 7 days");
	});
});

describe("ShareBar", () => {
	const SEGMENTS: readonly ShareSegment[] = [
		{ key: "PENDING", label: "Waiting to be used", color: "chart-1", value: 3, valueLabel: "3", shareLabel: "37.5%" },
		{ key: "REDEEMED", label: "Redeemed", color: "chart-2", value: 5, valueLabel: "5", shareLabel: "62.5%" },
		{ key: "EXPIRED", label: "Expired", color: "chart-3", value: 0, valueLabel: "0", shareLabel: "0%" },
	];

	it("fills the bar with the non-zero parts and lists every part in the legend", async () => {
		await render(<ShareBar title="Your claims by status" segments={SEGMENTS} />);

		expect(screen.getByTestId("share-part-PENDING")).toHaveStyle({ flexGrow: 3 });
		expect(screen.getByTestId("share-part-REDEEMED")).toHaveStyle({ flexGrow: 5 });
		expect(screen.queryByTestId("share-part-EXPIRED")).toBeNull();
		expect(screen.getByLabelText("Expired: 0, 0%")).toBeOnTheScreen();
		expect(screen.getByLabelText("Your claims by status: Waiting to be used 37.5%, Redeemed 62.5%, Expired 0%")).toBeOnTheScreen();
	});
});

describe("RankedBarList", () => {
	it("names each row with its value and detail, the bars in proportion to the top one", async () => {
		await render(
			<RankedBarList
				items={[
					{ key: "a", label: "Kopi Kaki", detail: "Café · 4 visits", value: 200, valueLabel: "RM 2.00" },
					{ key: "b", label: "Urban Threads", value: 50, valueLabel: "RM 0.50" },
				]}
			/>,
		);

		expect(screen.getByLabelText("Kopi Kaki: RM 2.00, Café · 4 visits")).toBeOnTheScreen();
		const row = screen.getByLabelText("Urban Threads: RM 0.50");
		expect(within(row).getByText("RM 0.50")).toBeOnTheScreen();
	});
});

describe("SegmentedControl", () => {
	const OPTIONS: readonly SegmentedOption<"week" | "month">[] = [
		{ value: "week", label: "7D", accessibilityLabel: "Last 7 days" },
		{ value: "month", label: "30D" },
	];

	it("is a radio group whose segments are named in full", async () => {
		await render(<SegmentedControl label="Date range" options={OPTIONS} value="week" onChange={jest.fn()} testID="range" />);
		await fireEvent(screen.getByTestId("range"), "layout", layoutOf(300));

		expect(screen.getByLabelText("Date range")).toHaveProp("accessibilityRole", "radiogroup");
		expect(screen.getByRole("radio", { name: "Last 7 days" })).toBeChecked();
		expect(screen.getByRole("radio", { name: "30D" })).not.toBeChecked();
	});

	it("reports a new choice, and nothing for the current one", async () => {
		const onChange = jest.fn();
		await render(<SegmentedControl label="Date range" options={OPTIONS} value="week" onChange={onChange} />);

		await fireEvent.press(screen.getByRole("radio", { name: "Last 7 days" }));
		expect(onChange).not.toHaveBeenCalled();
		await fireEvent.press(screen.getByRole("radio", { name: "30D" }));
		expect(onChange).toHaveBeenCalledWith("month");
	});
});

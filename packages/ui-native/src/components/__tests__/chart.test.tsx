import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";

import type { ChartCurve } from "../../lib/chart";
import {
	AreaChart,
	BarChart,
	ChartLegend,
	type BarChartProps,
	describeChartDatum,
	PieChart,
	RadarChart,
	RadialBarChart,
	type ChartDatum,
	type ChartSeries,
	type ChartSliceDatum,
} from "../chart";

const DATA: readonly ChartDatum[] = [
	{ label: "January", values: { desktop: 300, mobile: 120 } },
	{ label: "February", values: { desktop: 550, mobile: 200 } },
	{ label: "March", values: { desktop: 400 } },
];

const DESKTOP: ChartSeries = { key: "desktop", label: "Desktop", color: "chart-1" };
const MOBILE: ChartSeries = { key: "mobile", label: "Mobile", color: "chart-2", fill: { kind: "stripes" }, outline: true };

const SLICES: readonly ChartSliceDatum[] = [
	{ key: "direct", label: "Direct", value: 40, color: "chart-1", fill: { kind: "gradient", tone: "deep" } },
	{ key: "search", label: "Search", value: 35, color: "chart-2", fill: { kind: "dots" } },
	{ key: "social", label: "Social", value: 25, color: "chart-3", fill: { kind: "crosshatch" } },
	{ key: "none", label: "None", value: 0, color: "chart-4" },
];

const CURVES: readonly ChartCurve[] = ["step", "linear", "natural"];

const PLOT = { nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 220 } } };

function dollars(value: number): string {
	return `$${String(value)}`;
}

function short(label: string): string {
	return label.slice(0, 3);
}

/** Gives the chart's plot a size, as layout would on a device. */
async function layOut(testID = "chart"): Promise<void> {
	await fireEvent(screen.getByTestId(`${testID}-plot`), "layout", PLOT);
}

describe("describeChartDatum", () => {
	it("reads a category's values, a missing value as zero", () => {
		const [, , march] = DATA;
		expect(march === undefined ? "" : describeChartDatum(march, [DESKTOP, MOBILE], dollars)).toBe("March: Desktop $400, Mobile $0");
		expect(march === undefined ? "" : describeChartDatum(march, [DESKTOP])).toBe("March: Desktop 400");
	});
});

describe("BarChart", () => {
	it("is an image named by its label, with a target per category that reads its values", async () => {
		await render(<BarChart data={DATA} series={[DESKTOP, MOBILE]} accessibilityLabel="Visitors by month" formatValue={dollars} formatCategory={short} testID="chart" />);
		await layOut();

		expect(screen.getByRole("image", { name: "Visitors by month" })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "January: Desktop $300, Mobile $120" })).toBeOnTheScreen();
		expect(screen.getByText("Jan", { includeHiddenElements: true })).toBeOnTheScreen();
		expect(screen.getByLabelText("Desktop")).toBeOnTheScreen();
		expect(screen.getByLabelText("Mobile")).toBeOnTheScreen();
	});

	it("selects a category on a tap, shows its values, and clears on a second tap", async () => {
		await render(<BarChart data={DATA} series={[DESKTOP, MOBILE]} accessibilityLabel="Visitors" formatValue={dollars} testID="chart" />);
		await layOut();

		const target = screen.getByRole("button", { name: /^February/u });
		await fireEvent.press(target);
		expect(screen.getByText("February")).toBeOnTheScreen();
		expect(screen.getByText("$550")).toBeOnTheScreen();
		expect(target).toHaveProp("accessibilityState", { selected: true });

		await fireEvent.press(target);
		expect(screen.queryByText("$550")).toBeNull();
	});

	it("reports a controlled selection and follows it", async () => {
		const onSelectedIndexChange = jest.fn();
		const { rerender } = await render(
			<BarChart data={DATA} series={[DESKTOP]} accessibilityLabel="Visitors" selectedIndex={null} onSelectedIndexChange={onSelectedIndexChange} testID="chart" />,
		);
		await layOut();

		await fireEvent.press(screen.getByRole("button", { name: /^March/u }));
		expect(onSelectedIndexChange).toHaveBeenCalledWith(2);
		expect(screen.queryByText("400")).toBeNull();

		await rerender(<BarChart data={DATA} series={[DESKTOP]} accessibilityLabel="Visitors" selectedIndex={2} onSelectedIndexChange={onSelectedIndexChange} testID="chart" />);
		expect(screen.getByText("400")).toBeOnTheScreen();
	});

	it("names a single series in no legend, and can hide or force one", async () => {
		const { rerender } = await render(<BarChart data={DATA} series={[DESKTOP]} accessibilityLabel="Visitors" />);
		expect(screen.queryByLabelText("Desktop")).toBeNull();

		await rerender(<BarChart data={DATA} series={[DESKTOP]} accessibilityLabel="Visitors" legend />);
		expect(screen.getByLabelText("Desktop")).toBeOnTheScreen();
	});

	it("draws horizontal bars, dashed or no gridlines, and every bar shape", async () => {
		const shapes: readonly NonNullable<BarChartProps["shape"]>[] = ["rounded", "thin", "block", "isometric"];
		for (const shape of shapes) {
			const { unmount } = await render(
				<BarChart data={DATA} series={[DESKTOP, MOBILE]} accessibilityLabel="Visitors" shape={shape} grid="dashed" radius="lg" testID="chart" />,
			);
			await layOut();
			expect(screen.getByRole("image", { name: "Visitors" })).toBeOnTheScreen();
			await unmount();
		}
		await render(<BarChart data={DATA} series={[DESKTOP]} accessibilityLabel="Across" orientation="horizontal" grid="none" radius="none" testID="chart" />);
		await layOut();
		expect(screen.getByRole("button", { name: "January: Desktop 300" })).toBeOnTheScreen();
	});

	it("prints a thin bar's value above it once selected", async () => {
		await render(<BarChart data={DATA} series={[DESKTOP]} accessibilityLabel="Visitors" shape="thin" formatValue={dollars} testID="chart" />);
		await layOut();

		await fireEvent.press(screen.getByRole("button", { name: /^February/u }));

		expect(screen.getAllByText("$550")).toHaveLength(2);
	});

	it("forwards its ref and merges the caller's className", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<BarChart ref={ref} data={DATA} series={[DESKTOP]} accessibilityLabel="Visitors" className="mt-2" testID="chart" />);
		expect(ref.current).not.toBeNull();
		expect(screen.getByTestId("chart")).toHaveProp("className", expect.stringContaining("mt-2"));
	});
});

describe("AreaChart", () => {
	const ORGANIC: ChartSeries = { key: "desktop", label: "Organic", color: "chart-1", stroke: "bold" };
	const PAID: ChartSeries = { key: "mobile", label: "Paid", color: "chart-2", dashed: true, stroke: "thin", fill: { kind: "gradient", tone: "fade", direction: "right" } };
	const FORECAST: ChartSeries = { key: "desktop", label: "Forecast", color: "chart-3", kind: "line" };

	it("draws stacked areas with glowing dots, and reads each point", async () => {
		await render(<AreaChart data={DATA} series={[PAID, ORGANIC]} accessibilityLabel="Traffic" stacked dots="glow" glow grid="dashed" formatValue={dollars} testID="chart" />);
		await layOut();

		expect(screen.getByRole("image", { name: "Traffic" })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "January: Paid $120, Organic $300" })).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("button", { name: /^January/u }));
		expect(screen.getByText("$300")).toBeOnTheScreen();
	});

	it("draws a lone line, stepped or straight, without dots or grid", async () => {
		for (const curve of CURVES) {
			const { unmount } = await render(<AreaChart data={DATA} series={[FORECAST]} accessibilityLabel="Forecast" curve={curve} grid="none" dots="solid" testID="chart" />);
			await layOut();
			expect(screen.getByRole("image", { name: "Forecast" })).toBeOnTheScreen();
			await unmount();
		}
	});

	it("draws one point in the middle, and an empty chart", async () => {
		const [first] = DATA;
		await render(<AreaChart data={first === undefined ? [] : [first]} series={[{ ...ORGANIC, stroke: "none" }]} accessibilityLabel="One" testID="chart" />);
		await layOut();
		expect(screen.getByRole("button", { name: "January: Organic 300" })).toBeOnTheScreen();
	});
});

describe("PieChart", () => {
	it("is described by every slice's value, with a legend that selects slices", async () => {
		await render(<PieChart slices={SLICES} accessibilityLabel="Visits by source" formatValue={dollars} center={<Text>Total</Text>} testID="chart" />);
		await layOut();

		expect(screen.getByRole("image", { name: "Visits by source: Direct $40, Search $35, Social $25, None $0" })).toBeOnTheScreen();
		expect(screen.getByText("Total")).toBeOnTheScreen();

		const search = screen.getByRole("button", { name: "Search $35" });
		await fireEvent.press(search);
		expect(search).toHaveProp("accessibilityState", { selected: true });
		await fireEvent.press(search);
		expect(search).toHaveProp("accessibilityState", { selected: false });
	});

	it("reports a controlled active slice, and draws a plain pie without a legend", async () => {
		const onActiveKeyChange = jest.fn();
		const { rerender } = await render(<PieChart slices={SLICES} accessibilityLabel="Bugs" activeKey="direct" onActiveKeyChange={onActiveKeyChange} testID="chart" />);
		await layOut();
		await fireEvent.press(screen.getByRole("button", { name: "Direct 40" }));
		expect(onActiveKeyChange).toHaveBeenCalledWith(null);

		await rerender(<PieChart slices={SLICES} accessibilityLabel="Bugs" hole="none" padded={false} legend={false} testID="chart" />);
		expect(screen.queryByRole("button")).toBeNull();
	});
});

describe("RadarChart", () => {
	const SKILLS = [
		{ label: "Frontend", value: 92 },
		{ label: "Backend", value: 78 },
		{ label: "Design", value: 74 },
	];

	it("is described by every axis, labels its axes, and draws solid or hollow dots", async () => {
		const { unmount } = await render(<RadarChart data={SKILLS} series={{ label: "Score", color: "chart-1" }} accessibilityLabel="Team skills" glow testID="chart" />);
		await layOut();
		expect(screen.getByRole("image", { name: "Team skills: Frontend 92, Backend 78, Design 74" })).toBeOnTheScreen();
		expect(screen.getByText("Backend", { includeHiddenElements: true })).toBeOnTheScreen();
		await unmount();

		await render(
			<RadarChart
				data={SKILLS}
				series={{ label: "Score", color: "chart-2", fill: { kind: "gradient", tone: "soft", direction: "diagonal" }, stroke: "bold" }}
				accessibilityLabel="Scores"
				max={100}
				dots="hollow"
				testID="chart"
			/>,
		);
		await layOut();
		expect(screen.getByRole("image", { name: /^Scores: Frontend 92/u })).toBeOnTheScreen();
	});

	it("can leave the corners bare", async () => {
		await render(<RadarChart data={SKILLS} series={{ label: "Score", color: "chart-1" }} accessibilityLabel="Bare" dots="none" testID="chart" />);
		await layOut();
		expect(screen.getByRole("image", { name: /^Bare/u })).toBeOnTheScreen();
	});
});

describe("RadialBarChart", () => {
	it("draws a ring per bar on its track, with each value in the legend", async () => {
		await render(<RadialBarChart bars={SLICES.slice(0, 3)} accessibilityLabel="Scores" max={100} formatValue={dollars} testID="chart" />);
		await layOut();

		expect(screen.getByRole("image", { name: "Scores: Direct $40, Search $35, Social $25" })).toBeOnTheScreen();
		expect(screen.getByLabelText("Social $25")).toBeOnTheScreen();
	});

	it("can leave out the legend", async () => {
		await render(<RadialBarChart bars={SLICES.slice(0, 1)} accessibilityLabel="Score" max={100} legend={false} />);
		expect(screen.queryByLabelText("Direct 40")).toBeNull();
	});
});

describe("ChartLegend", () => {
	it("names each series, and makes entries buttons when they select", async () => {
		const onItemPress = jest.fn();
		const { rerender } = await render(<ChartLegend items={[{ key: "a", label: "Alpha", color: "chart-1" }]} testID="legend" />);
		expect(screen.queryByRole("button")).toBeNull();

		await rerender(
			<ChartLegend items={[{ key: "a", label: "Alpha", color: "destructive", value: "3" }]} onItemPress={onItemPress} activeKey="a" className="mt-2" testID="legend" />,
		);
		await fireEvent.press(screen.getByRole("button", { name: "Alpha 3" }));
		expect(onItemPress).toHaveBeenCalledWith("a");
		expect(screen.getByTestId("legend")).toHaveProp("className", expect.stringContaining("mt-2"));
	});
});

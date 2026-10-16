import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import StoreIcon from "lucide-react-native/icons/store";
import * as React from "react";

import { rampClassOf } from "../chart-colors";
import { ColumnChart, columnPercentOf, type ColumnDatum } from "../column-chart";
import { ComparisonBars } from "../comparison-bars";
import { DonutChart } from "../donut-chart";
import { HeatmapGrid, type HeatmapLabel } from "../heatmap-grid";
import { HighlightGrid } from "../highlight-grid";
import { ProgressList } from "../progress-list";
import { ProgressRing } from "../progress-ring";
import { describeShares, type ShareSegment } from "../share-legend";
import { Timeline } from "@workspace/ui-native/components/timeline";

/** Readouts and axis labels are hidden from screen readers (the marks speak for them): query them anyway. */
const HIDDEN = { includeHiddenElements: true };

const SEGMENTS: readonly ShareSegment[] = [
	{ key: "morning", label: "Morning", color: "chart-1", value: 30, valueLabel: "RM 30", shareLabel: "30%" },
	{ key: "evening", label: "Evening", color: "chart-4", value: 70, valueLabel: "RM 70", shareLabel: "70%" },
	{ key: "night", label: "Night", color: "chart-5", value: 0, valueLabel: "RM 0", shareLabel: "0%" },
];

describe("rampClassOf", () => {
	it("is the muted surface for nothing, then the hue's steps up to full", () => {
		expect(rampClassOf("chart-2", 0)).toBe("bg-muted");
		expect(rampClassOf("chart-2", 1)).toBe("bg-chart-2/20");
		expect(rampClassOf("chart-2", 4)).toBe("bg-chart-2");
		expect(rampClassOf("chart-2", 9)).toBe("bg-chart-2");
	});
});

describe("DonutChart", () => {
	it("draws an arc per non-zero part and names the whole and every part", async () => {
		await render(<DonutChart title="When you spend" segments={SEGMENTS} centerValue="RM 100" centerLabel="spent" testID="donut" />);

		expect(screen.getByTestId("donut-morning")).toBeOnTheScreen();
		expect(screen.getByTestId("donut-evening")).toBeOnTheScreen();
		expect(screen.queryByTestId("donut-night")).toBeNull();
		expect(screen.getByLabelText("When you spend: RM 100 spent. Morning 30%, Evening 70%, Night 0%")).toBeOnTheScreen();
		expect(screen.getByLabelText("Night: RM 0, 0%")).toBeOnTheScreen();
		expect(screen.getByText("RM 100", HIDDEN)).toBeOnTheScreen();
	});

	it("describes its parts in one sentence", () => {
		expect(describeShares(SEGMENTS)).toBe("Morning 30%, Evening 70%, Night 0%");
	});
});

describe("ProgressRing", () => {
	it("is a progress bar with its numbers, filled to its share", async () => {
		await render(
			<ProgressRing label="Monthly budget used" value={150} max={600} valueLabel="25%" caption="of budget" accessibilityValueText="RM 150 of RM 600" testID="ring" />,
		);

		const ring = screen.getByTestId("ring");
		expect(ring).toHaveProp("accessibilityRole", "progressbar");
		expect(ring).toHaveAccessibleName("Monthly budget used");
		expect(ring).toHaveAccessibilityValue({ min: 0, max: 600, now: 150, text: "RM 150 of RM 600" });
		expect(screen.getByTestId("ring-arc", HIDDEN)).toBeOnTheScreen();
	});

	it("draws no arc at zero and caps the value it reports at the target", async () => {
		await render(<ProgressRing label="Budget" value={0} max={600} valueLabel="0%" caption="of budget" accessibilityValueText="RM 0 of RM 600" testID="empty" />);
		expect(screen.queryByTestId("empty-arc", HIDDEN)).toBeNull();

		await render(<ProgressRing label="Budget" value={900} max={600} valueLabel="150%" caption="of budget" accessibilityValueText="RM 900 of RM 600" testID="over" />);
		expect(screen.getByTestId("over")).toHaveAccessibilityValue({ min: 0, max: 600, now: 600, text: "RM 900 of RM 600" });
	});
});

describe("ColumnChart", () => {
	const COLUMNS: readonly ColumnDatum[] = [
		{ key: "mon", label: "Mon", fullLabel: "Monday", value: 2, valueLabel: "2 visits" },
		{ key: "sat", label: "Sat", fullLabel: "Saturday", value: 8, valueLabel: "8 visits" },
		{ key: "sun", label: "Sun", fullLabel: "Sunday", value: 0, valueLabel: "0 visits" },
	];

	beforeEach(() => {
		jest.spyOn(Haptics, "selectionAsync").mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("names every column with its value, and reads out the one tapped", async () => {
		await render(<ColumnChart title="Visits by day" columns={COLUMNS} hint="Tap a day" testID="columns" />);

		expect(screen.getByText("Tap a day", HIDDEN)).toBeOnTheScreen();
		const saturday = screen.getByRole("button", { name: "Saturday: 8 visits" });
		await fireEvent.press(saturday);

		expect(screen.getByRole("button", { name: "Saturday: 8 visits" })).toBeSelected();
		expect(screen.getByRole("button", { name: "Monday: 2 visits" })).not.toBeSelected();
		expect(screen.getByText("8 visits", HIDDEN)).toBeOnTheScreen();
		expect(screen.queryByText("Tap a day", HIDDEN)).toBeNull();
	});

	it("ticks once per new column, not again for the same one", async () => {
		const selection = jest.spyOn(Haptics, "selectionAsync");
		await render(<ColumnChart title="Visits by day" columns={COLUMNS} hint="Tap a day" />);

		await fireEvent.press(screen.getByRole("button", { name: "Monday: 2 visits" }));
		await fireEvent.press(screen.getByRole("button", { name: "Monday: 2 visits" }));
		expect(selection).toHaveBeenCalledTimes(1);
	});

	it("sizes columns to the highest, keeping a small one visible", () => {
		expect(columnPercentOf(8, 8)).toBe(100);
		expect(columnPercentOf(4, 8)).toBe(50);
		expect(columnPercentOf(0.01, 8)).toBe(3);
		expect(columnPercentOf(0, 8)).toBe(0);
		expect(columnPercentOf(3, 0)).toBe(0);
	});
});

describe("HeatmapGrid", () => {
	const ROWS: readonly HeatmapLabel[] = [
		{ key: "morning", label: "Morning", fullLabel: "Morning (7 am – 11 am)" },
		{ key: "evening", label: "Evening", fullLabel: "Evening (5 pm – 10 pm)" },
	];
	const COLUMNS: readonly HeatmapLabel[] = [
		{ key: "sat", label: "Sat", fullLabel: "Saturday" },
		{ key: "sun", label: "Sun", fullLabel: "Sunday" },
	];

	function formatVisits(value: number): string {
		return `${String(value)} visits`;
	}

	beforeEach(() => {
		jest.spyOn(Haptics, "selectionAsync").mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("shades each cell by its value and names it with its row, column and value", async () => {
		await render(
			<HeatmapGrid
				title="When you visit"
				rows={ROWS}
				columns={COLUMNS}
				values={[
					[0, 2],
					[4, 8],
				]}
				formatValue={formatVisits}
				hint="Tap a square"
				testID="heat"
			/>,
		);

		expect(screen.getByTestId("heat-morning-sat")).toHaveProp("className", expect.stringContaining("bg-muted"));
		expect(screen.getByTestId("heat-morning-sun")).toHaveProp("className", expect.stringContaining("bg-chart-1/20"));
		expect(screen.getByTestId("heat-evening-sat")).toHaveProp("className", expect.stringContaining("bg-chart-1/45"));
		expect(screen.getByTestId("heat-evening-sun")).toHaveProp("className", expect.stringContaining("bg-chart-1 "));
		expect(screen.getByRole("button", { name: "Evening (5 pm – 10 pm), Sunday: 8 visits" })).toBeOnTheScreen();
		expect(screen.getByText("Less", HIDDEN)).toBeOnTheScreen();
		expect(screen.getByText("More", HIDDEN)).toBeOnTheScreen();
	});

	it("reads out the cell tapped", async () => {
		await render(
			<HeatmapGrid
				title="When you visit"
				rows={ROWS}
				columns={COLUMNS}
				values={[
					[0, 2],
					[4, 8],
				]}
				formatValue={formatVisits}
				hint="Tap a square"
			/>,
		);

		await fireEvent.press(screen.getByRole("button", { name: "Morning (7 am – 11 am), Sunday: 2 visits" }));
		expect(screen.getByRole("button", { name: "Morning (7 am – 11 am), Sunday: 2 visits" })).toBeSelected();
		expect(screen.getByText("Morning (7 am – 11 am) · Sunday", HIDDEN)).toBeOnTheScreen();
		expect(screen.getByText("2 visits", HIDDEN)).toBeOnTheScreen();
	});
});

describe("ProgressList", () => {
	const ITEMS = [{ key: "kopi", label: "Kopi Kaki", detail: "Free kopi · 3 more visits", value: 7, max: 10, valueLabel: "7 of 10" }];

	it("reads each row as a progress bar with its numbers", async () => {
		await render(<ProgressList items={ITEMS} />);

		const row = screen.getByLabelText("Kopi Kaki, Free kopi · 3 more visits");
		expect(row).toHaveProp("accessibilityRole", "progressbar");
		expect(row).toHaveAccessibilityValue({ min: 0, max: 10, now: 7, text: "7 of 10" });
	});

	it("shows a stamp card as one pip per stamp, the earned ones filled", async () => {
		await render(<ProgressList items={ITEMS} display="steps" />);

		expect(screen.getAllByTestId("progress-kopi-filled")).toHaveLength(7);
		expect(screen.getAllByTestId("progress-kopi-empty")).toHaveLength(3);
	});
});

describe("ComparisonBars", () => {
	it("names both periods and reads each measure with both values and its change", async () => {
		await render(
			<ComparisonBars
				items={[{ key: "visits", label: "Shop visits", current: 12, previous: 9, currentLabel: "12", previousLabel: "9", changeLabel: "+33.3%" }]}
				currentName="Last 30 days"
				previousName="Previous 30 days"
			/>,
		);

		expect(screen.getByLabelText("Legend: Last 30 days, Previous 30 days")).toBeOnTheScreen();
		expect(screen.getByLabelText("Shop visits: 12, Previous 30 days 9, +33.3%")).toBeOnTheScreen();
	});
});

describe("HighlightGrid", () => {
	it("reads each tile as one sentence", async () => {
		await render(
			<HighlightGrid
				items={[
					{ key: "shop", icon: StoreIcon, label: "Favourite shop", value: "Kopi Kaki", detail: "9 visits" },
					{ key: "plain", icon: StoreIcon, label: "Shops visited", value: "4" },
				]}
			/>,
		);

		expect(screen.getByLabelText("Favourite shop: Kopi Kaki, 9 visits")).toBeOnTheScreen();
		expect(screen.getByLabelText("Shops visited: 4")).toBeOnTheScreen();
	});
});

describe("Timeline", () => {
	it("reads each event as one sentence, with its badge when it has one", async () => {
		await render(
			<Timeline
				items={[
					{ key: "a", title: "Kopi Kaki", detail: "Sat, 10 Oct · 7:42 pm", value: "RM 14.50", badge: { label: "Reward redeemed", tone: "success" } },
					{ key: "b", title: "Urban Threads", detail: "Fri, 9 Oct · 1:05 pm", value: "RM 89.00" },
				]}
			/>,
		);

		expect(screen.getByLabelText("Kopi Kaki, RM 14.50, Sat, 10 Oct · 7:42 pm, Reward redeemed")).toBeOnTheScreen();
		expect(screen.getByLabelText("Urban Threads, RM 89.00, Fri, 9 Oct · 1:05 pm")).toBeOnTheScreen();
	});
});

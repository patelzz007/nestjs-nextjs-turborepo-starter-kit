// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { epochMs } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SalesOverTimeChart } from "@/components/analytics/sales-over-time-chart";
import { buildSalesSummary } from "@/test/sales-analytics-fixtures";

interface ProbeBarChartProps {
	readonly data: readonly { readonly label: string }[];
}

const { barChart } = vi.hoisted(() => ({ barChart: vi.fn<(props: ProbeBarChartProps) => null>(() => null) }));

// The bar chart is a probe: this suite checks the labels the chart is fed, not recharts' SVG layout.
vi.mock("recharts", async (importOriginal) => ({ ...(await importOriginal<Record<string, () => null>>()), BarChart: barChart }));

afterEach(() => {
	cleanup();
	barChart.mockClear();
});

describe("SalesOverTimeChart", () => {
	it("labels each weekly bucket by its UTC day, whatever the viewer's time zone", () => {
		// Monday 00:00 UTC is still Sunday evening in every zone west of UTC.
		const mondayUtc = epochMs(Date.UTC(2026, 8, 7));
		render(<SalesOverTimeChart sales={buildSalesSummary({ overTime: [{ date: mondayUtc, salesMinor: 100, bills: 1 }] })} description="Weekly" />);

		expect(barChart.mock.lastCall?.[0].data.map((point) => point.label)).toEqual(["7 Sept"]);
	});

	it("renders the skeleton card while the data loads", () => {
		render(<SalesOverTimeChart sales={undefined} description="Weekly" />);

		expect(screen.getByText("Weekly sales")).toBeTruthy();
		expect(barChart).not.toHaveBeenCalled();
	});
});

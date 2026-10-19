import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import type { TimeSeriesDefinition, TimeSeriesPoint } from "../time-series-chart";
import TimeSeriesChartClientOnly from "../time-series-chart.client-only";

type Key = "claims";

const SERIES: readonly TimeSeriesDefinition<Key>[] = [{ key: "claims", label: "Claims", color: "chart-1" }];
const POINTS: readonly TimeSeriesPoint<Key>[] = [{ start: 0, end: 1, isPartial: false, values: { claims: 1 } }];

function format(value: number): string {
	return String(value);
}
function formatPoint(point: TimeSeriesPoint<Key>): string {
	return `bucket-${String(point.start)}`;
}

beforeEach((): void => {
	// jsdom has no matchMedia; the chart reads prefers-reduced-motion through it.
	vi.stubGlobal("matchMedia", (query: string): Pick<MediaQueryList, "matches" | "media" | "addEventListener" | "removeEventListener"> => ({
		matches: true,
		media: query,
		addEventListener: (): void => undefined,
		removeEventListener: (): void => undefined,
	}));
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("TimeSeriesChartClientOnly in the browser", () => {
	it("replaces the skeleton with the chart, props passed through", async () => {
		render(
			<TimeSeriesChartClientOnly
				title="Claims over time"
				points={POINTS}
				series={SERIES}
				kind="bar"
				height="sm"
				formatValue={format}
				formatAxisValue={format}
				formatBucketTick={formatPoint}
				formatBucketLabel={formatPoint}
			/>,
			{ wrapper: UiKitTestProviders },
		);
		expect(await screen.findByRole("figure", { name: "Claims over time" })).toBeTruthy();
		expect(screen.queryByRole("status")).toBeNull();
		expect(document.querySelector('[data-slot="chart"]')?.className).toContain("h-40");
	});
});

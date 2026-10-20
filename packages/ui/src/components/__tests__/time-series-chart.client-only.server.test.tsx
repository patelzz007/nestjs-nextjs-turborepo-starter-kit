// @vitest-environment node
import * as React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import type { TimeSeriesDefinition, TimeSeriesPoint } from "../time-series-chart";
import TimeSeriesChartClientOnly from "../time-series-chart.client-only";

type Key = "claims" | "redemptions";

const ONE_SERIES: readonly TimeSeriesDefinition<Key>[] = [{ key: "claims", label: "Claims", color: "chart-1" }];
const TWO_SERIES: readonly TimeSeriesDefinition<Key>[] = [...ONE_SERIES, { key: "redemptions", label: "Redemptions", color: "chart-2" }];
const POINTS: readonly TimeSeriesPoint<Key>[] = [{ start: 0, end: 1, isPartial: false, values: { claims: 1, redemptions: 2 } }];

function format(value: number): string {
	return String(value);
}
function formatPoint(point: TimeSeriesPoint<Key>): string {
	return String(point.start);
}

function serverRender(props: { readonly series: readonly TimeSeriesDefinition<Key>[]; readonly height?: "sm" | "md"; readonly className?: string }): string {
	return renderToString(
		<UiKitTestProviders>
			<TimeSeriesChartClientOnly
				title="Claims over time"
				points={POINTS}
				kind="line"
				formatValue={format}
				formatAxisValue={format}
				formatBucketTick={formatPoint}
				formatBucketLabel={formatPoint}
				{...props}
			/>
		</UiKitTestProviders>,
	);
}

describe("TimeSeriesChartClientOnly on the server (decision #58)", () => {
	it("renders the sized skeleton, never the chart", () => {
		const html = serverRender({ series: ONE_SERIES });
		expect(html).toContain('data-slot="time-series-chart-skeleton"');
		expect(html).toContain('role="status"');
		expect(html).toContain("min-h-72");
		expect(html).not.toContain("<figure");
		expect(html).not.toContain("recharts");
	});

	it("sizes the plot bone from the height prop", () => {
		const html = serverRender({ series: ONE_SERIES, height: "sm" });
		expect(html).toContain("min-h-40");
		expect(html).not.toContain("min-h-72");
	});

	it("reserves the legend row only for more than one series", () => {
		const legendBone = "h-4 w-40";
		expect(serverRender({ series: TWO_SERIES })).toContain(legendBone);
		expect(serverRender({ series: ONE_SERIES })).not.toContain(legendBone);
	});

	it("keeps the caller's layout classes on the skeleton", () => {
		expect(serverRender({ series: ONE_SERIES, className: "lg:col-span-2" })).toContain("lg:col-span-2");
	});
});

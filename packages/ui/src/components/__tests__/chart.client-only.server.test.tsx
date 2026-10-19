// @vitest-environment node
import * as React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import ChartContainerClientOnly from "../chart.client-only";

const CONFIG = { claims: { label: "Claims", color: "var(--chart-1)" } };

describe("ChartContainerClientOnly on the server (decision #58)", () => {
	it("renders one bone at the container's size, never the chart", () => {
		const html = renderToString(
			<UiKitTestProviders>
				<ChartContainerClientOnly config={CONFIG} className="aspect-auto h-[250px] w-full">
					<svg />
				</ChartContainerClientOnly>
			</UiKitTestProviders>,
		);
		expect(html).toContain('data-slot="chart-skeleton"');
		expect(html).toContain('role="status"');
		expect(html).toContain("h-[250px]");
		expect(html).not.toContain('data-slot="chart"');
	});

	it("keeps the container's default aspect when the caller sizes nothing", () => {
		const html = renderToString(
			<UiKitTestProviders>
				<ChartContainerClientOnly config={CONFIG}>
					<svg />
				</ChartContainerClientOnly>
			</UiKitTestProviders>,
		);
		expect(html).toContain("aspect-video");
	});
});

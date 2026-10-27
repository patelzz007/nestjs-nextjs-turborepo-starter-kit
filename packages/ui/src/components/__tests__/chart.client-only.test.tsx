import { cleanup, render, waitFor } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import ChartContainerClientOnly from "../chart.client-only";

// The chart container is a `next/dynamic` chunk. Its first load is Vite transforming that module tree on demand,
// which takes far longer on a busy machine than the 1 s an async query waits. Load it once up front so
// every render's lazy import resolves from the module cache and no assertion depends on machine speed.
beforeAll(async (): Promise<void> => {
	await import("@workspace/ui/components/chart");
});

const CONFIG = { claims: { label: "Claims", color: "var(--chart-1)" } };

afterEach(() => {
	cleanup();
});

describe("ChartContainerClientOnly in the browser", () => {
	it("replaces the bone with the chart container, classes passed through", async () => {
		const { container } = render(
			<ChartContainerClientOnly config={CONFIG} className="h-[250px]">
				<svg />
			</ChartContainerClientOnly>,
			{ wrapper: UiKitTestProviders },
		);
		await waitFor(() => {
			expect(container.querySelector('[data-slot="chart"]')).not.toBeNull();
		});
		expect(container.querySelector('[data-slot="chart"]')?.className).toContain("h-[250px]");
		expect(container.querySelector('[data-slot="chart-skeleton"]')).toBeNull();
	});
});

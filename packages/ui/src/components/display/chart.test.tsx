import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { ChartContainer, ChartTooltipContent, type ChartConfig } from "./chart";

const CONFIG: ChartConfig = { salesMinor: { label: "Sales", color: "var(--chart-1)" } };

function renderTooltip(valueFormatter?: (value: number) => string): void {
	render(
		<ChartContainer config={CONFIG}>
			<ChartTooltipContent
				active
				label="Sep 1"
				payload={[{ name: "salesMinor", dataKey: "salesMinor", value: 123_450, graphicalItemId: "sales-bar" }]}
				{...(valueFormatter !== undefined ? { valueFormatter } : {})}
			/>
		</ChartContainer>,
	);
}

afterEach(() => {
	cleanup();
});

describe("ChartTooltipContent", () => {
	it("renders numeric values with toLocaleString by default", () => {
		renderTooltip();
		expect(screen.getByText((123_450).toLocaleString())).toBeTruthy();
		expect(screen.getByText("Sales")).toBeTruthy();
	});

	it("renders numeric values through valueFormatter when given", () => {
		renderTooltip((value) => `RM ${(value / 100).toFixed(2)}`);
		expect(screen.getByText("RM 1234.50")).toBeTruthy();
		expect(screen.queryByText((123_450).toLocaleString())).toBeNull();
	});
});

import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChartContainer, ChartLegendContent, ChartStyle, ChartTooltipContent, type ChartConfig } from "../chart";
import { LayoutTransitionProvider, useReportLayoutTransition } from "../layout-transition";

const NO_SERIES: ChartConfig = {};
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

describe("ChartContainer while the layout moves", () => {
	const HELD_WIDTH_PX = 640;

	it("holds the chart at its width, anchored and clipped, then lets it fit — without re-rendering it", () => {
		const reporter: { report: (isMoving: boolean) => void } = { report: (): void => undefined };
		const chartRenders = vi.fn<() => void>();
		function Reporter(): null {
			reporter.report = useReportLayoutTransition();
			return null;
		}
		function Plot(): React.JSX.Element {
			chartRenders();
			return <svg aria-label="Plot" />;
		}
		render(
			<LayoutTransitionProvider>
				<Reporter />
				<ChartContainer config={CONFIG}>
					<Plot />
				</ChartContainer>
			</LayoutTransitionProvider>,
		);
		const box = document.querySelector<HTMLElement>('[data-slot="chart-size"]');
		const frame = document.querySelector<HTMLElement>('[data-slot="chart"]');
		if (box === null || frame === null) {
			throw new Error("The chart did not render");
		}
		vi.spyOn(box, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, HELD_WIDTH_PX, HELD_WIDTH_PX / 2));
		const rendersBeforeMotion = chartRenders.mock.calls.length;

		act((): void => {
			reporter.report(true);
		});
		expect(box.style.width).toBe(`${String(HELD_WIDTH_PX)}px`);
		expect(box.style.flexShrink).toBe("0");
		expect(frame.style.overflowX).toBe("clip");
		// Anchored at the start edge: the frame does not centre a held chart.
		expect(frame.className).not.toContain("justify-center");

		act((): void => {
			reporter.report(false);
		});
		expect(box.style.width).toBe("");
		expect(box.style.flexShrink).toBe("");
		expect(frame.style.overflowX).toBe("");
		expect(chartRenders).toHaveBeenCalledTimes(rendersBeforeMotion);
	});
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

describe("chart parts forward refs (rule 20)", () => {
	it("ChartTooltipContent forwards its ref to the tooltip box", () => {
		const ref = React.createRef<HTMLDivElement>();
		render(
			<ChartContainer config={CONFIG}>
				<ChartTooltipContent ref={ref} active label="Sep 1" payload={[{ name: "salesMinor", dataKey: "salesMinor", value: 1, graphicalItemId: "sales-bar" }]} />
			</ChartContainer>,
		);
		expect(ref.current?.textContent).toContain("Sales");
	});

	it("ChartLegendContent forwards its ref and labels each entry from the config", () => {
		const ref = React.createRef<HTMLDivElement>();
		render(
			<ChartContainer config={CONFIG}>
				<ChartLegendContent ref={ref} payload={[{ value: "salesMinor", dataKey: "salesMinor", color: "var(--chart-1)" }]} />
			</ChartContainer>,
		);
		expect(ref.current?.textContent).toBe("Sales");
	});

	it("ChartStyle forwards its ref to the scoped <style> and maps each series to its colour", () => {
		const ref = React.createRef<HTMLStyleElement>();
		render(<ChartStyle ref={ref} id="chart-test" config={CONFIG} />);
		expect(ref.current?.textContent).toContain("[data-chart=chart-test]");
		expect(ref.current?.textContent).toContain("--color-salesMinor: var(--chart-1);");
	});

	it("ChartStyle renders nothing when the config has no series", () => {
		const { container } = render(<ChartStyle id="chart-test" config={NO_SERIES} />);
		expect(container.querySelector("style")).toBeNull();
	});
});

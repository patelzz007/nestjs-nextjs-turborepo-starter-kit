import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnalyticsPanel, CHART_LOADING, CHART_READY, ChartStateFrame } from "./analytics-panel";

afterEach((): void => {
	cleanup();
});

describe("AnalyticsPanel", () => {
	it("is a region named by its heading, with its description and actions", (): void => {
		render(
			<AnalyticsPanel title="Sales over time" description="Paid bills per day" actions={<button type="button">More</button>}>
				<p>chart</p>
			</AnalyticsPanel>,
		);

		expect(screen.getByRole("region", { name: "Sales over time" })).toBeTruthy();
		expect(screen.getByRole("heading", { name: "Sales over time" })).toBeTruthy();
		expect(screen.getByText("Paid bills per day")).toBeTruthy();
		expect(screen.getByRole("button", { name: "More" })).toBeTruthy();
	});

	it("forwards its ref to the section", (): void => {
		const ref = React.createRef<HTMLElement>();
		render(
			<AnalyticsPanel ref={ref} title="Panel">
				<p>chart</p>
			</AnalyticsPanel>,
		);

		expect(ref.current).toBe(screen.getByRole("region", { name: "Panel" }));
	});
});

describe("ChartStateFrame", () => {
	it("renders the chart only when ready", (): void => {
		render(<ChartStateFrame state={CHART_READY}>chart body</ChartStateFrame>);

		expect(screen.getByText("chart body")).toBeTruthy();
	});

	it("replaces the chart with a skeleton while loading", (): void => {
		render(<ChartStateFrame state={CHART_LOADING}>chart body</ChartStateFrame>);

		expect(screen.queryByText("chart body")).toBeNull();
	});

	it("shows the empty message", (): void => {
		render(<ChartStateFrame state={{ status: "empty", message: "No sales in this range" }}>chart body</ChartStateFrame>);

		expect(screen.getByText("No sales in this range")).toBeTruthy();
		expect(screen.queryByText("chart body")).toBeNull();
	});

	it("announces an error and retries on request", (): void => {
		const onRetry = vi.fn<() => void>();
		render(<ChartStateFrame state={{ status: "error", message: "Couldn't load", retryLabel: "Try again", onRetry }}>chart body</ChartStateFrame>);

		expect(screen.getByRole("alert").textContent).toContain("Couldn't load");
		fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});
});

describe("chartStateFrameVariants", () => {
	it("keeps a frame at its chart's height in every non-ready state", (): void => {
		const { container } = render(
			<ChartStateFrame state={CHART_LOADING} height="sm">
				<p>chart</p>
			</ChartStateFrame>,
		);
		expect(container.firstElementChild?.className).toContain("min-h-40");
		cleanup();

		render(
			<ChartStateFrame state={{ status: "empty", message: "Nothing yet" }}>
				<p>chart</p>
			</ChartStateFrame>,
		);
		const empty = screen.getByText("Nothing yet").parentElement;
		expect(empty?.className).toContain("min-h-72");
		expect(empty?.className).toContain("border-dashed");
	});
});

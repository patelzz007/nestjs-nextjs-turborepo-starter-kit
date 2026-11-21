// @vitest-environment jsdom
import type { TableEngineTableLayout } from "../table-engine";
import {
	computeTableEngineScrollbarMetrics,
	TableEngineScrollArea,
	getTableEngineScrollTopForThumb,
	tableEngineScrollbarVariants,
	type TableEngineScrollAreaOrientation,
	type TableEngineScrollMeasurement,
} from "../table-engine-scroll-area";
import { TableEngineResizeObserverStub, TableEngineTestHarness } from "../testing/table-engine-test-harness";
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", TableEngineResizeObserverStub);
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

const STICKY_LAYOUT: TableEngineTableLayout = { headerSticky: true };

interface RenderOptions {
	readonly orientation?: TableEngineScrollAreaOrientation;
	readonly layout?: TableEngineTableLayout;
	readonly className?: string;
	readonly scrollRef?: React.Ref<HTMLDivElement>;
}

function renderScrollArea({ orientation, layout, className, scrollRef }: RenderOptions = {}): void {
	render(
		<TableEngineTestHarness {...(layout === undefined ? {} : { tableLayout: layout })}>
			<TableEngineScrollArea
				{...(orientation === undefined ? {} : { orientation })}
				{...(className === undefined ? {} : { className })}
				{...(scrollRef === undefined ? {} : { ref: scrollRef })}>
				<p>grid content</p>
			</TableEngineScrollArea>
		</TableEngineTestHarness>,
	);
}

const BASE_MEASUREMENT: TableEngineScrollMeasurement = {
	headerHeight: 40,
	footerHeight: 0,
	viewportHeight: 440,
	viewportWidth: 600,
	scrollHeight: 840,
	scrollWidth: 600,
	scrollTop: 0,
	horizontalScrollbarHeight: 10,
	showHorizontal: true,
};

describe("TableEngineScrollArea", () => {
	it("renders its content inside the scroll-area viewport", (): void => {
		renderScrollArea();
		const content = screen.getByText("grid content");
		expect(content.closest('[data-slot="scroll-area-viewport"]')).not.toBeNull();
		expect(content.closest('[data-slot="table-engine-scroll-area"]')).not.toBeNull();
	});

	it("forwards its ref to the scroll-area root and merges className last", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		renderScrollArea({ scrollRef: ref, className: "h-96" });
		expect(ref.current?.dataset.slot).toBe("table-engine-scroll-area");
		expect(ref.current?.className).toBe("relative h-96");
	});

	it("does not render the vertical native bar in sticky-header mode", (): void => {
		renderScrollArea({ layout: STICKY_LAYOUT });
		expect(document.querySelector('[data-slot="table-engine-scrollbar"][data-orientation="vertical"]')).toBeNull();
		// jsdom measures no overflow, so the custom overlay stays unmounted too.
		expect(document.querySelector('[data-slot="table-engine-scrollbar-overlay"]')).toBeNull();
	});

	it("renders in every orientation without crashing", (): void => {
		for (const orientation of ["horizontal", "vertical", "both"] satisfies TableEngineScrollAreaOrientation[]) {
			renderScrollArea({ orientation });
			expect(screen.getByText("grid content")).toBeDefined();
			cleanup();
		}
	});
});

describe("computeTableEngineScrollbarMetrics", () => {
	it("reports no overflow when the content fits", (): void => {
		const metrics = computeTableEngineScrollbarMetrics({ ...BASE_MEASUREMENT, scrollHeight: 440 });
		expect(metrics.hasVerticalOverflow).toBe(false);
		expect(metrics.trackHeight).toBe(400);
	});

	it("sizes the thumb to the visible share of the body, below the header", (): void => {
		const metrics = computeTableEngineScrollbarMetrics(BASE_MEASUREMENT);
		expect(metrics).toEqual({ hasVerticalOverflow: true, headerHeight: 40, horizontalScrollbarSize: 0, thumbHeight: 200, thumbTop: 0, trackHeight: 400 });
		expect(computeTableEngineScrollbarMetrics({ ...BASE_MEASUREMENT, scrollTop: 400 }).thumbTop).toBe(200);
	});

	it("reserves the horizontal bar and never shrinks the thumb below its minimum", (): void => {
		const metrics = computeTableEngineScrollbarMetrics({ ...BASE_MEASUREMENT, scrollWidth: 1200, scrollHeight: 100_000 });
		expect(metrics.horizontalScrollbarSize).toBe(11);
		expect(metrics.trackHeight).toBe(389);
		expect(metrics.thumbHeight).toBe(24);
	});
});

describe("getTableEngineScrollTopForThumb", () => {
	it("maps a thumb offset to the scroll position, clamped to the track", (): void => {
		const metrics = computeTableEngineScrollbarMetrics(BASE_MEASUREMENT);
		expect(getTableEngineScrollTopForThumb(100, metrics, 400)).toBe(200);
		expect(getTableEngineScrollTopForThumb(1000, metrics, 400)).toBe(400);
		expect(getTableEngineScrollTopForThumb(10, metrics, 0)).toBe(0);
	});
});

describe("tableEngineScrollbarVariants", () => {
	it("hides the scrollbars on paper and keeps the horizontal track off the edge, as separate classes", () => {
		const classes = tableEngineScrollbarVariants({ orientation: "horizontal" }).split(" ");
		expect(classes).toContain("print:hidden");
		expect(classes).toContain("data-[orientation=horizontal]:mb-px");
	});
});

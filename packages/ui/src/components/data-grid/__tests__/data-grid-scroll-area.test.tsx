// @vitest-environment jsdom
import type { DataGridTableLayout } from "@workspace/ui/components/data-grid/data-grid";
import {
	computeDataGridScrollbarMetrics,
	DataGridScrollArea,
	getDataGridScrollTopForThumb,
	type DataGridScrollAreaOrientation,
	type DataGridScrollMeasurement,
} from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import { DataGridResizeObserverStub, DataGridTestHarness } from "@workspace/ui/testing/data-grid-test-harness";
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", DataGridResizeObserverStub);
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

const STICKY_LAYOUT: DataGridTableLayout = { headerSticky: true };

interface RenderOptions {
	readonly orientation?: DataGridScrollAreaOrientation;
	readonly layout?: DataGridTableLayout;
	readonly className?: string;
	readonly scrollRef?: React.Ref<HTMLDivElement>;
}

function renderScrollArea({ orientation, layout, className, scrollRef }: RenderOptions = {}): void {
	render(
		<DataGridTestHarness {...(layout === undefined ? {} : { tableLayout: layout })}>
			<DataGridScrollArea
				{...(orientation === undefined ? {} : { orientation })}
				{...(className === undefined ? {} : { className })}
				{...(scrollRef === undefined ? {} : { ref: scrollRef })}>
				<p>grid content</p>
			</DataGridScrollArea>
		</DataGridTestHarness>,
	);
}

const BASE_MEASUREMENT: DataGridScrollMeasurement = {
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

describe("DataGridScrollArea", () => {
	it("renders its content inside the scroll-area viewport", (): void => {
		renderScrollArea();
		const content = screen.getByText("grid content");
		expect(content.closest('[data-slot="scroll-area-viewport"]')).not.toBeNull();
		expect(content.closest('[data-slot="data-grid-scroll-area"]')).not.toBeNull();
	});

	it("forwards its ref to the scroll-area root and merges className last", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		renderScrollArea({ scrollRef: ref, className: "h-96" });
		expect(ref.current?.dataset.slot).toBe("data-grid-scroll-area");
		expect(ref.current?.className).toBe("relative h-96");
	});

	it("does not render the vertical native bar in sticky-header mode", (): void => {
		renderScrollArea({ layout: STICKY_LAYOUT });
		expect(document.querySelector('[data-slot="data-grid-scrollbar"][data-orientation="vertical"]')).toBeNull();
		// jsdom measures no overflow, so the custom overlay stays unmounted too.
		expect(document.querySelector('[data-slot="data-grid-scrollbar-overlay"]')).toBeNull();
	});

	it("renders in every orientation without crashing", (): void => {
		for (const orientation of ["horizontal", "vertical", "both"] satisfies DataGridScrollAreaOrientation[]) {
			renderScrollArea({ orientation });
			expect(screen.getByText("grid content")).toBeDefined();
			cleanup();
		}
	});
});

describe("computeDataGridScrollbarMetrics", () => {
	it("reports no overflow when the content fits", (): void => {
		const metrics = computeDataGridScrollbarMetrics({ ...BASE_MEASUREMENT, scrollHeight: 440 });
		expect(metrics.hasVerticalOverflow).toBe(false);
		expect(metrics.trackHeight).toBe(400);
	});

	it("sizes the thumb to the visible share of the body, below the header", (): void => {
		const metrics = computeDataGridScrollbarMetrics(BASE_MEASUREMENT);
		expect(metrics).toEqual({ hasVerticalOverflow: true, headerHeight: 40, horizontalScrollbarSize: 0, thumbHeight: 200, thumbTop: 0, trackHeight: 400 });
		expect(computeDataGridScrollbarMetrics({ ...BASE_MEASUREMENT, scrollTop: 400 }).thumbTop).toBe(200);
	});

	it("reserves the horizontal bar and never shrinks the thumb below its minimum", (): void => {
		const metrics = computeDataGridScrollbarMetrics({ ...BASE_MEASUREMENT, scrollWidth: 1200, scrollHeight: 100_000 });
		expect(metrics.horizontalScrollbarSize).toBe(11);
		expect(metrics.trackHeight).toBe(389);
		expect(metrics.thumbHeight).toBe(24);
	});
});

describe("getDataGridScrollTopForThumb", () => {
	it("maps a thumb offset to the scroll position, clamped to the track", (): void => {
		const metrics = computeDataGridScrollbarMetrics(BASE_MEASUREMENT);
		expect(getDataGridScrollTopForThumb(100, metrics, 400)).toBe(200);
		expect(getDataGridScrollTopForThumb(1000, metrics, 400)).toBe(400);
		expect(getDataGridScrollTopForThumb(10, metrics, 0)).toBe(0);
	});
});

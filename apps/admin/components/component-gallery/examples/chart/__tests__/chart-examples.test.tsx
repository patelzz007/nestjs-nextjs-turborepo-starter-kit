// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { describeGalleryExamples, installGalleryExampleShims } from "@/components/component-gallery/examples/__tests__/render-gallery-examples";
import { CHART_EXAMPLES } from "@/components/component-gallery/examples/chart";
import { Chart1Example } from "@/components/component-gallery/examples/chart/chart-1";
import { Chart11Example } from "@/components/component-gallery/examples/chart/chart-11";
import { Chart19Example } from "@/components/component-gallery/examples/chart/chart-19";
import { abbreviateMonth, formatScore, formatUsd } from "@/components/component-gallery/examples/chart/chart-example-format";

/** The box every element reports: jsdom has no layout, and recharts draws nothing into a 0×0 container. */
const LAID_OUT_WIDTH_PX = 400;
const LAID_OUT_HEIGHT_PX = 200;

/** Months in the yearly sample series. */
const MONTHS_PER_YEAR = 12;

describeGalleryExamples("Chart", CHART_EXAMPLES);

describe("Chart example formatting", (): void => {
	it("abbreviates month names for the axis", (): void => {
		expect(abbreviateMonth("September")).toBe("Sep");
		expect(abbreviateMonth("May")).toBe("May");
	});

	it("formats dollars and scores", (): void => {
		expect(formatUsd(2400)).toBe("$2,400");
		expect(formatScore(76)).toBe("76/100");
	});
});

describe("Chart gallery example interactions", (): void => {
	installGalleryExampleShims();

	beforeEach((): void => {
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, LAID_OUT_WIDTH_PX, LAID_OUT_HEIGHT_PX));
		vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(LAID_OUT_WIDTH_PX);
		vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(LAID_OUT_HEIGHT_PX);
		vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(LAID_OUT_WIDTH_PX);
		vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(LAID_OUT_HEIGHT_PX);
	});

	afterEach((): void => {
		vi.restoreAllMocks();
	});

	it("draws one bar per month", (): void => {
		const { container } = render(<Chart1Example />, { wrapper: UiKitTestProviders });

		expect(container.querySelectorAll(".recharts-bar-rectangle")).toHaveLength(MONTHS_PER_YEAR);
	});

	it("shows the total in the donut's centre", (): void => {
		render(<Chart19Example />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("13.9k")).toBeTruthy();
		expect(screen.getByText("Total Visits")).toBeTruthy();
	});

	it("puts the hovered month's figure in the headline", (): void => {
		const { container } = render(<Chart11Example />, { wrapper: UiKitTestProviders });
		expect(screen.getByText("$123")).toBeTruthy();

		const [januaryBar] = Array.from(container.querySelectorAll(".recharts-bar-rectangle rect"));
		expect(januaryBar).toBeDefined();
		if (januaryBar !== undefined) {
			fireEvent.mouseOver(januaryBar);
		}

		expect(screen.getByText("$289")).toBeTruthy();
	});
});

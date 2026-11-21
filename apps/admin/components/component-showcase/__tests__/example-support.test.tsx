// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it } from "vitest";

import { carouselSampleSlides } from "@/components/component-showcase/examples/carousel/carousel-sample-slides";
import { formatMonthTooltipLabel } from "@/components/component-showcase/examples/chart/chart-example-format";
import { DOCUMENT_SECTIONS, getSectionId, parsePageCount, withSectionValue } from "@/components/component-showcase/examples/data-table/data-table-sample";
import {
	applyBudgetChanges,
	BUDGET_LINES,
	formatMoney,
	getBudgetLineId,
	parsePrice,
	parseQuantity,
} from "@/components/component-showcase/examples/spreadsheet/spreadsheet-sample";
import { turnParagraphs } from "@/components/component-showcase/examples/message-scroller/message-scroller-paragraphs";
import { useSampleNow } from "@/components/component-showcase/examples/sample-clock";
import { LIST_SLOT_INDEX } from "@workspace/shared";

const THREE_SLIDES = 3;

function ShowsSampleNow({ testId }: { readonly testId: string }): React.JSX.Element {
	return <span data-testid={testId}>{useSampleNow()}</span>;
}

describe("useSampleNow", () => {
	it("gives every example, and every render, the same moment", (): void => {
		const { rerender } = render(
			<>
				<ShowsSampleNow testId="first" />
				<ShowsSampleNow testId="second" />
			</>,
		);
		const first = screen.getByTestId("first").textContent;
		expect(Number(first)).toBeGreaterThan(0);
		expect(screen.getByTestId("second").textContent).toBe(first);

		rerender(<ShowsSampleNow testId="first" />);
		expect(screen.getByTestId("first").textContent).toBe(first);
	});
});

describe("showcase sample data helpers", () => {
	it("numbers carousel slides from one, with zero-based indexes and stable ids", (): void => {
		const slides = carouselSampleSlides(THREE_SLIDES);
		expect(slides).toHaveLength(THREE_SLIDES);
		expect(slides.at(LIST_SLOT_INDEX.first)).toMatchObject({ id: "slide-1", index: 0, number: 1 });
		expect(slides.at(LIST_SLOT_INDEX.third)).toMatchObject({ id: "slide-3", index: 2, number: 3 });
		expect(carouselSampleSlides(0)).toHaveLength(0);
	});

	it("splits a chat turn into paragraphs whose ids follow their position", (): void => {
		expect(turnParagraphs("One\n\nTwo")).toEqual([
			{ id: "paragraph-1", text: "One" },
			{ id: "paragraph-2", text: "Two" },
		]);
		expect(turnParagraphs("Only")).toEqual([{ id: "paragraph-1", text: "Only" }]);
	});

	it("keys a data-table section by id and writes only values the section can hold", (): void => {
		const section = DOCUMENT_SECTIONS.at(LIST_SLOT_INDEX.first);
		expect(section).toBeDefined();
		if (section !== undefined) {
			expect(getSectionId(section)).toBe(section.id);
			expect(withSectionValue(section, "target", 40).target).toBe(40);
			// A page count that is not a whole number leaves the section as it was.
			expect(withSectionValue(section, "target", "many")).toBe(section);
		}
		expect(parsePageCount("12")).toBe(12);
		expect(parsePageCount("1.5")).toBeUndefined();
		expect(parsePageCount(" ")).toBeUndefined();
		expect(parsePageCount("-3")).toBeUndefined();
	});

	it("parses spreadsheet quantities and prices, and formats money", (): void => {
		expect(parseQuantity("7")).toBe(7);
		expect(parseQuantity("7.5")).toBeUndefined();
		expect(parseQuantity("")).toBeUndefined();
		expect(parsePrice("$1,450")).toBe(1450);
		expect(parsePrice("free")).toBeUndefined();
		expect(parsePrice("")).toBeUndefined();
		expect(formatMoney(5800)).toBe("$5,800");
	});

	it("applies one batch of spreadsheet writes by row id, and skips a value a line cannot hold", (): void => {
		const [first, second] = BUDGET_LINES;
		if (first === undefined || second === undefined) {
			throw new Error("the budget sample holds at least two lines");
		}
		expect(getBudgetLineId(first)).toBe(first.id);
		const next = applyBudgetChanges(BUDGET_LINES, {
			source: "paste",
			changes: [
				{ rowId: first.id, columnId: "quantity", row: first, previousValue: first.quantity, value: 9 },
				{ rowId: first.id, columnId: "item", row: first, previousValue: first.item, value: "Workstations" },
				{ rowId: second.id, columnId: "quantity", row: second, previousValue: second.quantity, value: "lots" },
			],
			rejected: [],
		});
		expect(next.at(LIST_SLOT_INDEX.first)).toEqual({ ...first, quantity: 9, item: "Workstations" });
		expect(next.at(LIST_SLOT_INDEX.second)).toBe(second);
	});

	it("labels a chart tooltip with the month and the sample year", (): void => {
		render(<>{formatMonthTooltipLabel("March")}</>);
		expect(screen.getByText(/^March \d{4}$/u)).toBeTruthy();
	});
});

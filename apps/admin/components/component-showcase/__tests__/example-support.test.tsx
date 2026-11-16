// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import type * as React from "react";
import { describe, expect, it } from "vitest";

import { carouselSampleSlides } from "@/components/component-showcase/examples/carousel/carousel-sample-slides";
import { formatMonthTooltipLabel } from "@/components/component-showcase/examples/chart/chart-example-format";
import { DATA_GRID_SAMPLE_PEOPLE, formatDataGridSampleBalance, getDataGridSamplePersonId } from "@/components/component-showcase/examples/data-grid/data-grid-sample-people";
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

	it("formats a data-grid balance as dollars and keys a person by id", (): void => {
		expect(formatDataGridSampleBalance(5143.03)).toBe("$5,143.03");
		const person = DATA_GRID_SAMPLE_PEOPLE.at(LIST_SLOT_INDEX.first);
		expect(person).toBeDefined();
		if (person !== undefined) {
			expect(getDataGridSamplePersonId(person)).toBe(person.id);
		}
	});

	it("labels a chart tooltip with the month and the sample year", (): void => {
		render(<>{formatMonthTooltipLabel("March")}</>);
		expect(screen.getByText(/^March \d{4}$/u)).toBeTruthy();
	});
});

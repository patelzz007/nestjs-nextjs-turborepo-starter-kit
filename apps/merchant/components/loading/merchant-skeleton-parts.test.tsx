// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
	MerchantBorderedRowsSkeleton,
	type MerchantBorderedRowsSkeletonProps,
	MerchantGridRowsSkeleton,
	MerchantPageHeaderSkeleton,
	MerchantSectionCardSkeleton,
	MerchantStatCardsSkeleton,
} from "@/components/loading/merchant-skeleton-parts";

/** A list grid as the API-key list declares it. */
const ROW_GRID = "grid md:grid-cols-[1fr_1fr_7rem]";
const ROWS = 3;
const TEXT_CELLS = 2;
const ACTIONS = 1;
const STAT_CARDS = 3;
/** Bones in a page header without actions: eyebrow, title, description. */
const HEADER_BONES = 3;
/** Header buttons in the actions case. */
const HEADER_ACTIONS = 2;
/** Bones in a one-line bordered row with a trailing element: title, the line, the trailing badge/button/time. */
const ONE_LINE_ROW_WITH_TRAILING_BONES = 3;
/** Bones in a section card's header with an action: title, description, the action. */
const SECTION_HEADER_WITH_ACTION_BONES = 3;
const TRAILING_KINDS: readonly Exclude<MerchantBorderedRowsSkeletonProps["trailing"], "none">[] = ["badge", "button", "text"];

afterEach((): void => {
	cleanup();
});

function bonesIn(root: ParentNode | null | undefined): number {
	return root?.querySelectorAll('[data-slot="skeleton"]').length ?? 0;
}

describe("MerchantPageHeaderSkeleton", () => {
	it("draws the eyebrow, title and description over the header's rule", () => {
		const { container } = render(<MerchantPageHeaderSkeleton />);

		const header = container.querySelector('[data-slot="merchant-page-header-skeleton"]');
		expect(header?.className).toContain("border-b");
		expect(bonesIn(header)).toBe(HEADER_BONES);
	});

	it("adds one bone per header action", () => {
		const { container } = render(<MerchantPageHeaderSkeleton actions={HEADER_ACTIONS} />);

		expect(bonesIn(container)).toBe(HEADER_BONES + HEADER_ACTIONS);
	});
});

describe("MerchantStatCardsSkeleton", () => {
	it("draws the requested cards in the caller's columns", () => {
		const { container } = render(<MerchantStatCardsSkeleton count={STAT_CARDS} className="sm:grid-cols-3" />);

		expect(container.querySelectorAll('[data-slot="merchant-stat-card-skeleton"]')).toHaveLength(STAT_CARDS);
		expect(container.querySelector('[data-slot="merchant-stat-cards-skeleton"]')?.className).toContain("sm:grid-cols-3");
	});
});

describe("MerchantGridRowsSkeleton", () => {
	it("lays every row out on the real list's grid, with its text cells and buttons", () => {
		const { container } = render(<MerchantGridRowsSkeleton rows={ROWS} rowGridClassName={ROW_GRID} textCells={TEXT_CELLS} actions={ACTIONS} />);

		const rows = container.querySelectorAll('[data-slot="merchant-grid-row-skeleton"]');
		expect(rows).toHaveLength(ROWS);
		const [firstRow] = Array.from(rows);
		expect(firstRow?.className).toContain("md:grid-cols-[1fr_1fr_7rem]");
		// The leading cell, one cell per text column, and the actions cell.
		expect(firstRow?.children).toHaveLength(1 + TEXT_CELLS + 1);
		expect(firstRow?.lastElementChild?.children).toHaveLength(ACTIONS);
	});
});

describe("MerchantBorderedRowsSkeleton", () => {
	it("draws a title plus the requested detail lines in each row", () => {
		const { container } = render(<MerchantBorderedRowsSkeleton rows={ROWS} lines={TEXT_CELLS} trailing="none" surface="card" />);

		const rows = container.querySelectorAll('[data-slot="merchant-bordered-row-skeleton"]');
		expect(rows).toHaveLength(ROWS);
		const [firstRow] = Array.from(rows);
		expect(bonesIn(firstRow)).toBe(1 + TEXT_CELLS);
	});

	it.each(TRAILING_KINDS)("adds a trailing %s to each row", (trailing) => {
		const { container } = render(<MerchantBorderedRowsSkeleton rows={1} lines={1} trailing={trailing} surface="panel" />);

		expect(bonesIn(container)).toBe(ONE_LINE_ROW_WITH_TRAILING_BONES);
		expect(container.querySelector('[data-slot="merchant-bordered-row-skeleton"]')?.className).toContain("shadow-xs");
	});
});

describe("MerchantSectionCardSkeleton", () => {
	it("draws the ruled header above the section's own bones", () => {
		const { container } = render(
			<MerchantSectionCardSkeleton withHeaderAction>
				<p>rows</p>
			</MerchantSectionCardSkeleton>,
		);

		expect(container.querySelector(".border-b")).not.toBeNull();
		expect(container.textContent).toBe("rows");
		expect(bonesIn(container)).toBe(SECTION_HEADER_WITH_ACTION_BONES);
	});
});

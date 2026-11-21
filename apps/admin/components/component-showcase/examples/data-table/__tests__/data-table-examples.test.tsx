// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createDataTableQuery } from "@workspace/ui/components/data-table";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import type * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DataTable1Example } from "@/components/component-showcase/examples/data-table/data-table-1";
import { DataTable10Example } from "@/components/component-showcase/examples/data-table/data-table-10";
import { DataTable11Example } from "@/components/component-showcase/examples/data-table/data-table-11";
import { DataTable12Example } from "@/components/component-showcase/examples/data-table/data-table-12";
import { DataTable13Example } from "@/components/component-showcase/examples/data-table/data-table-13";
import { DataTable14Example } from "@/components/component-showcase/examples/data-table/data-table-14";
import { DataTable15Example } from "@/components/component-showcase/examples/data-table/data-table-15";
import { DataTable16Example } from "@/components/component-showcase/examples/data-table/data-table-16";
import { DataTable17Example } from "@/components/component-showcase/examples/data-table/data-table-17";
import { answerSectionsQuery, DataTable18Example } from "@/components/component-showcase/examples/data-table/data-table-18";
import { DataTable19Example } from "@/components/component-showcase/examples/data-table/data-table-19";
import { DataTable2Example } from "@/components/component-showcase/examples/data-table/data-table-2";
import { DataTable20Example, fetchSectionBatch } from "@/components/component-showcase/examples/data-table/data-table-20";
import { DataTable21Example } from "@/components/component-showcase/examples/data-table/data-table-21";
import { DataTable22Example } from "@/components/component-showcase/examples/data-table/data-table-22";
import { DataTable23Example } from "@/components/component-showcase/examples/data-table/data-table-23";
import { DataTable24Example } from "@/components/component-showcase/examples/data-table/data-table-24";
import { DataTable25Example } from "@/components/component-showcase/examples/data-table/data-table-25";
import { addSection, DataTable26Example, editSection, saveDraft, SAVED_DRAFT, toggleDeleted } from "@/components/component-showcase/examples/data-table/data-table-26";
import { DataTable27Example } from "@/components/component-showcase/examples/data-table/data-table-27";
import { DataTable28Example } from "@/components/component-showcase/examples/data-table/data-table-28";
import { DataTable29Example } from "@/components/component-showcase/examples/data-table/data-table-29";
import { DataTable3Example, publishSection } from "@/components/component-showcase/examples/data-table/data-table-3";
import { DataTable30Example } from "@/components/component-showcase/examples/data-table/data-table-30";
import { DataTable31Example, formatPivotFigure, SALES } from "@/components/component-showcase/examples/data-table/data-table-31";
import { DataTable32Example, groupingFor } from "@/components/component-showcase/examples/data-table/data-table-32";
import { DataTable33Example, sectionPanelTitle } from "@/components/component-showcase/examples/data-table/data-table-33";
import { DataTable4Example } from "@/components/component-showcase/examples/data-table/data-table-4";
import { DataTable5Example } from "@/components/component-showcase/examples/data-table/data-table-5";
import { DataTable6Example, validateSectionTitle } from "@/components/component-showcase/examples/data-table/data-table-6";
import { DataTable7Example, reorderSections } from "@/components/component-showcase/examples/data-table/data-table-7";
import { DataTable8Example } from "@/components/component-showcase/examples/data-table/data-table-8";
import { DataTable9Example } from "@/components/component-showcase/examples/data-table/data-table-9";
import { DataTableDo1Example } from "@/components/component-showcase/examples/data-table/data-table-do-1";
import { DataTableDo2Example } from "@/components/component-showcase/examples/data-table/data-table-do-2";
import { DataTableDont1Example } from "@/components/component-showcase/examples/data-table/data-table-dont-1";
import { DataTableDont2Example } from "@/components/component-showcase/examples/data-table/data-table-dont-2";
import { DOCUMENT_SECTIONS, type DocumentSection } from "@/components/component-showcase/examples/data-table/data-table-sample";
import { installJsdomUiShims } from "@/testing/jsdom-ui-shims";

/** Longer than the search debounce and the pretend server's latency. */
const SETTLE_MS = 1000;
const PAGE_SIZE = 5;

interface NamedExample {
	readonly name: string;
	readonly component: () => React.JSX.Element;
}

const EXAMPLES: readonly NamedExample[] = [
	{ name: "1 overview", component: DataTable1Example },
	{ name: "2 search and filters", component: DataTable2Example },
	{ name: "3 row actions", component: DataTable3Example },
	{ name: "4 bulk selection", component: DataTable4Example },
	{ name: "5 export", component: DataTable5Example },
	{ name: "6 inline editing", component: DataTable6Example },
	{ name: "7 drag to reorder", component: DataTable7Example },
	{ name: "8 column visibility and pinning", component: DataTable8Example },
	{ name: "9 column resizing", component: DataTable9Example },
	{ name: "10 column reordering", component: DataTable10Example },
	{ name: "11 column header controls", component: DataTable11Example },
	{ name: "12 pagination and sorting", component: DataTable12Example },
	{ name: "13 layout", component: DataTable13Example },
	{ name: "14 mobile cards", component: DataTable14Example },
	{ name: "15 loading, empty and error", component: DataTable15Example },
	{ name: "16 virtualised rows", component: DataTable16Example },
	{ name: "17 virtualised columns", component: DataTable17Example },
	{ name: "18 server source", component: DataTable18Example },
	{ name: "19 infinite source, local", component: DataTable19Example },
	{ name: "20 infinite source, remote", component: DataTable20Example },
	{ name: "21 tree rows", component: DataTable21Example },
	{ name: "22 detail row", component: DataTable22Example },
	{ name: "23 sub-table", component: DataTable23Example },
	{ name: "24 row pinning", component: DataTable24Example },
	{ name: "25 footer totals", component: DataTable25Example },
	{ name: "26 CRUD with row status", component: DataTable26Example },
	{ name: "27 localised labels", component: DataTable27Example },
	{ name: "28 saved preferences", component: DataTable28Example },
	{ name: "29 kitchen sink", component: DataTable29Example },
	{ name: "30 date-range filter", component: DataTable30Example },
	{ name: "31 pivot", component: DataTable31Example },
	{ name: "32 grouping", component: DataTable32Example },
	{ name: "33 detail panel", component: DataTable33Example },
	{ name: "do 1", component: DataTableDo1Example },
	{ name: "dont 1", component: DataTableDont1Example },
	{ name: "do 2", component: DataTableDo2Example },
	{ name: "dont 2", component: DataTableDont2Example },
];

function section(id: string): DocumentSection {
	const found = DOCUMENT_SECTIONS.find((row) => row.id === id);
	if (found === undefined) {
		throw new Error(`section ${id} is in the sample`);
	}
	return found;
}

describe("DataTable example helpers", () => {
	it("puts the rows in the order a move left them, by id, and keeps hidden rows after them", () => {
		const rows = [section("s-1"), section("s-2"), section("s-3"), section("s-4")];
		expect(reorderSections(rows, ["s-2", "s-3", "s-1", "s-4"]).map(({ id }) => id)).toEqual(["s-2", "s-3", "s-1", "s-4"]);
		// A filtered view: the table was showing two of the four rows.
		expect(reorderSections(rows, ["s-4", "s-2"]).map(({ id }) => id)).toEqual(["s-4", "s-2", "s-1", "s-3"]);
		// An id the page no longer holds is skipped.
		expect(reorderSections(rows, ["gone", "s-1"]).map(({ id }) => id)).toEqual(["s-1", "s-2", "s-3", "s-4"]);
	});

	it("answers a query like a server: filter, sort, then one page with the matching total", () => {
		const base = createDataTableQuery(PAGE_SIZE);
		const done = answerSectionsQuery({ ...base, pageSize: 3, sorting: [{ id: "target", desc: true }], filters: { status: "Done" } });
		expect(done.totalCount).toBe(DOCUMENT_SECTIONS.filter((row) => row.status === "Done").length);
		expect(done.rows.map(({ target }) => target)).toEqual([30, 29, 27]);

		const second = answerSectionsQuery({ ...base, pageIndex: 1 });
		expect(second.rows.map(({ id }) => id)).toEqual(["s-6", "s-7", "s-8", "s-9", "s-10"]);

		const legal = answerSectionsQuery({ ...base, filters: { type: ["Legal", "Financial"] }, sorting: [{ id: "header", desc: false }] });
		expect(legal.rows.map(({ header }) => header)).toEqual(["Compliance documentation", "Financial projections"]);

		expect(answerSectionsQuery({ ...base, search: "maya" }).totalCount).toBe(2);
		// An unknown sort column leaves the order alone, and an empty multi-select filters nothing.
		expect(answerSectionsQuery({ ...base, sorting: [{ id: "unknown", desc: false }], filters: { type: [] } }).rows.at(0)?.id).toBe("s-1");
		// Equal on the first sort column, ordered by the second.
		const byStatusThenLimit = answerSectionsQuery({
			...base,
			sorting: [
				{ id: "status", desc: false },
				{ id: "limit", desc: false },
			],
		});
		expect(byStatusThenLimit.rows.at(0)?.header).toBe("API documentation");
	});

	it("publishes a finished section after the wait, and refuses one still in progress", async (): Promise<void> => {
		vi.useFakeTimers();
		const done = publishSection(section("s-2"));
		const inProgress = publishSection(section("s-1"));
		vi.advanceTimersByTime(SETTLE_MS);
		await expect(done).resolves.toBeUndefined();
		await expect(inProgress).rejects.toThrow("still in progress");
		vi.useRealTimers();
	});

	it("refuses an empty section title", () => {
		expect(validateSectionTitle("  ")).toBe("A section needs a title");
		expect(validateSectionTitle(null)).toBe("A section needs a title");
		expect(validateSectionTitle("Cover page")).toBeUndefined();
	});

	it("fetches the batch after the rows already loaded", () => {
		expect(fetchSectionBatch(0).map(({ id }) => id)).toEqual(["s-1", "s-2", "s-3", "s-4", "s-5", "s-6"]);
		expect(fetchSectionBatch(18).map(({ id }) => id)).toEqual(["s-19", "s-20"]);
	});

	it("tracks a draft: new, dirty and deleted marks, cleared by a save", () => {
		const added = addSection(SAVED_DRAFT);
		expect(added.sections).toHaveLength(SAVED_DRAFT.sections.length + 1);
		expect(added.marks).toEqual({ "new-1": "new" });

		const first = section("s-1");
		const edited = editSection(added, { rowId: "s-1", columnId: "header", value: "Front cover", previousValue: first.header, row: first, source: "edit" });
		expect(edited.sections.at(0)?.header).toBe("Front cover");
		expect(edited.marks["s-1"]).toBe("dirty");
		// Editing a new row leaves it marked new.
		const newRow = added.sections.at(-1);
		if (newRow === undefined) {
			throw new Error("the added section is in the draft");
		}
		expect(editSection(added, { rowId: "new-1", columnId: "header", value: "Appendix", previousValue: newRow.header, row: newRow, source: "edit" }).marks["new-1"]).toBe(
			"new",
		);

		const deleted = toggleDeleted(edited, "s-2");
		expect(deleted.marks["s-2"]).toBe("deleted");
		expect(toggleDeleted(deleted, "s-2").marks["s-2"]).toBeUndefined();
		// Deleting a new row drops it at once.
		expect(toggleDeleted(deleted, "new-1").sections.some(({ id }) => id === "new-1")).toBe(false);

		const saved = saveDraft(deleted);
		expect(saved.marks).toEqual({});
		expect(saved.sections.some(({ id }) => id === "s-2")).toBe(false);
		expect(saved.sections.some(({ id }) => id === "new-1")).toBe(true);
	});
});

describe("DataTable examples", () => {
	installJsdomUiShims();

	afterEach((): void => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		localStorage.clear();
	});

	it.each(EXAMPLES)("renders example $name without a console error", ({ component: Example }) => {
		const consoleError = vi.spyOn(console, "error");
		render(<Example />, { wrapper: UiKitTestProviders });
		expect(consoleError).not.toHaveBeenCalled();
	});

	it("opens sorted by the largest target", () => {
		render(<DataTable12Example />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("columnheader", { name: /Target/u }).getAttribute("aria-sort")).toBe("descending");
		expect(screen.getByText("Compliance documentation")).toBeTruthy();
	});

	it("moves between the loading, empty, error and ready states", () => {
		render(<DataTable15Example />, { wrapper: UiKitTestProviders });
		expect(screen.queryByText("Cover page")).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "Empty" }));
		expect(screen.getByText("No sections yet")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Error" }));
		expect(screen.getByText("The sections could not be loaded.")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Refreshing" }));
		expect(screen.getAllByText("Cover page").length).toBeGreaterThan(0);

		fireEvent.click(screen.getByRole("button", { name: "Ready" }));
		expect(screen.getAllByText("Cover page").length).toBeGreaterThan(0);
	});

	it("fetches the next page from the pretend server", () => {
		render(<DataTable18Example />, { wrapper: UiKitTestProviders });
		expect(screen.getByText("Showing 1 to 5 of 20 results")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Go to next page" }));

		expect(screen.getByText("Showing 6 to 10 of 20 results")).toBeTruthy();
		expect(screen.getAllByText("Capabilities").length).toBeGreaterThan(0);
	});

	it("searches the pretend server once typing settles", () => {
		vi.useFakeTimers();
		render(<DataTable18Example />, { wrapper: UiKitTestProviders });
		fireEvent.change(screen.getByRole("textbox", { name: "Search rows" }), { target: { value: "Maya" } });
		act((): void => {
			vi.advanceTimersByTime(SETTLE_MS);
		});
		expect(screen.getByText("Showing 1 to 2 of 2 results")).toBeTruthy();
	});

	it("adds a section to the draft and saves it", () => {
		render(<DataTable26Example />, { wrapper: UiKitTestProviders });
		expect(screen.getByText("Everything is saved.")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Add section" }));
		expect(screen.getByText("1 unsaved change")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Add section" }));
		expect(screen.getByText("2 unsaved changes")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Discard" }));
		expect(screen.getByText("Everything is saved.")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Add section" }));
		fireEvent.click(screen.getByRole("button", { name: "Save" }));
		expect(screen.getByText("Everything is saved.")).toBeTruthy();
		expect(screen.getAllByText("Untitled section").length).toBeGreaterThan(0);
	});

	it("pivots the order lines and recomputes every figure when the aggregation changes", () => {
		render(<DataTable31Example />, { wrapper: UiKitTestProviders });
		const grandTotal = SALES.reduce((total, sale) => total + sale.amount, 0);
		expect(screen.getByText(formatPivotFigure(grandTotal, "sum"))).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Orders" }));

		expect(screen.getByText(formatPivotFigure(SALES.length, "count"))).toBeTruthy();
		expect(screen.getByRole("columnheader", { name: /Orders/u })).toBeTruthy();
	});

	it("groups by the chosen column, and stops grouping on 'No grouping'", () => {
		expect(groupingFor("reviewer")).toEqual({ by: ["reviewer"] });
		expect(groupingFor("none")).toEqual({ by: [] });

		render(<DataTable32Example />, { wrapper: UiKitTestProviders });
		const typeCount = new Set(DOCUMENT_SECTIONS.map((row) => row.type)).size;
		expect(document.querySelectorAll("[data-slot=table-engine-group-cell]")).toHaveLength(typeCount);

		fireEvent.click(screen.getByRole("button", { name: "No grouping" }));

		expect(document.querySelectorAll("[data-slot=table-engine-group-cell]")).toHaveLength(0);
	});

	it("opens a section's details, named by the section, and hides the columns the panel shows", async (): Promise<void> => {
		expect(sectionPanelTitle(section("s-3"))).toBe("Executive summary");
		render(<DataTable33Example />, { wrapper: UiKitTestProviders });

		fireEvent.click(screen.getByText("Executive summary"));

		// These shims match no media query, so the table counts as narrow and the panel opens as a sheet.
		expect(await screen.findByRole("dialog", { name: "Executive summary" })).toBeTruthy();
		expect(screen.queryByRole("columnheader", { name: /Reviewer/u })).toBeNull();
	});

	it("writes a pivot figure as money, a count, or a dash for an empty cell", () => {
		expect(formatPivotFigure(1234, "sum")).toBe("$1,234");
		expect(formatPivotFigure(12, "count")).toBe("12");
		expect(formatPivotFigure(null, "average")).toBe("–");
	});

	it("adds a section at the top of the kitchen sink", () => {
		render(<DataTable29Example />, { wrapper: UiKitTestProviders });
		fireEvent.click(screen.getByRole("button", { name: "Add section" }));
		expect(screen.getAllByText("Untitled section").length).toBeGreaterThan(0);
	});
});

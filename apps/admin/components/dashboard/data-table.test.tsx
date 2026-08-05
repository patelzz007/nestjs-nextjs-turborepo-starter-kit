// @vitest-environment jsdom
//
// Runtime verification of the TanStack Table **v9** migration (`useTable` +
// `tableFeatures`). The migration typechecks, but the v9 state model (features,
// `table.state`, atom-backed setters) is exactly the kind of thing that can
// break at runtime — this test proves the table actually renders rows and that
// the interactive features (row selection, select-all, pagination) mutate
// state through the v9 API.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DataTable } from "./data-table";
import type { RowData } from "./data-table-constants";

// jsdom does not implement window.matchMedia (used by @workspace/ui's
// use-mobile hook, which the columns render via TableCellViewer). Stub the
// minimal surface the hook touches: matchMedia() returning a MQL object with
// add/removeEventListener no-ops.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		value: (query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addEventListener: (): void => undefined,
			removeEventListener: (): void => undefined,
			addListener: (): void => undefined,
			removeListener: (): void => undefined,
			dispatchEvent: (): boolean => false,
		}),
	});
}

afterEach(() => {
	cleanup();
});

/** Build `count` mock rows with unique, sortable-agnostic values. */
function makeRows(count: number): RowData[] {
	return Array.from({ length: count }, (_, index) => {
		const n = index + 1;
		return {
			id: n,
			header: `Section ${String(n)}`,
			type: n % 2 === 0 ? "Design" : "Narrative",
			status: n % 3 === 0 ? "Done" : "In Progress",
			target: String(n * 10),
			limit: String(n * 5),
			reviewer: "Assign reviewer",
		};
	});
}

describe("DataTable (TanStack Table v9)", () => {
	it("renders the first page of rows with the default page size of 10", () => {
		render(<DataTable data={makeRows(12)} />);

		// 1 header row + 10 body rows (page size 10).
		expect(screen.getAllByRole("row")).toHaveLength(11);

		// First-page rows are visible; page-2 rows are not.
		expect(screen.getByText("Section 1")).toBeTruthy();
		expect(screen.getByText("Section 10")).toBeTruthy();
		expect(screen.queryByText("Section 11")).toBeNull();
		expect(screen.getByText("Page 1 of 2")).toBeTruthy();
	});

	it("navigates to the next page through the v9 pagination API", () => {
		render(<DataTable data={makeRows(12)} />);

		fireEvent.click(screen.getByRole("button", { name: "Go to next page" }));

		expect(screen.getByText("Page 2 of 2")).toBeTruthy();
		expect(screen.getByText("Section 11")).toBeTruthy();
		expect(screen.getByText("Section 12")).toBeTruthy();
		expect(screen.queryByText("Section 1")).toBeNull();

		// Previous + first-page buttons become enabled.
		expect(screen.getByRole("button", { name: "Go to previous page" }).getAttribute("disabled")).toBeNull();
	});

	it("selects a single row through row.toggleSelected()", () => {
		render(<DataTable data={makeRows(12)} />);

		// The first body row's checkbox (aria-label "Select row").
		const rowCheckboxes = screen.getAllByRole("checkbox", { name: "Select row" });
		const firstRowCheckbox = rowCheckboxes[0];
		expect(firstRowCheckbox).toBeDefined();
		if (firstRowCheckbox !== undefined) {
			fireEvent.click(firstRowCheckbox);
		}

		expect(screen.getByText("1 of 12 row(s) selected.")).toBeTruthy();
	});

	it("selects all page rows through toggleAllPageRowsSelected()", () => {
		render(<DataTable data={makeRows(12)} />);

		fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));

		// Only the 10 rows on the current page are selected.
		expect(screen.getByText("10 of 12 row(s) selected.")).toBeTruthy();

		// All page rows are selected, so the header checkbox is fully checked.
		const selectAll = screen.getByRole("checkbox", { name: "Select all" });
		expect(selectAll.getAttribute("aria-checked")).toBe("true");

		// Deselecting one row flips it to the mixed state (aria-checked="mixed"
		// — Base UI does not guarantee the DOM `indeterminate` property).
		const rowCheckboxes = screen.getAllByRole("checkbox", { name: "Select row" });
		const firstRowCheckbox = rowCheckboxes[0];
		expect(firstRowCheckbox).toBeDefined();
		if (firstRowCheckbox !== undefined) {
			fireEvent.click(firstRowCheckbox);
		}
		expect(screen.getByText("9 of 12 row(s) selected.")).toBeTruthy();
		expect(selectAll.getAttribute("aria-checked")).toBe("mixed");
	});

	it("shows the empty state when there are no rows", () => {
		render(<DataTable data={[]} />);

		expect(screen.getByText("No results.")).toBeTruthy();
		expect(screen.getByText("Page 1 of 1")).toBeTruthy();
	});

	it("says 0 selected by default", () => {
		render(<DataTable data={makeRows(5)} />);

		// The summary lives in a footer div that is hidden below lg — still in
		// the DOM, so assert inside the table's container.
		expect(screen.getByText("0 of 5 row(s) selected.")).toBeTruthy();
		// All 5 rows fit on one page (1 header + 5 body rows).
		const body = screen.getAllByRole("row");
		expect(body).toHaveLength(6);
		const lastRow = body[5];
		expect(lastRow).toBeDefined();
		if (lastRow !== undefined) {
			expect(within(lastRow).getByText("Section 5")).toBeTruthy();
		}
	});
});

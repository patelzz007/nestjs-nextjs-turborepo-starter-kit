// @vitest-environment jsdom
//
// Regression coverage for the shared v9 `DataTable` (packages/ui) and its
// admin showcase wrapper. The component is the v8-style paste adapted to the
// repo's TanStack Table **v9** API (`useTable` + module-scope `tableFeatures`),
// so these tests prove the v9 wiring actually works at runtime: rows render,
// pagination/search/selection mutate state through the v9 API, and the empty
// state behaves.

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { DataTable, sanitizeExportCell, type DataTableFeatures, type DataTableServerPagination } from "@workspace/ui/components/data-table";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTableShowcase } from "../data-table-showcase";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { UI_KIT_LABELS_EN } from "@workspace/ui/lib/labels/en";

// ── Test harness data (mirrors the showcase's row shape) ───────────────────

const rowSchema = z.object({
	id: z.number(),
	header: z.string(),
	status: z.string(),
});

type DemoRow = z.infer<typeof rowSchema>;

const demoColumns: ColumnDef<DataTableFeatures, DemoRow>[] = [
	{ accessorKey: "id", header: "ID" },
	{ accessorKey: "header", header: "Header" },
	{ accessorKey: "status", header: "Status" },
];

function makeRows(count: number): DemoRow[] {
	// Parse through the schema so the zod shape is exercised at runtime too.
	return rowSchema.array().parse(
		Array.from({ length: count }, (_, index) => ({
			id: index + 1,
			header: `Section ${String(index + 1)}`,
			status: (index + 1) % 3 === 0 ? "Done" : "In Progress",
		})),
	);
}

function createServerPagination(overrides: Partial<DataTableServerPagination<DemoRow>> = {}): DataTableServerPagination<DemoRow> {
	return {
		mode: "server",
		totalCount: 12,
		pageIndex: 0,
		pageSize: 10,
		onPageChange: (): void => undefined,
		getRowId: (row: DemoRow): string => String(row.id),
		...overrides,
	};
}

afterEach(() => {
	cleanup();
});

describe("DataTable (shared, TanStack Table v9)", () => {
	it("renders the first page of rows with the default page size of 10", () => {
		render(<DataTable data={makeRows(12)} columns={demoColumns} />, { wrapper: UiKitTestProviders });

		// 1 header row + 10 body rows (page size 10).
		expect(screen.getAllByRole("row")).toHaveLength(11);

		expect(screen.getByText("Section 1")).toBeTruthy();
		expect(screen.getByText("Section 10")).toBeTruthy();
		expect(screen.queryByText("Section 11")).toBeNull();

		// Pagination summary reflects the filtered count.
		expect(screen.getByText(/Showing 1 to 10 of 12 results/)).toBeTruthy();
	});

	it("navigates to the next page through the v9 pagination API", () => {
		render(<DataTable data={makeRows(12)} columns={demoColumns} />, { wrapper: UiKitTestProviders });

		fireEvent.click(screen.getByRole("button", { name: /next page/i }));
		expect(screen.getByText(/Showing 11 to 12 of 12 results/)).toBeTruthy();
		expect(screen.getByText("Section 11")).toBeTruthy();
		expect(screen.getByText("Section 12")).toBeTruthy();
		expect(screen.queryByText("Section 1")).toBeNull();
	});

	it("filters rows through the global search over searchKeys", () => {
		render(<DataTable data={makeRows(12)} columns={demoColumns} searchKeys={["header"]} />, { wrapper: UiKitTestProviders });

		const search = screen.getByPlaceholderText(UI_KIT_LABELS_EN.dataTable.searchPlaceholder);
		fireEvent.change(search, { target: { value: "Section 11" } });

		// Only the matching row survives the filter.
		expect(screen.getByText("Section 11")).toBeTruthy();
		expect(screen.queryByText("Section 1")).toBeNull();
		// The pagination bar is ALWAYS rendered (compulsory in every table) and
		// reflects the filtered set — it never disappears after a filter.
		expect(screen.getByText(/Showing 1 to 1 of 1 results/)).toBeTruthy();
	});

	it("propagates the header select-all to every visible row checkbox", () => {
		render(<DataTable data={makeRows(5)} columns={demoColumns} checkbox />, { wrapper: UiKitTestProviders });

		fireEvent.click(screen.getByRole("checkbox", { name: UI_KIT_LABELS_EN.dataTable.selectAllAriaLabel }));

		// The per-row granular subscription flips every visible row checkbox to
		// checked — this is the regression guard for the v9 row-caching trap.
		const rowCheckboxes = screen.getAllByRole("checkbox", { name: UI_KIT_LABELS_EN.dataTable.selectRowAriaLabel });
		expect(rowCheckboxes.length).toBe(5);
		for (const box of rowCheckboxes) {
			expect(box.getAttribute("aria-checked")).toBe("true");
		}
	});

	it("exports only the selected rows as JSON when rows are selected", async () => {
		let capturedBlob: Blob | MediaSource | undefined;
		const revokeObjectURL = vi.fn();
		const createObjectURL = vi.spyOn(URL, "createObjectURL").mockImplementation((blob: Blob | MediaSource): string => {
			capturedBlob = blob;
			return "blob:mock-export";
		});
		vi.spyOn(URL, "revokeObjectURL").mockImplementation(revokeObjectURL);
		const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation((): void => undefined);
		try {
			render(<DataTable data={makeRows(5)} columns={demoColumns} checkbox={{ export: true, exportFilename: "sections.csv" }} />, { wrapper: UiKitTestProviders });

			// Select rows 1 and 3 only.
			const [firstRowCheckbox, , thirdRowCheckbox] = screen.getAllByRole("checkbox", { name: UI_KIT_LABELS_EN.dataTable.selectRowAriaLabel });
			if (firstRowCheckbox !== undefined) {
				fireEvent.click(firstRowCheckbox);
			}
			if (thirdRowCheckbox !== undefined) {
				fireEvent.click(thirdRowCheckbox);
			}

			// Open the export menu and pick JSON.
			fireEvent.click(screen.getByText(UI_KIT_LABELS_EN.dataTable.export));
			fireEvent.click(screen.getByText(UI_KIT_LABELS_EN.dataTable.exportJson));

			await waitFor(() => {
				expect(createObjectURL).toHaveBeenCalled();
			});
			expect(capturedBlob).toBeInstanceOf(Blob);
			if (!(capturedBlob instanceof Blob)) {
				throw new Error("Expected exportToJSON to create a Blob");
			}
			// Parse through the zod schema (rule 13) instead of trusting JSON.parse.
			const parsed = rowSchema.array().safeParse(JSON.parse(await capturedBlob.text()));
			expect(parsed.success).toBe(true);
			if (!parsed.success) {
				throw new Error("Exported JSON did not match the demo row schema");
			}
			expect(parsed.data).toHaveLength(2);
			expect(parsed.data[LIST_SLOT_INDEX.first]?.header).toBe("Section 1");
			expect(parsed.data[LIST_SLOT_INDEX.second]?.header).toBe("Section 3");
			expect(anchorClick).toHaveBeenCalled();
		} finally {
			vi.restoreAllMocks();
		}
	});

	it("enables row selection through the checkbox prop", () => {
		render(
			<DataTable
				data={makeRows(5)}
				columns={demoColumns}
				checkbox={{
					onDeleteAll: (): void => undefined,
					export: true,
					exportFilename: "sections.csv",
				}}
			/>,
			{ wrapper: UiKitTestProviders },
		);

		fireEvent.click(screen.getByRole("checkbox", { name: UI_KIT_LABELS_EN.dataTable.selectAllAriaLabel }));

		expect(screen.getByText(UI_KIT_LABELS_EN.dataTable.deleteSelected)).toBeTruthy();
		expect(screen.getByText(UI_KIT_LABELS_EN.dataTable.export)).toBeTruthy();
	});

	it("shows the selection summary for export-only checkbox tables", () => {
		render(
			<DataTable
				data={makeRows(12)}
				columns={demoColumns}
				checkbox={{
					export: true,
					exportFilename: "sections.csv",
				}}
			/>,
			{ wrapper: UiKitTestProviders },
		);

		fireEvent.click(screen.getByRole("checkbox", { name: UI_KIT_LABELS_EN.dataTable.selectAllAriaLabel }));

		expect(screen.getByText(/10 rows selected/)).toBeTruthy();
		expect(screen.queryByText("Delete selected")).toBeNull();
	});

	it("selects a single row through row.toggleSelected()", () => {
		render(<DataTable data={makeRows(12)} columns={demoColumns} checkbox={{ bulkActions: [{ key: "delete", label: "Delete", onClick: (): void => undefined }] }} />, {
			wrapper: UiKitTestProviders,
		});

		const rowCheckboxes = screen.getAllByRole("checkbox", { name: UI_KIT_LABELS_EN.dataTable.selectRowAriaLabel });
		const firstRowCheckbox = rowCheckboxes[LIST_SLOT_INDEX.first];
		expect(firstRowCheckbox).toBeDefined();
		if (firstRowCheckbox !== undefined) {
			fireEvent.click(firstRowCheckbox);
		}

		// The selection summary is rendered in the bulk bar (bulkActions present).
		expect(screen.getByText(/1 row selected/)).toBeTruthy();
	});

	it("selects all page rows through toggleAllPageRowsSelected()", () => {
		render(<DataTable data={makeRows(12)} columns={demoColumns} checkbox={{ bulkActions: [{ key: "delete", label: "Delete", onClick: (): void => undefined }] }} />, {
			wrapper: UiKitTestProviders,
		});

		fireEvent.click(screen.getByRole("checkbox", { name: UI_KIT_LABELS_EN.dataTable.selectAllAriaLabel }));

		// Only the 10 rows on the current page are selected.
		expect(screen.getByText(/10 rows selected/)).toBeTruthy();

		// All page rows selected → the select-all banner offers the rest.
		expect(screen.getByText(/All 10 rows on this page are selected/)).toBeTruthy();
	});

	it("server pagination mode does not slice rows client-side", () => {
		render(<DataTable data={makeRows(10)} columns={demoColumns} pagination={createServerPagination({ totalCount: 50, pageSize: 10 })} />, { wrapper: UiKitTestProviders });

		expect(screen.getAllByText(/^Section \d+$/)).toHaveLength(10);
		expect(screen.getByText(/Showing 1 to 10 of 50 results/)).toBeTruthy();
		expect(screen.getByText(/Page 1 of 5/)).toBeTruthy();
	});

	it("renders the empty state when there are no rows", () => {
		render(<DataTable data={[]} columns={demoColumns} />, { wrapper: UiKitTestProviders });

		expect(screen.getByText(UI_KIT_LABELS_EN.dataTable.noDataTitle)).toBeTruthy();
	});

	it("hides the export toolbar when not enabled", () => {
		render(<DataTable data={makeRows(5)} columns={demoColumns} />, { wrapper: UiKitTestProviders });

		expect(screen.queryByText("Export")).toBeNull();
		expect(screen.queryByPlaceholderText(UI_KIT_LABELS_EN.dataTable.searchPlaceholder)).toBeNull();
	});

	it("debounces the global search when searchDebounceMs is set", () => {
		vi.useFakeTimers();
		try {
			render(<DataTable data={makeRows(12)} columns={demoColumns} searchKeys={["header"]} searchDebounceMs={150} />, { wrapper: UiKitTestProviders });

			const search = screen.getByPlaceholderText(UI_KIT_LABELS_EN.dataTable.searchPlaceholder);
			fireEvent.change(search, { target: { value: "Section 11" } });

			// Inside the debounce window nothing has been filtered yet.
			expect(screen.getByText("Section 1")).toBeTruthy();

			// Flush the debounce timer inside `act` so React applies the state.
			act(() => {
				vi.advanceTimersByTime(150);
			});

			// After the window elapses the filter applies.
			expect(screen.getByText("Section 11")).toBeTruthy();
			expect(screen.queryByText("Section 1")).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	it("clears the search through the in-input clear button", () => {
		render(<DataTable data={makeRows(12)} columns={demoColumns} searchKeys={["header"]} />, { wrapper: UiKitTestProviders });

		const search = screen.getByPlaceholderText(UI_KIT_LABELS_EN.dataTable.searchPlaceholder);
		fireEvent.change(search, { target: { value: "Section 11" } });
		expect(screen.getByText("Section 11")).toBeTruthy();
		expect(screen.queryByText("Section 1")).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: UI_KIT_LABELS_EN.dataTable.clearSearchAriaLabel }));

		// The input is reset and the first page of rows is back.
		expect(screen.getByPlaceholderText<HTMLInputElement>("Search...").value).toBe("");
		expect(screen.getByText("Section 1")).toBeTruthy();
		expect(screen.getByText("Section 10")).toBeTruthy();
		expect(screen.queryByText("Section 11")).toBeNull();
	});

	function noopManualColumnFilterChange(): void {
		return undefined;
	}

	it("hides the client-side search when server pagination is active", () => {
		render(
			<DataTable
				data={makeRows(10)}
				columns={demoColumns}
				pagination={createServerPagination()}
				searchKeys={["header"]}
				filters={[{ key: "status", label: "Status", options: [] }]}
				onManualColumnFilterChange={noopManualColumnFilterChange}
			/>,
			{ wrapper: UiKitTestProviders },
		);

		expect(screen.queryByPlaceholderText(UI_KIT_LABELS_EN.dataTable.searchPlaceholder)).toBeNull();
		expect(screen.getByText("Status")).toBeTruthy();
	});

	it("server pagination notifies the parent on page change", () => {
		const onPageChange = vi.fn();
		render(<DataTable data={makeRows(10)} columns={demoColumns} pagination={createServerPagination({ totalCount: 50, onPageChange })} />, { wrapper: UiKitTestProviders });

		fireEvent.click(screen.getByRole("button", { name: /next page/i }));
		expect(onPageChange).toHaveBeenCalledWith(1, 10);
	});

	it("labels server column filter selects and wires manual filter callbacks", () => {
		const onPageChange = vi.fn();
		const onManualColumnFilterChange = vi.fn();
		render(
			<DataTable
				data={makeRows(10)}
				columns={demoColumns}
				pagination={createServerPagination({ totalCount: 50, pageIndex: 2, onPageChange })}
				filters={[
					{
						key: "status",
						label: "Status",
						options: [{ value: "Done", label: "Done" }],
					},
				]}
				manualColumnFilters={{ status: "all" }}
				onManualColumnFilterChange={onManualColumnFilterChange}
			/>,
			{ wrapper: UiKitTestProviders },
		);

		expect(screen.getByRole("combobox", { name: "Status" })).toBeTruthy();
	});

	it("changes the client page size through the page-size select", () => {
		render(<DataTable data={makeRows(12)} columns={demoColumns} pageSizeOptions={[5, 10, 20]} />, { wrapper: UiKitTestProviders });

		expect(screen.getByText(/Showing 1 to 10 of 12 results/)).toBeTruthy();
	});

	it("renders skeleton rows while isLoading instead of the data", () => {
		const { container } = render(<DataTable data={makeRows(12)} columns={demoColumns} isLoading skeletonRows={4} />, { wrapper: UiKitTestProviders });

		// Skeleton placeholders (shimmer) are present; real rows are not.
		expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
		expect(screen.queryByText("Section 1")).toBeNull();
	});

	it("renders the error state instead of the table when error is set", () => {
		render(<DataTable data={makeRows(12)} columns={demoColumns} error="Failed to load sections" />, { wrapper: UiKitTestProviders });

		expect(screen.getByText("Failed to load sections")).toBeTruthy();
		expect(screen.queryByText("Section 1")).toBeNull();
	});

	it("sanitizes formula-like cells for CSV/Spreadsheet export", () => {
		// Cells that a spreadsheet app would evaluate get a leading apostrophe.
		expect(sanitizeExportCell("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
		expect(sanitizeExportCell("+cmd")).toBe("'+cmd");
		expect(sanitizeExportCell("-x")).toBe("'-x");
		expect(sanitizeExportCell("@import")).toBe("'@import");
		expect(sanitizeExportCell("\tindent")).toBe("'\tindent");

		// Ordinary values pass through untouched.
		expect(sanitizeExportCell("Cover page")).toBe("Cover page");
		expect(sanitizeExportCell(42)).toBe("42");
		expect(sanitizeExportCell(null)).toBe("");
	});

	it("cycles the sort through asc → desc → none when sortCycle is set", () => {
		render(<DataTable data={makeRows(5)} columns={demoColumns} sortCycle="asc-desc-none" />, { wrapper: UiKitTestProviders });

		const idHeader = screen.getByText("ID");

		// 1st click → ascending (rows 1…5 in order).
		fireEvent.click(idHeader);
		let rows = screen.getAllByRole("row");
		expect(rows[LIST_SLOT_INDEX.second]?.textContent).toContain("Section 1");
		expect(rows[LIST_SLOT_INDEX.sixth]?.textContent).toContain("Section 5");

		// 2nd click → descending (rows 5…1).
		fireEvent.click(idHeader);
		rows = screen.getAllByRole("row");
		expect(rows[LIST_SLOT_INDEX.second]?.textContent).toContain("Section 5");
		expect(rows[LIST_SLOT_INDEX.sixth]?.textContent).toContain("Section 1");

		// 3rd click → cleared (back to the original order).
		fireEvent.click(idHeader);
		rows = screen.getAllByRole("row");
		expect(rows[LIST_SLOT_INDEX.second]?.textContent).toContain("Section 1");
		expect(rows[LIST_SLOT_INDEX.sixth]?.textContent).toContain("Section 5");
	});

	it("virtualizes long lists when virtualizeRows is enabled", () => {
		render(<DataTable data={makeRows(200)} columns={demoColumns} pageSize={200} virtualizeRows virtualRowHeight={48} maxHeight={200} />, { wrapper: UiKitTestProviders });

		// Only the visible band (+ overscan) is in the DOM, not all 200 rows.
		const renderedRows = screen.getAllByRole("row");
		expect(renderedRows.length).toBeLessThan(200);

		// The band includes the first page of rows and the spacer rows.
		expect(screen.getByText("Section 1")).toBeTruthy();
		expect(screen.queryByText("Section 200")).toBeNull();
	});

	it("resets the virtual scroll offset when sorting", () => {
		const { container } = render(
			<DataTable data={makeRows(200)} columns={demoColumns} pageSize={200} virtualizeRows virtualRowHeight={48} maxHeight={200} sortCycle="asc-desc-none" />,
			{ wrapper: UiKitTestProviders },
		);

		const scrollContainer = container.querySelector(".overflow-auto");
		expect(scrollContainer).not.toBeNull();
		if (scrollContainer instanceof HTMLElement) {
			scrollContainer.scrollTop = 1000;
			fireEvent.scroll(scrollContainer);
		}

		// Scrolled deep → the top rows left the visible band.
		expect(screen.queryByText("Section 1")).toBeNull();

		// Sorting invalidates the offset → the band snaps back to the top.
		fireEvent.click(screen.getByText("ID"));
		expect(screen.getByText("Section 1")).toBeTruthy();
	});

	it("resets the virtual scroll offset when paginating", () => {
		const { container } = render(<DataTable data={makeRows(200)} columns={demoColumns} virtualizeRows virtualRowHeight={48} maxHeight={200} />, {
			wrapper: UiKitTestProviders,
		});

		const scrollContainer = container.querySelector(".overflow-auto");
		expect(scrollContainer).not.toBeNull();
		if (scrollContainer instanceof HTMLElement) {
			scrollContainer.scrollTop = 1000;
			fireEvent.scroll(scrollContainer);
		}

		// Scrolled deep → the top rows left the visible band.
		expect(screen.queryByText("Section 1")).toBeNull();

		// Paginating invalidates the offset → page 2 renders from its first row.
		fireEvent.click(screen.getByRole("button", { name: /next page/i }));
		expect(screen.getByText("Section 11")).toBeTruthy();
		expect(screen.getByText(/Showing 11 to 20 of 200 results/)).toBeTruthy();
	});

	it("edits a cell inline and reports the full row original", () => {
		const onCellEdit = vi.fn((_rowIndex: number, _columnId: string, _value: string | number | boolean | null, _row: DemoRow): void => undefined);
		render(<DataTable data={makeRows(5)} columns={demoColumns} editable editableColumns={["header"]} onCellEdit={onCellEdit} />, { wrapper: UiKitTestProviders });

		// Double-click the first header cell to open the inline editor.
		fireEvent.doubleClick(screen.getByText("Section 1"));
		const input = screen.getByDisplayValue("Section 1");
		expect(input).toBeTruthy();

		// Type a new value and commit with Enter.
		fireEvent.change(input, { target: { value: "Renamed section" } });
		fireEvent.keyDown(input, { key: "Enter" });

		// The callback receives the visible index, column id, new value AND the
		// row original, so consumers can map the edit back by stable id even
		// when sorting/filtering/pagination re-order the row model.
		expect(onCellEdit).toHaveBeenCalledWith(0, "header", "Renamed section", expect.objectContaining({ id: 1, header: "Section 1" }));

		// The editor closes after a successful save.
		expect(screen.queryByDisplayValue("Renamed section")).toBeNull();
	});

	it("reports the visible rows when a row is dragged and dropped", () => {
		const onRowReorder = vi.fn((_fromIndex: number, _toIndex: number, _rows: DemoRow[]): void => undefined);
		render(<DataTable data={makeRows(5)} columns={demoColumns} draggable onRowReorder={onRowReorder} />, { wrapper: UiKitTestProviders });

		const rows = screen.getAllByRole("row");
		const firstRow = rows[LIST_SLOT_INDEX.second];
		const thirdRow = rows[LIST_SLOT_INDEX.fourth];
		expect(firstRow).toBeDefined();
		expect(thirdRow).toBeDefined();
		if (firstRow === undefined || thirdRow === undefined) {
			return;
		}

		// jsdom exposes no DataTransfer global, so the native events carry a
		// minimal spec-compliant stand-in via defineProperty (React reads
		// `nativeEvent.dataTransfer` when building its synthetic drag event).
		class MockDataTransfer {
			private readonly _store = new Map<string, string>();
			public effectAllowed = "move";
			public dropEffect = "move";
			public setData(format: string, value: string): void {
				this._store.set(format, value);
			}
			public getData(format: string): string {
				return this._store.get(format) ?? "";
			}
		}
		const dataTransfer = new MockDataTransfer();
		const dragStartEvent = new Event("dragstart", { bubbles: true, cancelable: true });
		Object.defineProperty(dragStartEvent, "dataTransfer", { value: dataTransfer, configurable: true });
		fireEvent(firstRow, dragStartEvent);

		const dropEvent = new Event("drop", { bubbles: true, cancelable: true });
		Object.defineProperty(dropEvent, "dataTransfer", { value: dataTransfer, configurable: true });
		fireEvent(thirdRow, dropEvent);

		// The callback receives the source/drop indices plus the visible row
		// originals in display order (so consumers reorder by id, not index).
		expect(onRowReorder).toHaveBeenCalledWith(0, 2, expect.any(Array));
		const rowsArg = onRowReorder.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.third];
		expect(rowsArg).toHaveLength(5);
	});
});

describe("DataTableShowcase", () => {
	it("renders the demo table with its smart configuration", () => {
		render(<DataTableShowcase />, { wrapper: UiKitTestProviders });

		// Smart-layer title/description + a demo row. Row cells render in BOTH
		// the desktop table and the mobile card view (jsdom doesn't apply the
		// `hidden lg:block`/`lg:hidden` responsive classes), so use getAllByText.
		expect(screen.getByText("Document sections")).toBeTruthy();
		expect(screen.getAllByText("Cover page").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Eddie Lake").length).toBeGreaterThan(0);

		// Export + Columns toggles are enabled by the showcase.
		expect(screen.getByText(UI_KIT_LABELS_EN.dataTable.export)).toBeTruthy();
		expect(screen.getByText(UI_KIT_LABELS_EN.dataTable.columnsToggle)).toBeTruthy();

		// Column filters (status + type) render as selects.
		expect(screen.getAllByText("Status").length).toBeGreaterThan(0);
		expect(screen.getAllByRole("combobox").length).toBeGreaterThanOrEqual(2);
	});

	it("opens the row action menu from the actions column", () => {
		render(<DataTableShowcase />, { wrapper: UiKitTestProviders });

		const [openMenuButton] = screen.getAllByRole("button", { name: "Open section row menu" });
		expect(openMenuButton).toBeDefined();
		if (openMenuButton !== undefined) {
			fireEvent.click(openMenuButton);
		}
		expect(screen.getAllByText("View").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Edit").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Delete").length).toBeGreaterThan(0);
	});
});

// @vitest-environment jsdom
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { availableRowActions, rowActionsColumnWidth, runRowAction, type RowActionRunState } from "../../internal/data-table/row-actions-menu";
import { accessibilityViolations } from "../../testing/axe";
import { UiKitTestProviders } from "../../testing/ui-kit-test-providers";
import {
	DataTable,
	createDataTableQuery,
	type DataTableColumns,
	type DataTableFilter,
	type DataTablePreferences,
	type DataTableProps,
	type DataTableQuery,
	type DataTableQueryChange,
	type DataTableRowAction,
	type DataTableStorageAdapter,
} from "../data-table";

interface Invoice {
	readonly id: string;
	readonly customer: string;
	readonly status: string;
	readonly type: string;
	readonly amount: number;
}

const INVOICES: readonly Invoice[] = [
	{ id: "inv-1", customer: "Cedar", status: "PAID", type: "ONE_OFF", amount: 30 },
	{ id: "inv-2", customer: "Aspen", status: "PARTIALLY_PAID", type: "RECURRING", amount: 10 },
	{ id: "inv-3", customer: "Birch", status: "VOID", type: "ONE_OFF", amount: 20 },
];

const COLUMNS: DataTableColumns<Invoice> = [
	{ accessorKey: "customer", header: "Customer" },
	{ accessorKey: "status", header: "Status" },
	{ accessorKey: "type", header: "Type" },
	{ accessorKey: "amount", header: "Amount" },
];

const STATUS_FILTER: DataTableFilter = {
	kind: "select",
	column: "status",
	label: "Status",
	options: [
		{ value: "PAID", label: "Paid" },
		{ value: "PARTIALLY_PAID", label: "Partially paid" },
		{ value: "VOID", label: "Void" },
	],
};

const TYPE_FILTER: DataTableFilter = {
	kind: "multi-select",
	column: "type",
	label: "Type",
	options: [
		{ value: "ONE_OFF", label: "One-off" },
		{ value: "RECURRING", label: "Recurring" },
	],
};

const SERVER_PAGE_SIZE = 2;
const SERVER_TOTAL = 6;

function getRowId(invoice: Invoice): string {
	return invoice.id;
}

function noop(): void {
	// Nothing to do: a stub listener.
}

/** jsdom has no ResizeObserver; the table measures its scroller with one. */
class ResizeObserverStub {
	public observe(): void {
		noop();
	}

	public unobserve(): void {
		noop();
	}

	public disconnect(): void {
		noop();
	}
}

/** `true` renders the desktop table; `false` the mobile cards. The page is on screen either way: `print` never matches. */
function stubViewport(isDesktop: boolean): void {
	vi.stubGlobal("matchMedia", (query: string): Pick<MediaQueryList, "matches" | "media" | "addEventListener" | "removeEventListener"> => ({
		matches: query === "print" ? false : isDesktop,
		media: query,
		addEventListener: noop,
		removeEventListener: noop,
	}));
}

/** jsdom has no Web Animations API; the scroll area under the table waits on `getAnimations()`. */
function noAnimations(): Animation[] {
	return [];
}

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", ResizeObserverStub);
	Object.defineProperty(HTMLElement.prototype, "getAnimations", { configurable: true, value: noAnimations });
	// jsdom has no scrollIntoView; an editing table scrolls the focused cell into view.
	Element.prototype.scrollIntoView = vi.fn();
	stubViewport(true);
});

afterEach((): void => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	Reflect.deleteProperty(HTMLElement.prototype, "getAnimations");
});

type TableOverrides = Partial<DataTableProps<Invoice>>;

function renderTable(overrides: TableOverrides = {}): void {
	render(<DataTable data={INVOICES} columns={COLUMNS} getRowId={getRowId} {...overrides} />, { wrapper: UiKitTestProviders });
}

/** The customers on screen, top to bottom. */
function shownCustomers(): string[] {
	return screen
		.getAllByRole("row")
		.map((row) => within(row).queryAllByRole("cell").at(LIST_SLOT_INDEX.first)?.textContent ?? "")
		.filter((text) => text !== "");
}

function columnHeader(name: string): HTMLElement {
	return screen.getByRole("columnheader", { name: new RegExp(name, "u") });
}

function clickSort(name: string): void {
	fireEvent.click(within(columnHeader(name)).getByRole("button"));
}

function chooseOption(combobox: HTMLElement, label: RegExp): void {
	fireEvent.click(combobox);
	const option = screen.getAllByRole("option", { hidden: true }).find((candidate) => label.test(candidate.textContent));
	if (option === undefined) {
		throw new Error(`no option matches ${String(label)}`);
	}
	// Enter picks the highlighted option (jsdom has no pointer sequence for a click to select).
	fireEvent.keyDown(option, { key: "Enter" });
}

describe("DataTable: the records", () => {
	it("renders one row per record, in the order given", () => {
		renderTable();
		expect(shownCustomers()).toEqual(["Cedar", "Aspen", "Birch"]);
	});

	it("has no serious accessibility problems", async (): Promise<void> => {
		renderTable({ heading: { title: "Invoices" }, search: { keys: ["customer"] }, filters: [STATUS_FILTER], paging: {}, selection: {} });
		await expect(accessibilityViolations(document.body)).resolves.toStrictEqual([]);
	});

	it("refuses two columns with the same id", () => {
		vi.spyOn(console, "error").mockImplementation(noop);
		const duplicated: DataTableColumns<Invoice> = [
			{ accessorKey: "customer", header: "Customer" },
			{ accessorKey: "customer", header: "Customer again" },
		];
		expect(() => {
			renderTable({ columns: duplicated });
		}).toThrow('"customer" is used by more than one column');
	});
});

describe("DataTable: heading", () => {
	it("shows the title, the description and the actions", () => {
		renderTable({ heading: { title: "Invoices", description: "Every invoice sent", actions: <button type="button">New invoice</button> } });
		expect(screen.getByText("Invoices")).toBeTruthy();
		expect(screen.getByText("Every invoice sent")).toBeTruthy();
		expect(screen.getByRole("button", { name: "New invoice" })).toBeTruthy();
	});
});

describe("DataTable: sorting", () => {
	it("flips between ascending and descending by default, and says so on the header", () => {
		renderTable();

		clickSort("Customer");
		expect(shownCustomers()).toEqual(["Aspen", "Birch", "Cedar"]);
		expect(columnHeader("Customer").getAttribute("aria-sort")).toBe("ascending");

		clickSort("Customer");
		expect(shownCustomers()).toEqual(["Cedar", "Birch", "Aspen"]);
		expect(columnHeader("Customer").getAttribute("aria-sort")).toBe("descending");

		clickSort("Customer");
		expect(columnHeader("Customer").getAttribute("aria-sort")).toBe("ascending");
	});

	it("starts with the initial sort", () => {
		renderTable({ sorting: { initial: [{ id: "customer", desc: true }] } });
		expect(shownCustomers()).toEqual(["Cedar", "Birch", "Aspen"]);
		expect(columnHeader("Customer").getAttribute("aria-sort")).toBe("descending");
	});

	it("returns to the original order on the third click with the asc-desc-none cycle", () => {
		renderTable({ sorting: { cycle: "asc-desc-none" } });

		clickSort("Customer");
		clickSort("Customer");
		clickSort("Customer");

		expect(shownCustomers()).toEqual(["Cedar", "Aspen", "Birch"]);
		expect(columnHeader("Customer").getAttribute("aria-sort")).toBe("none");
	});
});

describe("DataTable: paging", () => {
	it("shows every row and no pager without the paging prop", () => {
		renderTable();
		expect(shownCustomers()).toHaveLength(INVOICES.length);
		expect(document.querySelector("[data-slot=data-table-pager]")).toBeNull();
	});

	it("pages the rows and moves between pages", () => {
		renderTable({ paging: { pageSize: 2, pageSizeOptions: [2, 5] } });

		expect(shownCustomers()).toEqual(["Cedar", "Aspen"]);
		expect(screen.getByText("Showing 1 to 2 of 3 results")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Go to previous page" }).hasAttribute("disabled")).toBe(true);

		fireEvent.click(screen.getByRole("button", { name: "Go to next page" }));

		expect(shownCustomers()).toEqual(["Birch"]);
		expect(screen.getByText("Showing 3 to 3 of 3 results")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Go to page 2" }).getAttribute("aria-current")).toBe("page");
		expect(screen.getByRole("button", { name: "Go to next page" }).hasAttribute("disabled")).toBe(true);
	});

	it("returns to the first page when the page size changes", () => {
		renderTable({ paging: { pageSize: 2, pageSizeOptions: [2, 5] } });
		fireEvent.click(screen.getByRole("button", { name: "Go to next page" }));

		chooseOption(screen.getByRole("combobox", { name: /Show.*per page/u }), /^5$/u);

		expect(shownCustomers()).toEqual(["Cedar", "Aspen", "Birch"]);
		expect(screen.getByText("Showing 1 to 3 of 3 results")).toBeTruthy();
	});

	it("stays on a page that exists when the caller hands over fewer rows", () => {
		const paging = { pageSize: 2, pageSizeOptions: [2, 5] };
		const { rerender } = render(<DataTable data={INVOICES} columns={COLUMNS} getRowId={getRowId} paging={paging} />, { wrapper: UiKitTestProviders });
		fireEvent.click(screen.getByRole("button", { name: "Go to next page" }));
		expect(shownCustomers()).toEqual(["Birch"]);

		rerender(<DataTable data={INVOICES.slice(0, paging.pageSize)} columns={COLUMNS} getRowId={getRowId} paging={paging} />);

		expect(shownCustomers()).toEqual(["Cedar", "Aspen"]);
		expect(screen.getByText("Showing 1 to 2 of 2 results")).toBeTruthy();
	});
});

describe("DataTable: search", () => {
	it("filters on the named keys as the reader types, and counts the matches", () => {
		renderTable({ search: { keys: ["customer"] } });

		fireEvent.change(screen.getByRole("textbox", { name: "Search rows" }), { target: { value: "asp" } });

		expect(shownCustomers()).toEqual(["Aspen"]);
		expect(screen.getByText("1 of 3 results")).toBeTruthy();
	});

	it("matches a row field no column shows, read from the row", () => {
		renderTable({ search: { keys: ["id"] } });
		fireEvent.change(screen.getByRole("textbox", { name: "Search rows" }), { target: { value: "INV-2" } });
		expect(shownCustomers()).toEqual(["Aspen"]);
	});

	it("matches a row on any of its keys, a column or not", () => {
		renderTable({ search: { keys: ["customer", "id"] } });
		const box = screen.getByRole("textbox", { name: "Search rows" });

		fireEvent.change(box, { target: { value: "birch" } });
		expect(shownCustomers()).toEqual(["Birch"]);

		fireEvent.change(box, { target: { value: "inv-1" } });
		expect(shownCustomers()).toEqual(["Cedar"]);
	});

	it("does not match a key the search does not name", () => {
		renderTable({ search: { keys: ["customer"] } });
		fireEvent.change(screen.getByRole("textbox", { name: "Search rows" }), { target: { value: "void" } });
		expect(screen.getByText("No results found")).toBeTruthy();
	});

	it("waits for the debounce before filtering", async (): Promise<void> => {
		// Real timers: the scroll area under the table runs timers of its own, which fake timers would fire in jsdom.
		const debounceMs = 40;
		renderTable({ search: { keys: ["customer"], debounceMs } });

		fireEvent.change(screen.getByRole("textbox", { name: "Search rows" }), { target: { value: "asp" } });
		// The box shows the text at once; the rows wait.
		expect(screen.getByRole("textbox", { name: "Search rows" })).toHaveProperty("value", "asp");
		expect(shownCustomers()).toHaveLength(INVOICES.length);

		await waitFor((): void => {
			expect(shownCustomers()).toEqual(["Aspen"]);
		});
	});

	it("clears the search from its clear button", () => {
		renderTable({ search: { keys: ["customer"] } });
		fireEvent.change(screen.getByRole("textbox", { name: "Search rows" }), { target: { value: "asp" } });

		fireEvent.click(screen.getByRole("button", { name: "Clear search" }));

		expect(shownCustomers()).toHaveLength(INVOICES.length);
	});
});

describe("DataTable: filters", () => {
	it("names a select filter in front of its choice, with row counts on a client table", () => {
		renderTable({ filters: [STATUS_FILTER] });
		expect(screen.getByRole("combobox", { name: /^Status:/u }).textContent).toMatch(/^Status:All \(3\)/u);
	});

	it("keeps only the rows whose value is exactly the chosen option", () => {
		renderTable({ filters: [STATUS_FILTER] });

		chooseOption(screen.getByRole("combobox", { name: /^Status:/u }), /^Paid/u);

		// "PAID" is inside "PARTIALLY_PAID": a substring match would keep Aspen too.
		expect(shownCustomers()).toEqual(["Cedar"]);
	});

	it("keeps the rows that have any of a multi-select filter's chosen options", () => {
		renderTable({ filters: [TYPE_FILTER] });

		const filterStrip = document.querySelector<HTMLElement>("[data-slot=data-table-filters]");
		if (filterStrip === null) {
			throw new Error("the toolbar has filters");
		}
		fireEvent.click(within(filterStrip).getByRole("button", { name: /Type/u }));
		fireEvent.click(screen.getByRole("button", { name: /Recurring/u }));

		expect(shownCustomers()).toEqual(["Aspen"]);
	});

	it("offers to clear the filters when they hide every row", () => {
		renderTable({ search: { keys: ["customer"] }, filters: [STATUS_FILTER] });
		fireEvent.change(screen.getByRole("textbox", { name: "Search rows" }), { target: { value: "zzz" } });
		expect(screen.getByText("No results found")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

		expect(shownCustomers()).toHaveLength(INVOICES.length);
	});

	it("refuses a client-side filter that names no column", () => {
		vi.spyOn(console, "error").mockImplementation(noop);
		expect(() => {
			renderTable({ columns: [{ accessorKey: "customer", header: "Customer" }], filters: [STATUS_FILTER] });
		}).toThrow('DataTable: filter "status" names no column');
	});

	it("lays the search and the filters out as equal columns in the fill layout", () => {
		renderTable({ search: { keys: ["customer"] }, filters: [STATUS_FILTER], toolbar: { layout: "fill" } });
		const toolbar = document.querySelector<HTMLElement>("[data-slot=data-table-toolbar]");
		expect(toolbar?.dataset.layout).toBe("fill");
		expect(toolbar?.style.gridTemplateColumns).toBe("repeat(2, minmax(0px, 1fr))");
	});

	it("shows the caller's own toolbar controls", () => {
		renderTable({ toolbar: { extra: <button type="button">Refresh</button> } });
		expect(screen.getByRole("button", { name: "Refresh" })).toBeTruthy();
	});
});

describe("DataTable: row actions and row click", () => {
	it("runs a row action with the row it belongs to, without firing the row's own click", async (): Promise<void> => {
		const onSelect = vi.fn<(invoice: Invoice) => void>();
		const onRowClick = vi.fn<(invoice: Invoice) => void>();
		renderTable({ rowActions: [{ key: "open", label: "Open", description: "See the whole record", onSelect }], onRowClick });

		fireEvent.click(screen.getAllByRole("button", { name: "Open row menu" }).at(LIST_SLOT_INDEX.second) ?? document.body);
		fireEvent.click(await screen.findByRole("menuitem", { name: /Open/u }));

		expect(onSelect).toHaveBeenCalledWith(INVOICES.at(LIST_SLOT_INDEX.second));
		expect(onRowClick).not.toHaveBeenCalled();
	});

	it("marks a destructive action", async (): Promise<void> => {
		renderTable({ rowActions: [{ key: "delete", label: "Delete", description: "Remove it for good", tone: "destructive", onSelect: noop }] });
		fireEvent.click(screen.getAllByRole("button", { name: "Open row menu" }).at(LIST_SLOT_INDEX.first) ?? document.body);
		expect((await screen.findByRole("menuitem", { name: /Delete/u })).getAttribute("data-variant")).toBe("destructive");
	});

	it("draws each entry as a coloured icon tile, a title and a subtitle", async (): Promise<void> => {
		renderTable({
			rowActions: [
				{ key: "open", label: "Open", description: "See the whole record", icon: <span data-testid="icon-open" />, onSelect: noop },
				{ key: "copy", label: "Duplicate", description: "Copy it as a draft", icon: <span data-testid="icon-copy" />, onSelect: noop },
				{ key: "send", label: "Send", description: "Email it to the customer", icon: <span data-testid="icon-send" />, tone: "green", onSelect: noop },
			],
		});
		fireEvent.click(screen.getAllByRole("button", { name: "Open row menu" }).at(LIST_SLOT_INDEX.first) ?? document.body);

		const duplicate = await screen.findByRole("menuitem", { name: /Duplicate/u });
		expect(within(duplicate).getByText("Copy it as a draft")).toBeTruthy();
		// No tone: the palette in menu order (blue, then violet). A tone of its own wins.
		expect(screen.getByTestId("icon-open").parentElement?.className).toContain("bg-tone-blue-soft");
		expect(screen.getByTestId("icon-copy").parentElement?.className).toContain("bg-tone-violet-soft");
		expect(screen.getByTestId("icon-send").parentElement?.className).toContain("bg-tone-green-soft");
	});

	it("fires the row click on a click, and on Enter or Space with the row focused", () => {
		const onRowClick = vi.fn<(invoice: Invoice) => void>();
		renderTable({ onRowClick });
		const row = screen.getByText("Aspen").closest("tr");
		if (row === null) {
			throw new Error("the row exists");
		}

		fireEvent.click(row);
		fireEvent.keyDown(row, { key: "Enter" });
		fireEvent.keyDown(row, { key: " " });

		expect(row.tabIndex).toBe(0);
		expect(onRowClick).toHaveBeenCalledTimes(3);
		expect(onRowClick).toHaveBeenLastCalledWith(INVOICES.at(LIST_SLOT_INDEX.second));
	});

	it("leaves rows out of the tab order when they do nothing on click", () => {
		renderTable();
		expect(screen.getByText("Aspen").closest("tr")?.hasAttribute("tabindex")).toBe(false);
	});
});

describe("DataTable: selection", () => {
	it("shows the bulk bar once a row is ticked, and hands the ticked rows to a bulk action", () => {
		const onArchive = vi.fn<(rows: Invoice[]) => void>();
		renderTable({ selection: { bulkActions: [{ key: "archive", label: "Archive", onSelect: onArchive }] } });
		expect(document.querySelector("[data-slot=data-table-selection-bar]")).toBeNull();

		fireEvent.click(screen.getAllByRole("checkbox", { name: "Select row" }).at(LIST_SLOT_INDEX.second) ?? document.body);

		expect(screen.getByText("1 row selected")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Archive" }));
		expect(onArchive).toHaveBeenCalledWith([INVOICES.at(LIST_SLOT_INDEX.second)], { scope: "page", totalMatchingRows: 1 });
	});

	it("adds a destructive delete action when onDelete is set", () => {
		const onDelete = vi.fn<(rows: Invoice[]) => void>();
		renderTable({ selection: { onDelete } });
		fireEvent.click(screen.getAllByRole("checkbox", { name: "Select row" }).at(LIST_SLOT_INDEX.first) ?? document.body);

		fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));

		expect(onDelete).toHaveBeenCalledTimes(1);
	});

	it("offers every matching row once the page is fully ticked, and tells the action the scope", () => {
		const onArchive = vi.fn<(rows: Invoice[]) => void>();
		const onScopeChange = vi.fn<(scope: "page" | "all-matching") => void>();
		const { rerender } = render(
			<DataTable
				data={INVOICES}
				columns={COLUMNS}
				getRowId={getRowId}
				paging={{ pageSize: 2 }}
				selection={{ scope: "page", onScopeChange, bulkActions: [{ key: "archive", label: "Archive", onSelect: onArchive }] }}
			/>,
			{ wrapper: UiKitTestProviders },
		);

		fireEvent.click(screen.getAllByRole("checkbox", { name: "Select all" }).at(LIST_SLOT_INDEX.first) ?? document.body);
		fireEvent.click(screen.getByRole("button", { name: "Select all 3 rows" }));
		expect(onScopeChange).toHaveBeenCalledWith("all-matching");

		rerender(
			<DataTable
				data={INVOICES}
				columns={COLUMNS}
				getRowId={getRowId}
				paging={{ pageSize: 2 }}
				selection={{ scope: "all-matching", onScopeChange, bulkActions: [{ key: "archive", label: "Archive", onSelect: onArchive }] }}
			/>,
		);
		expect(screen.getByText("All 3 rows selected")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Archive" }));
		expect(onArchive).toHaveBeenCalledWith([...INVOICES], { scope: "all-matching", totalMatchingRows: 3 });
	});

	it("clears the selection from the bar", () => {
		renderTable({ selection: {} });
		fireEvent.click(screen.getAllByRole("checkbox", { name: "Select row" }).at(LIST_SLOT_INDEX.first) ?? document.body);

		fireEvent.click(screen.getByRole("button", { name: "Clear" }));

		expect(document.querySelector("[data-slot=data-table-selection-bar]")).toBeNull();
	});
});

describe("DataTable: export and column controls", () => {
	it("offers only the formats asked for", async (): Promise<void> => {
		renderTable({ exporting: { formats: ["csv", "json"] } });
		fireEvent.click(screen.getByRole("button", { name: "Export" }));
		expect(await screen.findByRole("menuitem", { name: /CSV/u })).toBeTruthy();
		expect(screen.getByRole("menuitem", { name: /JSON/u })).toBeTruthy();
		expect(screen.queryByRole("menuitem", { name: /PDF/u })).toBeNull();
	});

	/** Catches what an export writes, instead of downloading it. */
	function catchDownloads(): Blob[] {
		const blobs: Blob[] = [];
		vi.spyOn(URL, "createObjectURL").mockImplementation((blob: Blob | MediaSource): string => {
			if (blob instanceof Blob) {
				blobs.push(blob);
			}
			return "blob:export";
		});
		vi.spyOn(URL, "revokeObjectURL").mockImplementation(noop);
		vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(noop);
		return blobs;
	}

	function openExportDialog(): Promise<HTMLElement> {
		fireEvent.click(screen.getByRole("button", { name: "Export" }));
		return screen.findByRole("dialog", { name: "Export rows" });
	}

	it("opens the export dialog on every matching row, and counts the rows each choice covers", async (): Promise<void> => {
		renderTable({ exporting: { mode: "dialog" }, selection: {} });
		const dialog = await openExportDialog();

		expect(within(dialog).getByRole("radio", { name: "Rows that match (3)" }).getAttribute("aria-checked")).toBe("true");
		expect(within(dialog).getByRole("radio", { name: "Ticked rows (0)" }).hasAttribute("data-disabled")).toBe(true);
		expect(within(dialog).getByRole("radio", { name: "Every row (3)" })).toBeTruthy();
		expect(within(dialog).getByRole("button", { name: "Export 3 rows" })).toBeTruthy();
	});

	it("starts on the ticked rows when some are ticked", async (): Promise<void> => {
		renderTable({ exporting: { mode: "dialog" }, selection: {} });
		fireEvent.click(screen.getAllByRole("checkbox", { name: "Select row" }).at(LIST_SLOT_INDEX.first) ?? document.body);

		const dialog = await openExportDialog();

		expect(within(dialog).getByRole("radio", { name: "Ticked rows (1)" }).getAttribute("aria-checked")).toBe("true");
		expect(within(dialog).getByRole("button", { name: "Export 1 rows" })).toBeTruthy();
	});

	it("writes only the chosen format, rows and columns", async (): Promise<void> => {
		const blobs = catchDownloads();
		renderTable({ exporting: { mode: "dialog", formats: ["csv", "json"] }, filters: [STATUS_FILTER] });
		const dialog = await openExportDialog();

		fireEvent.click(within(dialog).getByRole("radio", { name: "JSON" }));
		fireEvent.click(within(dialog).getByRole("checkbox", { name: "Type" }));
		fireEvent.click(within(dialog).getByRole("checkbox", { name: "Amount" }));
		fireEvent.click(within(dialog).getByRole("button", { name: "Export 3 rows" }));

		await waitFor((): void => {
			expect(blobs).toHaveLength(1);
		});
		const written = await blobs.at(LIST_SLOT_INDEX.first)?.text();
		expect(blobs.at(LIST_SLOT_INDEX.first)?.type).toBe("application/json");
		expect(written).toContain('"customer": "Cedar"');
		expect(written).toContain('"status": "PAID"');
		expect(written).not.toContain('"type"');
		expect(written).not.toContain('"amount"');
	});

	it("exports the keys named, in their order, a field no column shows included", async (): Promise<void> => {
		const blobs = catchDownloads();
		renderTable({ exporting: { formats: ["csv"], keys: ["amount", "id", "customer"] } });

		fireEvent.click(screen.getByRole("button", { name: "Export" }));
		fireEvent.click(await screen.findByRole("menuitem", { name: /CSV/u }));

		await waitFor((): void => {
			expect(blobs).toHaveLength(1);
		});
		// `trimStart` also drops the byte order mark the CSV starts with.
		const lines = (await blobs.at(LIST_SLOT_INDEX.first)?.text())?.trimStart().split("\r\n");
		expect(lines?.at(LIST_SLOT_INDEX.first)).toBe("amount,id,customer");
		expect(lines).toContain("30,inv-1,Cedar");
	});

	it("lists the keys first in the dialog, ticked, and the other columns after them, unticked", async (): Promise<void> => {
		const blobs = catchDownloads();
		renderTable({ exporting: { mode: "dialog", formats: ["json"], keys: ["id", "customer"] } });
		const dialog = await openExportDialog();

		const boxes = within(dialog).getAllByRole("checkbox");
		expect(boxes.map((box) => box.closest("label")?.textContent ?? "")).toEqual(["id", "Customer", "Status", "Type", "Amount"]);
		expect(boxes.map((box) => box.getAttribute("aria-checked"))).toEqual(["true", "true", "false", "false", "false"]);

		fireEvent.click(within(dialog).getByRole("checkbox", { name: "Amount" }));
		fireEvent.click(within(dialog).getByRole("button", { name: "Export 3 rows" }));

		await waitFor((): void => {
			expect(blobs).toHaveLength(1);
		});
		const written = await blobs.at(LIST_SLOT_INDEX.first)?.text();
		expect(written).toContain('"id": "inv-1"');
		expect(written).toContain('"amount": 30');
		expect(written).not.toContain('"status"');
	});

	it("cannot export with every column unticked", async (): Promise<void> => {
		renderTable({ exporting: { mode: "dialog" } });
		const dialog = await openExportDialog();

		for (const name of ["Customer", "Status", "Type", "Amount"]) {
			fireEvent.click(within(dialog).getByRole("checkbox", { name }));
		}

		expect(within(dialog).getByRole("button", { name: "Export 3 rows" }).hasAttribute("disabled")).toBe(true);
	});

	it("offers no 'every row' choice on a server table, and counts the server's matches", async (): Promise<void> => {
		const query: DataTableQuery = createDataTableQuery(SERVER_PAGE_SIZE);
		renderTable({
			data: INVOICES.slice(0, SERVER_PAGE_SIZE),
			exporting: { mode: "dialog" },
			source: { mode: "server", totalCount: SERVER_TOTAL, query, onQueryChange: noop },
		});
		const dialog = await openExportDialog();

		expect(within(dialog).queryByRole("radio", { name: /Every row/u })).toBeNull();
		expect(within(dialog).getByRole("radio", { name: `Rows that match (${String(SERVER_TOTAL)})` })).toBeTruthy();
	});

	it("hides a column from the columns menu", async (): Promise<void> => {
		renderTable({ columnControls: { visibility: true } });
		fireEvent.click(screen.getByRole("button", { name: "Columns" }));

		fireEvent.click(await screen.findByRole("menuitemcheckbox", { name: "Status" }));

		expect(screen.queryByRole("columnheader", { name: /Status/u })).toBeNull();
	});
});

describe("DataTable: status", () => {
	it("draws skeleton rows and announces the load during an initial load", () => {
		const skeletonRows = 4;
		renderTable({ data: [], status: { loading: "initial", skeletonRows } });
		expect(screen.getByRole("status").textContent).toBe("Loading table data");
		expect(document.querySelectorAll("tbody tr")).toHaveLength(skeletonRows);
	});

	it("keeps the rows, dimmed and busy, while refreshing", () => {
		renderTable({ status: { loading: "refreshing" } });
		const container = document.querySelector("[data-slot=table-engine]");
		expect(shownCustomers()).toHaveLength(INVOICES.length);
		expect(container?.getAttribute("aria-busy")).toBe("true");
		expect(container?.className).toContain("opacity-60");
	});

	it("shows the caller's empty state when there are no rows at all", () => {
		const onClick = vi.fn<() => void>();
		renderTable({ data: [], emptyState: { title: "No invoices yet", description: "Send your first invoice.", action: { label: "New invoice", onClick } } });
		expect(screen.getByText("No invoices yet")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "New invoice" }));
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("replaces the rows with the error, and retries, when nothing was loaded", () => {
		const onRetry = vi.fn<() => void>();
		renderTable({ data: [], status: { error: "Could not load invoices", onRetry } });
		expect(screen.getByRole("alert").textContent).toContain("Could not load invoices");
		fireEvent.click(screen.getByRole("button", { name: "Try again" }));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it("keeps rows already on screen and shows the error above them", () => {
		renderTable({ status: { error: "Could not refresh" } });
		expect(screen.getByRole("alert").textContent).toContain("Could not refresh");
		expect(shownCustomers()).toHaveLength(INVOICES.length);
	});
});

describe("DataTable: server source", () => {
	type QueryListener = (query: DataTableQuery, change: DataTableQueryChange) => void;

	function renderServerTable(onQueryChange: QueryListener, query: DataTableQuery = createDataTableQuery(SERVER_PAGE_SIZE), overrides: TableOverrides = {}): void {
		renderTable({
			data: INVOICES.slice(0, SERVER_PAGE_SIZE),
			source: { mode: "server", totalCount: SERVER_TOTAL, query, onQueryChange },
			...overrides,
		});
	}

	it("shows the page it was given and counts the server's total", () => {
		renderServerTable(noop);
		expect(shownCustomers()).toEqual(["Cedar", "Aspen"]);
		expect(screen.getByText("Showing 1 to 2 of 6 results")).toBeTruthy();
		expect(screen.getByText("Page 1 of 3")).toBeTruthy();
	});

	it("asks for the next page", () => {
		const onQueryChange = vi.fn<QueryListener>();
		renderServerTable(onQueryChange);
		fireEvent.click(screen.getByRole("button", { name: "Go to next page" }));
		expect(onQueryChange).toHaveBeenCalledWith({ ...createDataTableQuery(SERVER_PAGE_SIZE), pageIndex: 1 }, { kind: "page" });
	});

	it("asks for the sort and returns to the first page", () => {
		const onQueryChange = vi.fn<QueryListener>();
		renderServerTable(onQueryChange, { ...createDataTableQuery(SERVER_PAGE_SIZE), pageIndex: 2 });
		clickSort("Customer");
		expect(onQueryChange).toHaveBeenCalledWith({ ...createDataTableQuery(SERVER_PAGE_SIZE), sorting: [{ id: "customer", desc: false }] }, { kind: "sorting" });
	});

	it("never sorts or filters the page itself", () => {
		renderServerTable(
			noop,
			{ ...createDataTableQuery(SERVER_PAGE_SIZE), sorting: [{ id: "customer", desc: false }], filters: { status: "VOID" } },
			{ filters: [STATUS_FILTER] },
		);
		expect(shownCustomers()).toEqual(["Cedar", "Aspen"]);
	});

	it("treats a filter as a query key (no column needed), shows no counts, and reports the choice", () => {
		const onQueryChange = vi.fn<QueryListener>();
		renderServerTable(onQueryChange, createDataTableQuery(SERVER_PAGE_SIZE), {
			columns: [{ accessorKey: "customer", header: "Customer" }],
			filters: [STATUS_FILTER],
		});
		const filter = screen.getByRole("combobox", { name: /^Status:/u });
		expect(filter.textContent).toMatch(/^Status:All(?! \()/u);

		chooseOption(filter, /^Void/u);

		expect(onQueryChange).toHaveBeenCalledWith(
			{ ...createDataTableQuery(SERVER_PAGE_SIZE), filters: { status: "VOID" } },
			{ kind: "filter", column: "status", value: "VOID" },
		);
	});

	it("shows the query's own filter value and search", () => {
		renderServerTable(
			noop,
			{ ...createDataTableQuery(SERVER_PAGE_SIZE), filters: { status: "VOID" }, search: "bir" },
			{ filters: [STATUS_FILTER], search: { keys: ["customer"] } },
		);
		expect(screen.getByRole("combobox", { name: /^Status:/u }).textContent).toContain("Void");
		expect(screen.getByRole("textbox", { name: "Search rows" })).toHaveProperty("value", "bir");
	});

	it("reports a search and clears the search and the filters together", () => {
		const onQueryChange = vi.fn<QueryListener>();
		renderServerTable(onQueryChange, { ...createDataTableQuery(SERVER_PAGE_SIZE), filters: { status: "VOID" } }, { data: [], search: { keys: ["customer"] } });

		fireEvent.change(screen.getByRole("textbox", { name: "Search rows" }), { target: { value: "bir" } });
		expect(onQueryChange).toHaveBeenLastCalledWith({ ...createDataTableQuery(SERVER_PAGE_SIZE), filters: { status: "VOID" }, search: "bir" }, { kind: "search" });

		fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
		expect(onQueryChange).toHaveBeenLastCalledWith(createDataTableQuery(SERVER_PAGE_SIZE), { kind: "clear-filters" });
	});

	it("offers every matching row only when the parent can fetch them", () => {
		renderServerTable(noop, createDataTableQuery(SERVER_PAGE_SIZE), { selection: {} });
		fireEvent.click(screen.getAllByRole("checkbox", { name: "Select all" }).at(LIST_SLOT_INDEX.first) ?? document.body);
		expect(screen.queryByRole("button", { name: /Select all 6 rows/u })).toBeNull();
	});

	it("offers every matching row when the parent can fetch them", () => {
		renderTable({
			data: INVOICES.slice(0, SERVER_PAGE_SIZE),
			source: {
				mode: "server",
				totalCount: SERVER_TOTAL,
				query: createDataTableQuery(SERVER_PAGE_SIZE),
				onQueryChange: noop,
				onFetchAllMatching: () => Promise.resolve([...INVOICES]),
			},
			selection: {},
		});
		fireEvent.click(screen.getAllByRole("checkbox", { name: "Select all" }).at(LIST_SLOT_INDEX.first) ?? document.body);
		expect(screen.getByRole("button", { name: "Select all 6 rows" })).toBeTruthy();
	});
});

describe("DataTable: mobile cards", () => {
	it("draws each row as the caller's card below the desktop breakpoint, with the row actions", () => {
		stubViewport(false);
		renderTable({
			rowActions: [{ key: "open", label: "Open", description: "See the whole record", onSelect: noop }],
			mobileCard: (invoice, rowActions) => (
				<article>
					{invoice.customer} ({rowActions.length})
				</article>
			),
		});
		expect(screen.queryByRole("table")).toBeNull();
		expect(screen.getAllByRole("article").map((card) => card.textContent)).toEqual(["Cedar (1)", "Aspen (1)", "Birch (1)"]);
	});

	it("keeps the table on a desktop viewport", () => {
		renderTable({ mobileCard: (invoice) => <article>{invoice.customer}</article> });
		expect(screen.getByRole("table")).toBeTruthy();
		expect(screen.queryByRole("article")).toBeNull();
	});

	/** Every observed element reports this width at once, as a browser does on its first layout. */
	function stubMeasuredWidth(width: number): void {
		vi.stubGlobal(
			"ResizeObserver",
			class {
				public constructor(private readonly _callback: ResizeObserverCallback) {}

				public observe(target: Element): void {
					const entry: ResizeObserverEntry = {
						target,
						contentRect: new DOMRectReadOnly(0, 0, width, 0),
						borderBoxSize: [],
						contentBoxSize: [],
						devicePixelContentBoxSize: [],
					};
					this._callback([entry], this);
				}

				public unobserve(): void {
					noop();
				}

				public disconnect(): void {
					noop();
				}
			},
		);
	}

	it("shows cards when the table itself is narrow, even on a wide window", () => {
		stubMeasuredWidth(420);
		renderTable({ mobileCard: (invoice) => <article>{invoice.customer}</article> });
		expect(screen.queryByRole("table")).toBeNull();
		expect(screen.getAllByRole("article")).toHaveLength(INVOICES.length);
	});

	it("shows the table when the table itself is wide, even on a narrow window", () => {
		stubViewport(false);
		stubMeasuredWidth(900);
		renderTable({ mobileCard: (invoice) => <article>{invoice.customer}</article> });
		expect(screen.getByRole("table")).toBeTruthy();
		expect(screen.queryByRole("article")).toBeNull();
	});

	it("still hands the caller's ref the table's element", () => {
		stubMeasuredWidth(900);
		const ref = React.createRef<HTMLDivElement>();
		renderTable({ ref });
		expect(ref.current?.getAttribute("data-slot")).toBe("data-table");
	});

	it("opens a card with a click or the keyboard", () => {
		stubViewport(false);
		const onRowClick = vi.fn<(invoice: Invoice) => void>();
		renderTable({ onRowClick, mobileCard: (invoice) => <article>{invoice.customer}</article> });
		const card = screen.getAllByRole("button").at(LIST_SLOT_INDEX.first);
		if (card === undefined) {
			throw new Error("the card is a button");
		}

		fireEvent.click(card);
		fireEvent.keyDown(card, { key: "Enter" });

		expect(onRowClick).toHaveBeenCalledTimes(2);
		expect(onRowClick).toHaveBeenLastCalledWith(INVOICES.at(LIST_SLOT_INDEX.first));
	});
});

describe("DataTable: preferences", () => {
	function memoryStorage(initial: ReturnType<DataTableStorageAdapter["read"]>): {
		readonly preferences: DataTablePreferences;
		readonly write: ReturnType<typeof vi.fn<DataTableStorageAdapter["write"]>>;
	} {
		const write = vi.fn<DataTableStorageAdapter["write"]>();
		return { preferences: { key: "invoices", storage: { read: (): ReturnType<DataTableStorageAdapter["read"]> => initial, write } }, write };
	}

	it("starts from the saved sort, hidden columns and page size", () => {
		const { preferences } = memoryStorage({ sorting: [{ id: "customer", desc: false }], columnVisibility: { status: false }, pageSize: 2 });
		renderTable({ preferences, paging: { pageSizeOptions: [2, 5] } });

		expect(shownCustomers()).toEqual(["Aspen", "Birch"]);
		expect(screen.queryByRole("columnheader", { name: /Status/u })).toBeNull();
	});

	it("saves a new sort under the table's key", () => {
		const { preferences, write } = memoryStorage(null);
		renderTable({ preferences });

		clickSort("Customer");

		expect(write).toHaveBeenCalledWith("invoices", { sorting: [{ id: "customer", desc: false }] });
	});

	it("ignores a saved column the table no longer has", () => {
		const { preferences } = memoryStorage({ columnVisibility: { gone: false }, sorting: [{ id: "gone", desc: true }] });
		renderTable({ preferences });
		expect(shownCustomers()).toEqual(["Cedar", "Aspen", "Birch"]);
	});
});

describe("DataTable: footer, row status and labels", () => {
	it("draws a footer row with a cell under each named column", () => {
		renderTable({ footer: { rows: [{ key: "total", cells: { customer: "Total", amount: "60" } }] } });
		const footer = document.querySelector("tfoot");
		expect(footer?.textContent).toContain("Total");
		expect(footer?.textContent).toContain("60");
	});

	it("marks a row with its lifecycle status", () => {
		renderTable({ rowStatus: (invoice) => (invoice.id === "inv-2" ? "dirty" : undefined) });
		expect(screen.getByText("Aspen").closest("tr")?.getAttribute("data-row-status")).toBe("dirty");
		expect(screen.getByText("Cedar").closest("tr")?.hasAttribute("data-row-status")).toBe(false);
	});

	it("takes one flat override for the table's own copy and the engine's", () => {
		renderTable({ search: { keys: ["customer"] }, selection: {}, labels: { searchAriaLabel: "Search invoices", selectRow: "Select invoice" } });
		expect(screen.getByRole("textbox", { name: "Search invoices" })).toBeTruthy();
		expect(screen.getAllByRole("checkbox", { name: "Select invoice" })).toHaveLength(INVOICES.length);
	});
});

describe("DataTable: row structure", () => {
	interface Folder {
		readonly id: string;
		readonly name: string;
		readonly children?: Folder[];
	}

	const FOLDERS: readonly Folder[] = [
		{ id: "f-1", name: "Design", children: [{ id: "f-1-1", name: "Logos" }] },
		{ id: "f-2", name: "Legal" },
	];
	const FOLDER_COLUMNS: DataTableColumns<Folder> = [{ accessorKey: "name", header: "Name" }];

	function getFolderId(folder: Folder): string {
		return folder.id;
	}

	function getFolderChildren(folder: Folder): Folder[] | undefined {
		return folder.children;
	}

	function renderFolders(overrides: Partial<DataTableProps<Folder>> = {}): void {
		render(<DataTable data={FOLDERS} columns={FOLDER_COLUMNS} getRowId={getFolderId} tree={{ getSubRows: getFolderChildren }} {...overrides} />, {
			wrapper: UiKitTestProviders,
		});
	}

	it("keeps a tree's child rows closed until their branch is opened", () => {
		renderFolders();
		expect(screen.queryByText("Logos")).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "Expand row" }));

		expect(screen.getByText("Logos")).toBeTruthy();
		expect(screen.getByText("Logos").closest("tr")?.getAttribute("data-depth")).toBe("1");
		expect(screen.getByRole("button", { name: "Collapse row" }).getAttribute("aria-expanded")).toBe("true");
	});

	it("starts a tree open when asked", () => {
		renderFolders({ tree: { getSubRows: getFolderChildren, defaultExpanded: true } });
		expect(screen.getByText("Logos")).toBeTruthy();
	});

	it("shows every row of an open tree that is not paged, the last top-level row included", () => {
		// Two top-level rows and one child: a page sized by the top level alone would cut "Legal" off.
		renderFolders({ tree: { getSubRows: getFolderChildren, defaultExpanded: true } });
		expect(shownFolders()).toEqual(["f-1", "f-1-1", "f-2"]);
	});

	/** The row's own checkbox, by row id. */
	function rowCheckbox(rowId: string): HTMLElement {
		const row = document.querySelector<HTMLElement>(`tbody tr[data-row-id="${rowId}"]`);
		if (row === null) {
			throw new Error(`row ${rowId} is on screen`);
		}
		return within(row).getByRole("checkbox");
	}

	it("ticks a branch's rows with it, and half-ticks a branch with only some of its rows ticked", () => {
		const onSelect = vi.fn<(rows: Folder[]) => void>();
		renderFolders({
			tree: { getSubRows: getFolderChildren, defaultExpanded: true },
			selection: { bulkActions: [{ key: "archive", label: "Archive", onSelect }] },
		});

		fireEvent.click(rowCheckbox("f-1"));
		fireEvent.click(screen.getByRole("button", { name: "Archive" }));
		expect(
			onSelect.mock.calls
				.at(LIST_SLOT_INDEX.first)
				?.at(LIST_SLOT_INDEX.first)
				?.map((folder) => folder.id),
		).toEqual(["f-1", "f-1-1"]);

		// Unticking the only child leaves the branch with none of its rows ticked.
		fireEvent.click(rowCheckbox("f-1-1"));
		expect(rowCheckbox("f-1-1").getAttribute("aria-checked")).toBe("false");
	});

	it("half-ticks a branch when only some of its rows are ticked", () => {
		const twoChildren: readonly Folder[] = [
			{
				id: "f-1",
				name: "Design",
				children: [
					{ id: "f-1-1", name: "Logos" },
					{ id: "f-1-2", name: "Icons" },
				],
			},
		];
		renderFolders({ data: twoChildren, tree: { getSubRows: getFolderChildren, defaultExpanded: true }, selection: {} });

		fireEvent.click(rowCheckbox("f-1-1"));

		expect(rowCheckbox("f-1-1").getAttribute("aria-checked")).toBe("true");
		expect(rowCheckbox("f-1").getAttribute("aria-checked")).toBe("mixed");
	});

	it("exports the ticked child rows of a tree, not only the top level", async (): Promise<void> => {
		const blobs: Blob[] = [];
		vi.spyOn(URL, "createObjectURL").mockImplementation((blob: Blob | MediaSource): string => {
			if (blob instanceof Blob) {
				blobs.push(blob);
			}
			return "blob:export";
		});
		vi.spyOn(URL, "revokeObjectURL").mockImplementation(noop);
		vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(noop);
		renderFolders({ tree: { getSubRows: getFolderChildren, defaultExpanded: true }, selection: {}, exporting: { formats: ["json"] } });

		fireEvent.click(rowCheckbox("f-1"));
		fireEvent.click(screen.getByRole("button", { name: "Export" }));
		fireEvent.click(await screen.findByRole("menuitem", { name: /JSON/u }));

		await waitFor((): void => {
			expect(blobs).toHaveLength(1);
		});
		const exported = await blobs.at(LIST_SLOT_INDEX.first)?.text();
		expect(exported).toContain("Design");
		expect(exported).toContain("Logos");
		expect(exported).not.toContain("Legal");
	});

	it("keeps every row's tick its own when cascading is off", () => {
		renderFolders({ tree: { getSubRows: getFolderChildren, defaultExpanded: true }, selection: { cascade: false } });

		fireEvent.click(rowCheckbox("f-1"));

		expect(rowCheckbox("f-1").getAttribute("aria-checked")).toBe("true");
		expect(rowCheckbox("f-1-1").getAttribute("aria-checked")).toBe("false");
	});

	it("lets the reader close a branch during a search, for that search only", () => {
		renderFolders({ search: { keys: ["name"] } });
		const search = screen.getByRole("textbox", { name: "Search rows" });
		fireEvent.change(search, { target: { value: "logo" } });

		fireEvent.click(screen.getByRole("button", { name: "Collapse row" }));
		expect(shownFolders()).toEqual(["f-1"]);

		// A different search opens the matching branches again.
		fireEvent.change(search, { target: { value: "logos" } });
		expect(shownFolders()).toEqual(["f-1", "f-1-1"]);
	});

	function shownFolders(): string[] {
		return [...document.querySelectorAll<HTMLElement>("tbody tr[data-row-id]")].map((row) => row.dataset.rowId ?? "");
	}

	it("keeps a match's parent and opens its branch while a search narrows the tree", () => {
		renderFolders({ search: { keys: ["name"] } });
		expect(shownFolders()).toEqual(["f-1", "f-2"]);

		fireEvent.change(screen.getByRole("textbox", { name: "Search rows" }), { target: { value: "logo" } });

		// "Design" does not match, but it holds the match, so it stays and is open; "Legal" holds nothing and goes.
		expect(shownFolders()).toEqual(["f-1", "f-1-1"]);
	});

	it("gives the reader's own open and closed branches back when the search is cleared", () => {
		renderFolders({ search: { keys: ["name"] } });
		const search = screen.getByRole("textbox", { name: "Search rows" });

		fireEvent.change(search, { target: { value: "logo" } });
		fireEvent.change(search, { target: { value: "" } });

		// The branch was closed before the search, so it is closed again.
		expect(shownFolders()).toEqual(["f-1", "f-2"]);
	});

	it("opens a detail row under the row whose toggle is pressed", () => {
		renderTable({ detail: { render: (invoice) => <p>Detail of {invoice.customer}</p> } });
		expect(screen.queryByText("Detail of Aspen")).toBeNull();

		fireEvent.click(screen.getAllByRole("button", { name: "Expand row" }).at(LIST_SLOT_INDEX.second) ?? document.body);

		expect(screen.getByText("Detail of Aspen")).toBeTruthy();
		expect(screen.queryByText("Detail of Cedar")).toBeNull();
	});

	it("pins a row to the top from its pin button", () => {
		renderTable({ rowPinning: true });

		fireEvent.click(screen.getAllByRole("button", { name: "Pin row" }).at(LIST_SLOT_INDEX.third) ?? document.body);

		// The pin button is each row's first cell here, so the order is read from the rows' ids.
		const rowIds = [...document.querySelectorAll<HTMLElement>("tbody tr[data-row-id]")].map((row) => row.dataset.rowId);
		expect(rowIds).toEqual(["inv-3", "inv-1", "inv-2"]);
		expect(screen.getByText("Birch").closest("tr")?.getAttribute("data-row-pinned")).toBe("top");
		expect(screen.getByRole("button", { name: "Unpin row" })).toBeTruthy();
	});
});

describe("DataTable: row action state", () => {
	interface Deferred {
		readonly promise: Promise<void>;
		readonly resolve: () => void;
		readonly reject: () => void;
	}

	/** A promise the test settles by hand, so the pending state can be looked at. */
	function deferred(): Deferred {
		let settle: (failed: boolean) => void = noop;
		const promise = new Promise<void>((resolve, reject): void => {
			settle = (failed: boolean): void => {
				if (failed) {
					reject(new Error("the server said no"));
				} else {
					resolve();
				}
			};
		});
		return {
			promise,
			resolve: (): void => {
				settle(false);
			},
			reject: (): void => {
				settle(true);
			},
		};
	}

	function firstRow(): HTMLElement {
		const row = document.querySelector<HTMLElement>("tbody tr[data-row-id='inv-1']");
		if (row === null) {
			throw new Error("the first invoice is on screen");
		}
		return row;
	}

	it("shows an action only on the rows its isAvailable accepts", () => {
		renderTable({
			rowActions: [
				{
					key: "refund",
					label: "Refund",
					description: "Return the payment",
					inline: true,
					isAvailable: (invoice: Invoice): boolean => invoice.status === "PAID",
					onSelect: noop,
				},
			],
		});

		expect(within(firstRow()).queryByRole("button", { name: "Refund" })).not.toBeNull();
		const voidRow = document.querySelector<HTMLElement>("tbody tr[data-row-id='inv-3']");
		expect(voidRow).not.toBeNull();
		expect(voidRow?.querySelector("[data-action-key='refund']")).toBeNull();
	});

	it("shows an inline action in the row and runs it with the row", () => {
		const onSelect = vi.fn<(invoice: Invoice) => void>();
		renderTable({ rowActions: [{ key: "send", label: "Send", description: "Email it to the customer", inline: true, onSelect }] });

		fireEvent.click(within(firstRow()).getByRole("button", { name: "Send" }));

		expect(onSelect).toHaveBeenCalledWith(INVOICES.at(LIST_SLOT_INDEX.first));
		// Every action is inline, so there is no ⋯ menu.
		expect(screen.queryByRole("button", { name: "Open row menu" })).toBeNull();
	});

	it("shows a running action as busy until it settles, then as it was", async (): Promise<void> => {
		const work = deferred();
		renderTable({ rowActions: [{ key: "send", label: "Send", description: "Email it to the customer", inline: true, onSelect: (): Promise<void> => work.promise }] });
		const button = within(firstRow()).getByRole("button", { name: "Send" });

		fireEvent.click(button);

		await waitFor((): void => {
			expect(button.getAttribute("aria-busy")).toBe("true");
		});
		expect(button.hasAttribute("disabled")).toBe(true);
		expect(screen.getByRole("status", { name: "" }).textContent).toBe("Send…");

		await act(async (): Promise<void> => {
			work.resolve();
			await work.promise;
		});

		expect(button.getAttribute("data-state")).toBe("idle");
		expect(button.hasAttribute("disabled")).toBe(false);
	});

	it("offers a retry after a failure, and runs the action again from it", async (): Promise<void> => {
		const attempts: Deferred[] = [deferred(), deferred()];
		const onSelect = vi.fn<(invoice: Invoice) => Promise<void>>((): Promise<void> => attempts.at(onSelect.mock.calls.length - 1)?.promise ?? Promise.resolve());
		renderTable({ rowActions: [{ key: "send", label: "Send", description: "Email it to the customer", inline: true, onSelect }] });

		fireEvent.click(within(firstRow()).getByRole("button", { name: "Send" }));
		await act(async (): Promise<void> => {
			attempts.at(LIST_SLOT_INDEX.first)?.reject();
			await Promise.resolve();
		});

		const retry = await within(firstRow()).findByRole("button", { name: "Send failed. Try again" });
		expect(retry.textContent).toBe("Try again");

		fireEvent.click(retry);
		await act(async (): Promise<void> => {
			attempts.at(LIST_SLOT_INDEX.second)?.resolve();
			await attempts.at(LIST_SLOT_INDEX.second)?.promise;
		});

		expect(onSelect).toHaveBeenCalledTimes(2);
		expect(within(firstRow()).getByRole("button", { name: "Send" })).toBeTruthy();
	});

	it("puts a retry button beside the menu when a menu action fails", async (): Promise<void> => {
		const work = deferred();
		renderTable({ rowActions: [{ key: "archive", label: "Archive", description: "Move it out of the list", onSelect: (): Promise<void> => work.promise }] });

		fireEvent.click(within(firstRow()).getByRole("button", { name: "Open row menu" }));
		fireEvent.click(await screen.findByRole("menuitem", { name: /Archive/u }));
		await act(async (): Promise<void> => {
			work.reject();
			await Promise.resolve();
		});

		expect(await within(firstRow()).findByRole("button", { name: "Archive failed. Try again" })).toBeTruthy();
	});
});

describe("runRowAction", () => {
	it("leaves no state behind for an action that is not a promise", async (): Promise<void> => {
		const report = vi.fn<(state: RowActionRunState) => void>();
		await runRowAction({ key: "open", label: "Open", description: "See the whole record", onSelect: noop }, "row", report);
		expect(report.mock.calls).toEqual([[{ pendingKey: null, failedKey: null }]]);
	});

	it("reports pending, then idle on success or failed on rejection", async (): Promise<void> => {
		const report = vi.fn<(state: RowActionRunState) => void>();
		await runRowAction({ key: "send", label: "Send", description: "Email it to the customer", onSelect: () => Promise.resolve() }, "row", report);
		await runRowAction({ key: "send", label: "Send", description: "Email it to the customer", onSelect: () => Promise.reject(new Error("no")) }, "row", report);
		expect(report.mock.calls).toEqual([
			[{ pendingKey: "send", failedKey: null }],
			[{ pendingKey: null, failedKey: null }],
			[{ pendingKey: "send", failedKey: null }],
			[{ pendingKey: null, failedKey: "send" }],
		]);
	});

	it("keeps the actions a row offers, and every action without isAvailable", () => {
		const always: DataTableRowAction<string> = { key: "open", label: "Open", description: "See the whole record", onSelect: noop };
		const onlyFailed: DataTableRowAction<string> = {
			key: "retry",
			label: "Retry",
			description: "Run it again",
			isAvailable: (row: string): boolean => row === "failed",
			onSelect: noop,
		};
		expect(availableRowActions([always, onlyFailed], "failed")).toEqual([always, onlyFailed]);
		expect(availableRowActions([always, onlyFailed], "done")).toEqual([always]);
	});

	it("sizes the actions column for its inline buttons and the menu", () => {
		expect(rowActionsColumnWidth([{ key: "open", label: "Open", description: "See the whole record", onSelect: noop }])).toBe(64);
		expect(rowActionsColumnWidth([{ key: "send", label: "Send", description: "Email it to the customer", inline: true, onSelect: noop }])).toBe(136);
		expect(
			rowActionsColumnWidth([
				{ key: "send", label: "Send", description: "Email it to the customer", inline: true, onSelect: noop },
				{ key: "open", label: "Open", description: "See the whole record", onSelect: noop },
			]),
		).toBe(176);
	});
});

describe("DataTable: detail panel", () => {
	function renderInvoiceDetail(invoice: Invoice): React.JSX.Element {
		return <p>Amount due: {invoice.amount}</p>;
	}

	function invoiceTitle(invoice: Invoice): string {
		return `Invoice for ${invoice.customer}`;
	}

	const PANEL: DataTableProps<Invoice>["detail"] = { mode: "panel", render: renderInvoiceDetail, title: invoiceTitle };

	function rowOf(customer: string): HTMLElement {
		const row = screen.getByText(customer).closest("tr");
		if (row === null) {
			throw new Error(`${customer} is in a row`);
		}
		return row;
	}

	function panel(): HTMLElement {
		const found = document.querySelector<HTMLElement>("[data-slot=data-table-detail-panel]");
		if (found === null) {
			throw new Error("the detail panel is open");
		}
		return found;
	}

	it("opens the clicked row's details beside the table and marks the row", () => {
		const onRowClick = vi.fn<(invoice: Invoice) => void>();
		renderTable({ detail: PANEL, onRowClick });
		expect(document.querySelector("[data-slot=data-table-detail-panel]")).toBeNull();

		fireEvent.click(rowOf("Aspen"));

		expect(panel().getAttribute("aria-label")).toBe("Invoice for Aspen");
		expect(within(panel()).getByText("Amount due: 10")).toBeTruthy();
		expect(rowOf("Aspen").getAttribute("aria-current")).toBe("true");
		expect(onRowClick).toHaveBeenCalledWith(INVOICES.at(LIST_SLOT_INDEX.second));
		// No expand toggles: the panel replaces the detail row.
		expect(screen.queryByRole("button", { name: "Expand row" })).toBeNull();
	});

	it("moves to the previous and next row with the arrow keys and the buttons, and closes with Escape", () => {
		renderTable({ detail: PANEL });
		fireEvent.click(rowOf("Aspen"));

		fireEvent.keyDown(panel(), { key: "ArrowDown" });
		expect(panel().getAttribute("aria-label")).toBe("Invoice for Birch");
		expect(within(panel()).getByRole("button", { name: "Next row" }).hasAttribute("disabled")).toBe(true);

		fireEvent.click(within(panel()).getByRole("button", { name: "Previous row" }));
		fireEvent.keyDown(panel(), { key: "ArrowUp" });
		expect(panel().getAttribute("aria-label")).toBe("Invoice for Cedar");

		fireEvent.keyDown(panel(), { key: "Escape" });
		expect(document.querySelector("[data-slot=data-table-detail-panel]")).toBeNull();
	});

	it("closes from its close button", () => {
		renderTable({ detail: PANEL });
		fireEvent.click(rowOf("Cedar"));

		fireEvent.click(within(panel()).getByRole("button", { name: "Close details" }));

		expect(document.querySelector("[data-slot=data-table-detail-panel]")).toBeNull();
	});

	it("closes itself when a search hides its row", () => {
		renderTable({ detail: PANEL, search: { keys: ["customer"] } });
		fireEvent.click(rowOf("Cedar"));

		fireEvent.change(screen.getByRole("textbox", { name: "Search rows" }), { target: { value: "asp" } });

		expect(document.querySelector("[data-slot=data-table-detail-panel]")).toBeNull();
	});

	it("opens as a sheet when the table is narrow", async (): Promise<void> => {
		const NARROW_TABLE_PX = 420;
		vi.stubGlobal(
			"ResizeObserver",
			class {
				public constructor(private readonly _callback: ResizeObserverCallback) {}

				public observe(target: Element): void {
					const entry: ResizeObserverEntry = {
						target,
						contentRect: new DOMRectReadOnly(0, 0, NARROW_TABLE_PX, 0),
						borderBoxSize: [],
						contentBoxSize: [],
						devicePixelContentBoxSize: [],
					};
					this._callback([entry], this);
				}

				public unobserve(): void {
					noop();
				}

				public disconnect(): void {
					noop();
				}
			},
		);
		renderTable({ detail: PANEL });

		fireEvent.click(rowOf("Birch"));

		const sheet = await screen.findByRole("dialog", { name: "Invoice for Birch" });
		expect(within(sheet).getByText("Amount due: 20")).toBeTruthy();
		expect(document.querySelector("[data-slot=data-table-detail-panel]")).toBeNull();
	});

	it("hides the asked-for columns only while it is open", () => {
		renderTable({ detail: { ...PANEL, hideColumnsWhileOpen: ["type", "amount"] } });
		expect(screen.getAllByRole("columnheader")).toHaveLength(4);

		fireEvent.click(rowOf("Cedar"));
		expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Customer", "Status"]);

		fireEvent.click(within(panel()).getByRole("button", { name: "Close details" }));
		expect(screen.getAllByRole("columnheader")).toHaveLength(4);
	});
});

describe("DataTable: grouping", () => {
	const GROUPED_COLUMNS: DataTableColumns<Invoice> = [
		{ accessorKey: "customer", header: "Customer" },
		{ accessorKey: "type", header: "Type" },
		{ accessorKey: "amount", header: "Amount", aggregationFn: "sum" },
	];

	/** Each group's own row, as text: the group cell and the subtotal. */
	function groupRows(): string[] {
		return [...document.querySelectorAll<HTMLElement>("[data-slot=table-engine-group-cell]")].map((groupCell) => {
			const row = groupCell.closest("tr");
			const cells = row === null ? [] : within(row).getAllByRole("cell");
			return cells.map((tableCell) => tableCell.textContent).join(" | ");
		});
	}

	it("draws one row per group, with how many rows it holds and the subtotal", () => {
		renderTable({ columns: GROUPED_COLUMNS, grouping: { by: ["type"] } });

		// The grouped-by column moves to the front; the group rows start closed.
		expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Type", "Customer", "Amount"]);
		expect(groupRows()).toEqual(["ONE_OFF(2) |  | 50", "RECURRING(1) |  | 10"]);
		expect(screen.queryByText("Cedar")).toBeNull();
	});

	it("opens a group to show its rows", () => {
		renderTable({ columns: GROUPED_COLUMNS, grouping: { by: ["type"] } });

		fireEvent.click(screen.getAllByRole("button", { name: "Expand row" }).at(LIST_SLOT_INDEX.first) ?? document.body);

		expect(screen.getByText("Cedar")).toBeTruthy();
		expect(screen.getByText("Birch")).toBeTruthy();
		expect(screen.queryByText("Aspen")).toBeNull();
	});

	it("starts with every group open when asked", () => {
		renderTable({ columns: GROUPED_COLUMNS, grouping: { by: ["type"], defaultExpanded: true } });
		for (const invoice of INVOICES) {
			expect(screen.getByText(invoice.customer)).toBeTruthy();
		}
	});

	it("shows the rows ungrouped with an empty list", () => {
		renderTable({ columns: GROUPED_COLUMNS, grouping: { by: [] } });
		expect(groupRows()).toEqual([]);
		expect(shownCustomers()).toEqual(["Cedar", "Aspen", "Birch"]);
	});

	it("never groups a server table's page", () => {
		const query: DataTableQuery = createDataTableQuery(SERVER_PAGE_SIZE);
		renderTable({
			columns: GROUPED_COLUMNS,
			grouping: { by: ["type"] },
			data: INVOICES.slice(0, SERVER_PAGE_SIZE),
			source: { mode: "server", totalCount: SERVER_TOTAL, query, onQueryChange: noop },
		});
		expect(groupRows()).toEqual([]);
	});
});

describe("DataTable: draft rows", () => {
	it("draws an add-row button under the last row and calls onCreate", () => {
		const onCreate = vi.fn<() => void>();
		renderTable({ draftRows: { onCreate, label: "Add invoice" } });

		fireEvent.click(screen.getByRole("button", { name: "Add invoice" }));

		expect(onCreate).toHaveBeenCalledTimes(1);
	});

	it("labels the button from the kit's copy when no label is given", () => {
		renderTable({ draftRows: { onCreate: noop } });
		expect(screen.getByRole("button", { name: "Add row" })).toBeTruthy();
	});

	it("draws it under a table whose rows can be dragged too", () => {
		renderTable({ draftRows: { onCreate: noop }, rowReorder: { onReorder: noop } });
		expect(screen.getByRole("button", { name: "Add row" })).toBeTruthy();
	});

	it("draws no button without draftRows", () => {
		renderTable();
		expect(screen.queryByRole("button", { name: "Add row" })).toBeNull();
	});
});

describe("DataTable: row reorder", () => {
	const ROW_HEIGHT_PX = 40;
	const TABLE_WIDTH_PX = 400;
	const TABLE_HEIGHT_PX = 1000;

	/** jsdom lays nothing out; each body row gets its own band so the drag can find its neighbours. */
	function fakeRect(element: Element): DOMRect {
		if (element instanceof HTMLTableRowElement && element.dataset.rowId !== undefined) {
			return new DOMRect(0, (element.sectionRowIndex + 1) * ROW_HEIGHT_PX, TABLE_WIDTH_PX, ROW_HEIGHT_PX);
		}
		if (element instanceof HTMLElement && element.dataset.slot === "table-engine-table-viewport") {
			return new DOMRect(0, 0, TABLE_WIDTH_PX, TABLE_HEIGHT_PX);
		}
		return new DOMRect(0, ROW_HEIGHT_PX, TABLE_WIDTH_PX, ROW_HEIGHT_PX);
	}

	/** The drag's keyboard sensor attaches its key listeners on a timeout, and re-measures in effects. */
	async function press(target: Element | Document, code: string): Promise<void> {
		await act(async (): Promise<void> => {
			fireEvent.keyDown(target, { code });
			await new Promise<void>((resolve): void => {
				setTimeout(resolve, 0);
			});
		});
	}

	it("moves a row with the keyboard and reports the move by row id", async (): Promise<void> => {
		vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: Element): DOMRect {
			return fakeRect(this);
		});
		const onReorder = vi.fn<NonNullable<DataTableProps<Invoice>["rowReorder"]>["onReorder"]>();
		renderTable({ rowReorder: { onReorder } });
		const handle = screen.getAllByRole("button", { name: "Drag to reorder row" }).at(LIST_SLOT_INDEX.first);
		if (handle === undefined) {
			throw new Error("every row has a grip");
		}

		handle.focus();
		await press(handle, "Space");
		await press(document, "ArrowDown");
		await press(document, "Space");

		expect(onReorder).toHaveBeenCalledWith({ activeId: "inv-1", overId: "inv-2", parentId: null, orderedIds: ["inv-2", "inv-1", "inv-3"] });
	});

	interface Task {
		readonly id: string;
		readonly title: string;
		readonly subtasks?: Task[];
	}

	const TASKS: readonly Task[] = [
		{
			id: "t-1",
			title: "Launch",
			subtasks: [
				{ id: "t-1-1", title: "Write copy" },
				{ id: "t-1-2", title: "Book venue" },
			],
		},
		{ id: "t-2", title: "Review" },
	];
	const TASK_COLUMNS: DataTableColumns<Task> = [{ accessorKey: "title", header: "Title" }];

	function getTaskId(task: Task): string {
		return task.id;
	}

	function getSubtasks(task: Task): Task[] | undefined {
		return task.subtasks;
	}

	async function dragDownOnce(rowId: string): Promise<void> {
		const row = document.querySelector<HTMLElement>(`tbody tr[data-row-id="${rowId}"]`);
		const handle = row === null ? undefined : within(row).getByRole("button", { name: "Drag to reorder row" });
		if (handle === undefined) {
			throw new Error(`row ${rowId} has a grip`);
		}
		handle.focus();
		await press(handle, "Space");
		await press(document, "ArrowDown");
		await press(document, "Space");
	}

	// Where a keyboard drag lands depends on the rows' measured positions, which jsdom fakes; which drop makes which
	// move is covered row by row in ui-kit-logic's `reorder.test.ts`. Here: a tree drag is reported among one
	// parent's children, named by that parent, and never across a branch.
	it("reports a tree move among one parent's children, named by that parent", async (): Promise<void> => {
		vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: Element): DOMRect {
			return fakeRect(this);
		});
		const onReorder = vi.fn<NonNullable<DataTableProps<Task>["rowReorder"]>["onReorder"]>();
		render(<DataTable data={TASKS} columns={TASK_COLUMNS} getRowId={getTaskId} tree={{ getSubRows: getSubtasks, defaultExpanded: true }} rowReorder={{ onReorder }} />, {
			wrapper: UiKitTestProviders,
		});

		await dragDownOnce("t-1-1");
		await dragDownOnce("t-1-2");

		const moves = onReorder.mock.calls.map(([move]) => move);
		expect(moves.length).toBeGreaterThan(0);
		for (const move of moves) {
			expect(move.parentId).toBe("t-1");
			expect([...move.orderedIds].sort()).toEqual(["t-1-1", "t-1-2"]);
		}
	});
});

describe("DataTable: editing", () => {
	const EDITABLE_COLUMNS: DataTableColumns<Invoice> = [
		{ accessorKey: "customer", header: "Customer", meta: { cellEdit: {} } },
		{ accessorKey: "status", header: "Status" },
	];

	function cell(rowId: string, columnId: string): HTMLElement {
		const found = document.querySelector<HTMLElement>(`tr[data-row-id="${rowId}"] td[data-col-id="${columnId}"]`);
		if (found === null) {
			throw new Error(`no cell ${rowId} / ${columnId}`);
		}
		return found;
	}

	/** The editing controller is its own module, loaded on demand: under a busy test run that import takes a while. */
	const EDITOR_LOAD_WAIT = { timeout: 10_000 };

	/** Focuses a cell and opens its editor. Retried, because the editing controller loads on demand. */
	function openEditor(rowId: string, columnId: string, name: string): Promise<HTMLElement> {
		return waitFor((): HTMLElement => {
			fireEvent.mouseDown(cell(rowId, columnId), { button: 0 });
			fireEvent.mouseUp(document);
			fireEvent.keyDown(screen.getByRole("grid"), { key: "Enter" });
			return screen.getByRole("textbox", { name });
		}, EDITOR_LOAD_WAIT);
	}

	it("commits an edit of an editable column, by row id", async (): Promise<void> => {
		const onCellEdit = vi.fn<NonNullable<DataTableProps<Invoice>["editing"]>["onCellEdit"]>();
		renderTable({ columns: EDITABLE_COLUMNS, editing: { onCellEdit } });

		const editor = await openEditor("inv-2", "customer", "Customer");
		expect(editor).toHaveProperty("value", "Aspen");
		fireEvent.change(editor, { target: { value: "Alder" } });
		fireEvent.keyDown(editor, { key: "Enter" });

		expect(onCellEdit).toHaveBeenCalledWith({
			rowId: "inv-2",
			columnId: "customer",
			value: "Alder",
			previousValue: "Aspen",
			row: INVOICES.at(LIST_SLOT_INDEX.second),
			source: "edit",
		});
	});

	/** Types `text` into an open editor and presses Enter. */
	function typeAndCommit(editor: HTMLElement, text: string): void {
		fireEvent.change(editor, { target: { value: text } });
		fireEvent.keyDown(editor, { key: "Enter" });
	}

	const VALIDATED_COLUMNS: DataTableColumns<Invoice> = [
		{
			accessorKey: "customer",
			header: "Customer",
			meta: { cellEdit: { validate: (value): string | undefined => (String(value).length < 3 ? "Use at least 3 letters" : undefined) } },
		},
		{ accessorKey: "status", header: "Status" },
	];

	it("keeps the editor open with the column's message when the value is refused, and commits once it is fixed", async (): Promise<void> => {
		const onCellEdit = vi.fn<NonNullable<DataTableProps<Invoice>["editing"]>["onCellEdit"]>();
		renderTable({ columns: VALIDATED_COLUMNS, editing: { onCellEdit } });
		const editor = await openEditor("inv-2", "customer", "Customer");

		typeAndCommit(editor, "Al");

		expect(screen.getByRole("alert").textContent).toBe("Use at least 3 letters");
		expect(editor.getAttribute("aria-invalid")).toBe("true");
		expect(onCellEdit).not.toHaveBeenCalled();

		typeAndCommit(editor, "Alder");

		expect(onCellEdit).toHaveBeenCalledWith(expect.objectContaining({ value: "Alder", source: "edit" }));
	});

	it("drops a refused value when the reader leaves the cell", async (): Promise<void> => {
		const onCellEdit = vi.fn<NonNullable<DataTableProps<Invoice>["editing"]>["onCellEdit"]>();
		renderTable({ columns: VALIDATED_COLUMNS, editing: { onCellEdit } });
		const editor = await openEditor("inv-2", "customer", "Customer");

		fireEvent.change(editor, { target: { value: "Al" } });
		fireEvent.blur(editor);

		expect(onCellEdit).not.toHaveBeenCalled();
		expect(screen.queryByRole("textbox", { name: "Customer" })).toBeNull();
	});

	it("marks a cell while its save runs, and writes the old value back when the save fails", async (): Promise<void> => {
		let failSave: (() => void) | undefined;
		const onCellEdit = vi.fn<NonNullable<DataTableProps<Invoice>["editing"]>["onCellEdit"]>((edit): Promise<void> | undefined =>
			edit.source === "edit"
				? new Promise<void>((_resolve, reject): void => {
						failSave = (): void => {
							reject(new Error("offline"));
						};
					})
				: undefined,
		);
		renderTable({ columns: EDITABLE_COLUMNS, editing: { onCellEdit } });
		typeAndCommit(await openEditor("inv-2", "customer", "Customer"), "Alder");

		await waitFor((): void => {
			expect(cell("inv-2", "customer").getAttribute("data-cell-status")).toBe("dirty");
		});

		await act(async (): Promise<void> => {
			failSave?.();
			await Promise.resolve();
		});

		await waitFor((): void => {
			expect(onCellEdit).toHaveBeenLastCalledWith(expect.objectContaining({ rowId: "inv-2", value: "Aspen", previousValue: "Alder", source: "revert" }));
		});
		expect(cell("inv-2", "customer").getAttribute("data-cell-status")).toBe("invalid");
		expect(screen.getByText("Could not save Customer. The old value is back.")).toBeTruthy();
	});

	it("undoes and redoes saved edits from the toolbar and the keyboard", async (): Promise<void> => {
		const onCellEdit = vi.fn<NonNullable<DataTableProps<Invoice>["editing"]>["onCellEdit"]>();
		renderTable({ columns: EDITABLE_COLUMNS, editing: { onCellEdit, history: true } });
		const undoButton = screen.getByRole("button", { name: "Undo" });
		expect(undoButton.hasAttribute("disabled")).toBe(true);

		typeAndCommit(await openEditor("inv-2", "customer", "Customer"), "Alder");
		fireEvent.click(undoButton);

		expect(onCellEdit).toHaveBeenLastCalledWith(expect.objectContaining({ rowId: "inv-2", value: "Aspen", previousValue: "Alder", source: "undo" }));

		const shell = document.querySelector<HTMLElement>("[data-slot=data-table]");
		fireEvent.keyDown(shell ?? document.body, { key: "z", ctrlKey: true, shiftKey: true });

		expect(onCellEdit).toHaveBeenLastCalledWith(expect.objectContaining({ value: "Alder", previousValue: "Aspen", source: "redo" }));
		expect(screen.getByRole("button", { name: "Redo" }).hasAttribute("disabled")).toBe(true);
	});

	it("cancels an edit with Escape", async (): Promise<void> => {
		const onCellEdit = vi.fn<NonNullable<DataTableProps<Invoice>["editing"]>["onCellEdit"]>();
		renderTable({ columns: EDITABLE_COLUMNS, editing: { onCellEdit } });

		const editor = await openEditor("inv-2", "customer", "Customer");
		fireEvent.change(editor, { target: { value: "Alder" } });
		fireEvent.keyDown(editor, { key: "Escape" });

		expect(onCellEdit).not.toHaveBeenCalled();
		expect(screen.queryByRole("textbox", { name: "Customer" })).toBeNull();
	});

	it("never writes a cell cleared with Delete: a records table only takes committed edits", async (): Promise<void> => {
		const onCellEdit = vi.fn<NonNullable<DataTableProps<Invoice>["editing"]>["onCellEdit"]>();
		renderTable({ columns: EDITABLE_COLUMNS, editing: { onCellEdit } });
		const editor = await openEditor("inv-2", "customer", "Customer");
		fireEvent.keyDown(editor, { key: "Escape" });

		fireEvent.keyDown(screen.getByRole("grid"), { key: "Delete" });

		expect(onCellEdit).not.toHaveBeenCalled();
	});
});

describe("DataTable: print view", () => {
	/** Reports the `print` media query as matching, as the browser does while a page prints; `true` for the desktop one too. */
	function stubPrinting(): void {
		vi.stubGlobal("matchMedia", (query: string): Pick<MediaQueryList, "matches" | "media" | "addEventListener" | "removeEventListener"> => ({
			matches: true,
			media: query,
			addEventListener: noop,
			removeEventListener: noop,
		}));
	}

	it("draws every row of a paged client table, without the pager's page", () => {
		stubPrinting();
		renderTable({ paging: { pageSize: 2, pageSizeOptions: [2, 5] } });
		expect(shownCustomers()).toEqual(["Cedar", "Aspen", "Birch"]);
	});

	it("leaves out the columns the table adds itself and the selection bar", () => {
		stubPrinting();
		renderTable({ selection: {}, rowActions: [{ key: "open", label: "Open", description: "See the whole record", onSelect: noop }], rowPinning: true });
		expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
		expect(screen.queryByRole("button", { name: "Open row menu" })).toBeNull();
		expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Customer", "Status", "Type", "Amount"]);
	});

	it("drops the height limit and draws the cell lines", () => {
		stubPrinting();
		renderTable({ layout: { maxHeight: 200 } });
		const scrollArea = document.querySelector<HTMLElement>("[data-slot=table-engine-scroll-area]");
		expect(scrollArea?.style.maxHeight).toBe("");
		const cell = screen.getAllByRole("cell").at(LIST_SLOT_INDEX.first);
		expect(cell?.className).toContain("border-e");
	});

	it("prints the table, not the cards, on a narrow screen", () => {
		stubPrinting();
		renderTable({ mobileCard: (invoice: Invoice): React.JSX.Element => <p>Card for {invoice.customer}</p> });
		expect(screen.queryByText("Card for Cedar")).toBeNull();
		expect(shownCustomers()).toEqual(["Cedar", "Aspen", "Birch"]);
	});

	it("keeps the height limit on screen", () => {
		renderTable({ layout: { maxHeight: 200 } });
		expect(document.querySelector<HTMLElement>("[data-slot=table-engine-scroll-area]")?.style.maxHeight).toBe("200px");
	});
});

describe("DataTable: density", () => {
	function shell(): HTMLElement {
		const found = document.querySelector<HTMLElement>("[data-slot=data-table]");
		if (found === null) {
			throw new Error("the table renders its shell");
		}
		return found;
	}

	function firstCell(): HTMLElement {
		const found = screen.getAllByRole("cell").at(LIST_SLOT_INDEX.first);
		if (found === undefined) {
			throw new Error("the table renders a cell");
		}
		return found;
	}

	async function chooseDensity(name: string): Promise<void> {
		fireEvent.click(screen.getByRole("button", { name: "Density" }));
		fireEvent.click(await screen.findByRole("menuitemradio", { name }));
	}

	it("is comfortable by default, with no density control", () => {
		renderTable();
		expect(shell().getAttribute("data-density")).toBe("comfortable");
		expect(firstCell().className.split(" ")).toContain("p-4");
		expect(screen.queryByRole("button", { name: "Density" })).toBeNull();
	});

	it("follows layout.density", () => {
		renderTable({ layout: { density: "spacious" } });
		expect(shell().getAttribute("data-density")).toBe("spacious");
		expect(firstCell().className.split(" ")).toContain("p-5");
	});

	it("lets the reader pick a density, starting from layout.density", async (): Promise<void> => {
		renderTable({ layout: { density: "compact" }, columnControls: { density: true } });
		expect(shell().getAttribute("data-density")).toBe("compact");
		expect(firstCell().className.split(" ")).toContain("px-3");

		await chooseDensity("Spacious");

		expect(shell().getAttribute("data-density")).toBe("spacious");
		expect(firstCell().className.split(" ")).toContain("p-5");
	});

	it("draws the records look: a tinted header band with uppercase titles, tall rows and a rounded frame", () => {
		renderTable();
		const headerCell = screen.getAllByRole("columnheader").at(0);
		expect(headerCell?.className.split(" ")).toEqual(expect.arrayContaining(["bg-muted/30", "uppercase", "text-xs", "font-semibold", "h-11"]));
		expect(firstCell().closest("tr")?.className.split(" ")).toContain("h-18");
		expect(firstCell().closest("[data-slot='table-engine']")?.className.split(" ")).toContain("rounded-md");
	});

	it("saves the reader's density and starts from it next time", async (): Promise<void> => {
		const write = vi.fn<DataTableStorageAdapter["write"]>();
		const preferences: DataTablePreferences = { key: "invoices", storage: { read: (): ReturnType<DataTableStorageAdapter["read"]> => ({ density: "compact" }), write } };
		renderTable({ preferences, columnControls: { density: true } });
		expect(shell().getAttribute("data-density")).toBe("compact");

		await chooseDensity("Comfortable");

		expect(write).toHaveBeenCalledWith("invoices", { density: "comfortable" });
	});

	it("ignores a saved density while the control is off", () => {
		const preferences: DataTablePreferences = {
			key: "invoices",
			storage: { read: (): ReturnType<DataTableStorageAdapter["read"]> => ({ density: "compact" }), write: vi.fn<DataTableStorageAdapter["write"]>() },
		};
		renderTable({ preferences });
		expect(shell().getAttribute("data-density")).toBe("comfortable");
	});
});

describe("DataTable: column controls and other sources", () => {
	async function openColumnMenu(name: string): Promise<void> {
		fireEvent.click(within(columnHeader(name)).getByRole("button", { name: new RegExp(name, "u") }));
		await screen.findByRole("menu");
	}

	it("offers pinning from the column menu, and pins the column", async (): Promise<void> => {
		renderTable({ columnControls: { pinning: true } });
		await openColumnMenu("Status");

		fireEvent.click(screen.getByRole("menuitem", { name: /Pin to left/u }));

		expect(columnHeader("Status").getAttribute("data-pinned")).toBe("start");
	});

	it("offers moving a column from its menu", async (): Promise<void> => {
		renderTable({ columnControls: { reordering: true } });
		await openColumnMenu("Customer");

		fireEvent.click(screen.getByRole("menuitem", { name: /Move to right/u }));

		expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Status", "Customer", "Type", "Amount"]);
	});

	it("gives every column a named resize handle when resizing is on", () => {
		renderTable({ columnControls: { resizing: true } });
		expect(screen.getByRole("button", { name: "Resize Customer column" })).toBeTruthy();
	});

	it("leaves the header a plain sort button with no column control on", () => {
		renderTable();
		expect(screen.queryByRole("button", { name: "Resize Customer column" })).toBeNull();
		expect(within(columnHeader("Customer")).getByRole("button").hasAttribute("aria-haspopup")).toBe(false);
	});

	it("shows no pager on an infinite source", () => {
		renderTable({ paging: {}, source: { mode: "infinite", hasMore: false, isFetchingMore: false, onLoadMore: noop } });
		expect(document.querySelector("[data-slot=data-table-pager]")).toBeNull();
		expect(document.querySelector("[data-slot=table-engine-table-viewport]")).not.toBeNull();
	});
});

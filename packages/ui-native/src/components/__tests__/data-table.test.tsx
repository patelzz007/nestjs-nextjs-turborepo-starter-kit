import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { DataTableClientPagination, DataTablePersistedPrefs, DataTablePersistedPrefsPatch, DataTableStorageAdapter } from "@workspace/ui-kit-logic";
import EyeIcon from "lucide-react-native/icons/eye";
import * as React from "react";
import { Share, Text, type ViewInstance } from "react-native";

import { SHEET_MOTION } from "../../lib/motion";
import type { DataTableExportFile } from "../../lib/data-table";
import { DataTable, type DataTableColumn, type DataTableFilter, type DataTableProps } from "../data-table";

interface Invoice {
	readonly id: string;
	readonly merchant: string;
	readonly status: string;
	readonly amount: number;
}

const INVOICES: readonly Invoice[] = [
	{ id: "INV-001", merchant: "Acme Coffee", status: "paid", amount: 250 },
	{ id: "INV-002", merchant: "Bayview Books", status: "unpaid", amount: 150 },
	{ id: "INV-003", merchant: "Corner Bakery", status: "overdue", amount: 350 },
];

const COLUMNS: readonly DataTableColumn<Invoice>[] = [
	{ id: "id", header: "Invoice", value: (row: Invoice): string => row.id },
	{ id: "merchant", header: "Merchant", value: (row: Invoice): string => row.merchant },
	{ id: "status", header: "Status", value: (row: Invoice): string => row.status },
	{ id: "amount", header: "Amount", value: (row: Invoice): number => row.amount, align: "end" },
];

const STATUS_FILTER: readonly DataTableFilter[] = [
	{
		key: "status",
		label: "Status",
		options: [
			{ value: "paid", label: "Paid" },
			{ value: "unpaid", label: "Unpaid" },
			{ value: "overdue", label: "Overdue" },
		],
	},
];

function invoiceId(row: Invoice): string {
	return row.id;
}

const CLIENT: DataTableClientPagination<Invoice> = { mode: "client", getRowId: invoiceId };

function table(overrides: Partial<DataTableProps<Invoice>> = {}): React.JSX.Element {
	return <DataTable<Invoice> data={INVOICES} columns={COLUMNS} pagination={CLIENT} testID="table" {...overrides} />;
}

/** The invoices shown, in order: each row's first cell. */
function shownInvoices(): string[] {
	return screen.queryAllByText(/^INV-\d+$/u).map((node): string => String(node.props.children));
}

/** Opens a toolbar menu and picks one of its rows (a menu leaves with an animation the test's clock runs). */
async function choose(menu: RegExp, item: string | RegExp, role: "radio" | "checkbox" | "menuitem" = "radio"): Promise<void> {
	await fireEvent.press(screen.getByRole("button", { name: menu }));
	await fireEvent.press(screen.getByRole(role, { name: item }));
	await act((): void => {
		jest.advanceTimersByTime(SHEET_MOTION.exit.duration);
	});
}

beforeEach((): void => {
	jest.useFakeTimers();
});

afterEach((): void => {
	jest.useRealTimers();
});

describe("DataTable", () => {
	it("shows a title, a header per column and a row per record", async () => {
		await render(table({ title: "Invoices", description: "This month" }));

		expect(screen.getByRole("header", { name: "Invoices" })).toBeOnTheScreen();
		expect(screen.getByText("This month")).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Merchant" })).toBeOnTheScreen();
		expect(shownInvoices()).toEqual(["INV-001", "INV-002", "INV-003"]);
		expect(screen.getByText("Showing 1 to 3 of 3 results")).toBeOnTheScreen();
	});

	it("draws a column's cell, and its value as text otherwise", async () => {
		const columns: readonly DataTableColumn<Invoice>[] = [
			...COLUMNS.slice(0, 1),
			{ id: "merchant", header: "Merchant", value: (row: Invoice): string => row.merchant, cell: (row: Invoice): React.JSX.Element => <Text>{`★ ${row.merchant}`}</Text> },
		];
		await render(table({ columns }));

		expect(screen.getByText("★ Acme Coffee")).toBeOnTheScreen();
		expect(screen.getByText("INV-001")).toBeOnTheScreen();
	});

	it("searches the search keys as the person types", async () => {
		await render(table({ searchKeys: ["merchant"] }));

		await fireEvent.changeText(screen.getByLabelText("Search rows"), "bak");

		expect(shownInvoices()).toEqual(["INV-003"]);
		await fireEvent.press(screen.getByRole("button", { name: "Clear search" }));
		expect(shownInvoices()).toHaveLength(INVOICES.length);
	});

	it("waits for typing to settle with a debounce", async () => {
		await render(table({ searchKeys: ["merchant"], searchDebounceMs: 200 }));

		await fireEvent.changeText(screen.getByLabelText("Search rows"), "acme");
		expect(shownInvoices()).toHaveLength(INVOICES.length);

		await act((): void => {
			jest.advanceTimersByTime(200);
		});
		expect(shownInvoices()).toEqual(["INV-001"]);
	});

	it("keeps only the rows whose value is exactly the chosen filter option", async () => {
		await render(table({ filters: STATUS_FILTER }));

		await choose(/^Status: All/u, "Paid");

		expect(shownInvoices()).toEqual(["INV-001"]);
		expect(screen.getByRole("button", { name: /^Status: Paid/u })).toBeOnTheScreen();
		await choose(/^Status: Paid/u, "All");
		expect(shownInvoices()).toHaveLength(INVOICES.length);
	});

	it("offers to clear the filters when nothing matches", async () => {
		await render(table({ searchKeys: ["merchant"] }));

		await fireEvent.changeText(screen.getByLabelText("Search rows"), "zzz");

		expect(screen.getByText("No results found")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Clear filters" }));
		expect(shownInvoices()).toHaveLength(INVOICES.length);
	});

	it("sorts by a header, says how, and alternates", async () => {
		await render(table());

		await fireEvent.press(screen.getByRole("button", { name: "Amount" }));
		expect(shownInvoices()).toEqual(["INV-002", "INV-001", "INV-003"]);
		expect(screen.getByRole("button", { name: "Amount, sorted ascending" })).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("button", { name: "Amount, sorted ascending" }));
		expect(shownInvoices()).toEqual(["INV-003", "INV-001", "INV-002"]);

		await fireEvent.press(screen.getByRole("button", { name: "Amount, sorted descending" }));
		expect(screen.getByRole("button", { name: "Amount, sorted ascending" })).toBeOnTheScreen();
	});

	it("returns to the original order on the third press with asc-desc-none", async () => {
		await render(table({ sortCycle: "asc-desc-none" }));

		await fireEvent.press(screen.getByRole("button", { name: "Amount" }));
		await fireEvent.press(screen.getByRole("button", { name: "Amount, sorted ascending" }));
		await fireEvent.press(screen.getByRole("button", { name: "Amount, sorted descending" }));

		expect(shownInvoices()).toEqual(["INV-001", "INV-002", "INV-003"]);
		expect(screen.getByRole("button", { name: "Amount" })).toBeOnTheScreen();
	});

	it("does not sort a column that turns sorting off", async () => {
		const columns = COLUMNS.map((column): DataTableColumn<Invoice> => ({ ...column, enableSorting: false }));
		await render(table({ columns }));

		expect(screen.queryByRole("button", { name: "Amount" })).toBeNull();
		expect(screen.getByRole("header", { name: "Amount" })).toBeOnTheScreen();
	});

	it("pages the rows and changes the page size", async () => {
		await render(table({ pageSize: 2, pageSizeOptions: [2, 5] }));

		expect(shownInvoices()).toEqual(["INV-001", "INV-002"]);
		await fireEvent.press(screen.getByRole("button", { name: "Go to next page" }));
		expect(shownInvoices()).toEqual(["INV-003"]);
		expect(screen.getByText("Showing 3 to 3 of 3 results")).toBeOnTheScreen();

		await choose(/^2 per page/u, "5 per page");
		expect(shownInvoices()).toHaveLength(INVOICES.length);
	});

	it("runs a row action on its row", async () => {
		const onPress = jest.fn<undefined, [Invoice]>();
		await render(table({ actions: [{ key: "view", label: "View", icon: EyeIcon, onPress }] }));

		await choose(/^Open row menu, INV-002/u, "View", "menuitem");

		expect(onPress).toHaveBeenCalledWith(INVOICES.at(1));
	});

	it("makes each row a button when rows press", async () => {
		const onRowPress = jest.fn<undefined, [Invoice]>();
		await render(table({ onRowPress }));

		await fireEvent.press(screen.getByRole("button", { name: "INV-003" }));

		expect(onRowPress).toHaveBeenCalledWith(INVOICES.at(2));
	});

	it("selects rows, selects every matching row, and runs a bulk action on them", async () => {
		const onClick = jest.fn<undefined, [Invoice[], { readonly selectAllPages: boolean; readonly totalMatchingRows: number }]>();
		await render(table({ pageSize: 2, checkbox: { bulkActions: [{ key: "remind", label: "Send reminder", onClick }] } }));

		await fireEvent.press(screen.getByRole("checkbox", { name: "Select INV-001" }));
		expect(screen.getByText("1 row selected")).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("checkbox", { name: "Select all" }));
		expect(screen.getByText("2 rows selected")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Select all 3 rows" }));
		expect(screen.getByText("All 3 rows selected")).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("button", { name: "Send reminder" }));
		expect(onClick).toHaveBeenCalledWith([...INVOICES], { selectAllPages: true, totalMatchingRows: 3 });
		await act(async (): Promise<void> => {
			await Promise.resolve();
		});
		expect(screen.queryByText("All 3 rows selected")).toBeNull();
	});

	it("deletes the selection with a destructive bulk action, and clears it", async () => {
		const onDeleteAll = jest.fn<undefined, [Invoice[]]>();
		await render(table({ checkbox: { onDeleteAll } }));

		await fireEvent.press(screen.getByRole("checkbox", { name: "Select INV-002" }));
		await fireEvent.press(screen.getByRole("button", { name: "Delete selected" }));

		expect(onDeleteAll).toHaveBeenCalledWith([INVOICES.at(1)], expect.objectContaining({ selectAllPages: false }));
		await fireEvent.press(screen.getByRole("checkbox", { name: "Select INV-001" }));
		await fireEvent.press(screen.getByRole("button", { name: "Clear" }));
		expect(screen.queryByText("1 row selected")).toBeNull();
	});

	it("exports the selection, or every row, through the exporter", async () => {
		const exporter = jest.fn<Promise<void>, [DataTableExportFile]>().mockResolvedValue(undefined);
		await render(table({ exporter, checkbox: { export: ["csv", "json", "pdf"], exportFilename: "invoices", exportableColumns: ["id", "amount"] } }));

		expect(screen.queryByRole("menuitem", { name: /PDF/u })).toBeNull();
		await choose(/^Export/u, /^CSV/u, "menuitem");
		expect(exporter).toHaveBeenLastCalledWith(expect.objectContaining({ filename: "invoices.csv", text: "﻿id,amount\r\nINV-001,250\r\nINV-002,150\r\nINV-003,350" }));

		await fireEvent.press(screen.getByRole("checkbox", { name: "Select INV-003" }));
		await choose(/^Export/u, /^JSON/u, "menuitem");
		const [lastFile] = exporter.mock.lastCall ?? [];
		expect(JSON.parse(lastFile?.text ?? "")).toEqual([{ id: "INV-003", amount: 350 }]);
	});

	it("shares an export through the system share sheet by default", async () => {
		const share = jest.spyOn(Share, "share").mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
		await render(table({ title: "Invoices", checkbox: { export: true } }));

		await choose(/^Export/u, /^Spreadsheet/u, "menuitem");

		const shared = JSON.stringify(share.mock.lastCall);
		expect(shared).toContain('"title":"Invoices.xls"');
		expect(shared).toContain("<Workbook");
	});

	it("edits a cell in place and reports the typed value with its row", async () => {
		const onCellEdit = jest.fn<undefined, [number, string, string | number | boolean | null, Invoice]>();
		await render(table({ editable: true, editableColumns: ["amount"], onCellEdit }));

		expect(screen.queryByRole("button", { name: "Acme Coffee" })).toBeNull();
		await fireEvent.press(screen.getByRole("button", { name: "150" }));
		const input = screen.getByDisplayValue("150");
		await fireEvent.changeText(input, "175");
		await fireEvent(input, "submitEditing");

		expect(onCellEdit).toHaveBeenCalledWith(1, "amount", 175, INVOICES.at(1));
	});

	it("reports nothing when an edit leaves the value as it was", async () => {
		const onCellEdit = jest.fn();
		await render(table({ editable: true, onCellEdit }));

		await fireEvent.press(screen.getByRole("button", { name: "Acme Coffee" }));
		await fireEvent(screen.getByDisplayValue("Acme Coffee"), "blur");

		expect(onCellEdit).not.toHaveBeenCalled();
	});

	it("reorders rows with a handle's move actions", async () => {
		const onRowReorder = jest.fn<undefined, [number, number, Invoice[]]>();
		await render(table({ draggable: true, onRowReorder }));

		await fireEvent(screen.getByLabelText("Reorder INV-001"), "accessibilityAction", { nativeEvent: { actionName: "down" } });

		expect(onRowReorder).toHaveBeenCalledWith(0, 1, [...INVOICES]);
	});

	it("keeps reordering with a column pinned: the handle leads the part of the row that moves", async () => {
		const onRowReorder = jest.fn<undefined, [number, number, Invoice[]]>();
		await render(table({ draggable: true, onRowReorder, enableColumnPinning: true }));
		await choose(/^Columns/u, "Pin Invoice", "checkbox");

		await fireEvent(screen.getByLabelText("Reorder INV-001"), "accessibilityAction", { nativeEvent: { actionName: "down" } });

		expect(onRowReorder).toHaveBeenCalledWith(0, 1, [...INVOICES]);
	});

	it("draws no reorder handle in a virtualised body", async () => {
		await render(table({ draggable: true, virtualizeRows: true, maxHeight: 400 }));

		expect(screen.queryByLabelText("Reorder INV-001")).toBeNull();
	});

	it("hides and pins columns from the columns menu, and remembers both", async () => {
		const saved: { current: DataTablePersistedPrefs } = { current: {} };
		const storage: DataTableStorageAdapter = {
			read: (): DataTablePersistedPrefs | null => saved.current,
			write: (_key: string, patch: DataTablePersistedPrefsPatch): void => {
				saved.current = { ...saved.current, ...patch };
			},
		};
		const { unmount } = await render(table({ enableColumnVisibility: true, enableColumnPinning: true, persistKey: "invoices", storage }));

		await choose(/^Columns/u, "Status", "checkbox");
		await choose(/^Columns/u, "Pin Invoice", "checkbox");
		expect(saved.current).toEqual(expect.objectContaining({ columnVisibility: { status: false }, columnPinning: { start: ["id"], end: [] } }));
		await unmount();

		await render(table({ enableColumnVisibility: true, enableColumnPinning: true, persistKey: "invoices", storage }));
		expect(screen.queryByRole("button", { name: "Status" })).toBeNull();
		expect(shownInvoices()).toEqual(["INV-001", "INV-002", "INV-003"]);
	});

	it("draws each row as a card, with its actions bound to it", async () => {
		const onPress = jest.fn<undefined, [Invoice]>();
		await render(
			table({
				actions: [{ key: "open", label: "Open", onPress }],
				renderCard: (row: Invoice, actions): React.JSX.Element => <Text onPress={actions.at(0)?.onPress}>{`Card ${row.merchant}`}</Text>,
			}),
		);

		await fireEvent.press(screen.getByText("Card Corner Bakery"));

		expect(onPress).toHaveBeenCalledWith(INVOICES.at(2));
		expect(screen.queryByRole("button", { name: "Merchant" })).toBeNull();
	});

	it("puts a selection box before each card when rows select", async () => {
		await render(table({ checkbox: true, renderCard: (row: Invoice): React.JSX.Element => <Text>{row.merchant}</Text> }));

		await fireEvent.press(screen.getByRole("checkbox", { name: "Select INV-001" }));

		expect(screen.getByText("1 row selected")).toBeOnTheScreen();
	});

	it("shows skeleton rows while loading, dims a refetch, and shows an error", async () => {
		const { rerender } = await render(table({ isLoading: true, skeletonRows: 2 }));
		expect(screen.getByLabelText("Loading table data")).toBeOnTheScreen();
		expect(shownInvoices()).toEqual([]);

		await rerender(table({ isRefetching: true }));
		expect(screen.getByTestId("table")).toHaveProp("accessibilityState", { busy: true });

		await rerender(table({ error: "Could not load invoices." }));
		expect(screen.getByText("Could not load invoices.")).toBeOnTheScreen();
		expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();

		const onRetry = jest.fn();
		await rerender(table({ error: "Could not load invoices.", onRetry }));
		await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
		expect(onRetry).toHaveBeenCalled();
	});

	it("shows the caller's empty state with its action when there are no rows", async () => {
		const onPress = jest.fn();
		await render(table({ data: [], emptyState: { title: "No invoices yet", description: "Create one to start.", action: { label: "New invoice", onPress } } }));

		expect(screen.getByText("No invoices yet")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "New invoice" }));
		expect(onPress).toHaveBeenCalled();
	});

	it("leaves paging, sorting and filtering to the parent in server mode", async () => {
		const onPageChange = jest.fn();
		const onManualSortingChange = jest.fn();
		const onManualColumnFilterChange = jest.fn();
		await render(
			table({
				data: INVOICES.slice(0, 2),
				pagination: { mode: "server", totalCount: 6, pageIndex: 0, pageSize: 2, onPageChange, getRowId: invoiceId },
				filters: STATUS_FILTER,
				manualColumnFilters: { status: "paid" },
				onManualColumnFilterChange,
				onManualSortingChange,
			}),
		);

		expect(screen.getByText("Showing 1 to 2 of 6 results")).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: /^Status: Paid/u })).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Go to next page" }));
		expect(onPageChange).toHaveBeenCalledWith(1, 2);

		await fireEvent.press(screen.getByRole("button", { name: "Amount" }));
		expect(onManualSortingChange).toHaveBeenCalledWith([{ id: "amount", desc: false }]);
		expect(shownInvoices()).toEqual(["INV-001", "INV-002"]);

		await choose(/^Status: Paid/u, "Overdue");
		expect(onManualColumnFilterChange).toHaveBeenCalledWith("status", "overdue");
	});

	it("draws long lists through a virtualised body, without a pager", async () => {
		const many = Array.from({ length: 200 }, (_, index): Invoice => ({ id: `INV-${String(index + 1)}`, merchant: "M", status: "paid", amount: index }));
		await render(table({ data: many, pageSize: many.length, virtualizeRows: true, maxHeight: 300 }));

		expect(shownInvoices().length).toBeLessThan(many.length);
		expect(screen.queryByText(/^Showing/u)).toBeNull();
	});

	it("forwards its ref and merges the caller's className", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<DataTable<Invoice> ref={ref} data={INVOICES} columns={COLUMNS} className="mt-4" testID="table" />);

		expect(ref.current).not.toBeNull();
		expect(screen.getByTestId("table")).toHaveProp("className", expect.stringContaining("mt-4"));
	});

	it("unpins a pinned column, and clears 'every row' when a row or the page is unticked", async () => {
		await render(table({ enableColumnPinning: true, checkbox: true, pageSize: 2 }));
		await choose(/^Columns/u, "Pin Invoice", "checkbox");
		await choose(/^Columns/u, "Pin Invoice", "checkbox");
		expect(screen.getAllByRole("button", { name: "Invoice" })).toHaveLength(1);

		await fireEvent.press(screen.getByRole("checkbox", { name: "Select all" }));
		await fireEvent.press(screen.getByRole("button", { name: "Select all 3 rows" }));
		await fireEvent.press(screen.getByRole("checkbox", { name: "Select INV-001" }));
		expect(screen.queryByText("All 3 rows selected")).toBeNull();

		await fireEvent.press(screen.getByRole("checkbox", { name: "Select all" }));
		await fireEvent.press(screen.getByRole("button", { name: "Select all 3 rows" }));
		await fireEvent.press(screen.getByRole("checkbox", { name: "Select all" }));
		expect(screen.queryByText(/selected$/u)).toBeNull();
	});

	it("asks the parent for a new page size in server mode, and exports the page it shows", async () => {
		const onPageChange = jest.fn();
		const exporter = jest.fn<Promise<void>, [DataTableExportFile]>().mockResolvedValue(undefined);
		await render(
			table({
				data: INVOICES.slice(0, 2),
				pagination: { mode: "server", totalCount: 6, pageIndex: 0, pageSize: 2, onPageChange, getRowId: invoiceId },
				pageSizeOptions: [2, 5],
				exporter,
				checkbox: { export: ["csv"] },
				filters: STATUS_FILTER,
				manualColumnFilters: { status: "all" },
			}),
		);

		expect(screen.getByRole("button", { name: /^Status: All/u })).toBeOnTheScreen();
		await choose(/^2 per page/u, "5 per page");
		expect(onPageChange).toHaveBeenCalledWith(0, 5);

		await choose(/^Export/u, /^CSV/u, "menuitem");
		const [file] = exporter.mock.lastCall ?? [];
		expect(file?.text).toContain("INV-002");
		expect(file?.text).not.toContain("INV-003");
	});

	it("shows its own empty state and a description without a title, and draws a missing value as nothing", async () => {
		const columns: readonly DataTableColumn<Invoice>[] = [...COLUMNS, { id: "note", header: "Note", value: (): null => null }];
		const { rerender } = await render(table({ data: [], description: "This month" }));
		expect(screen.getByText("No data available")).toBeOnTheScreen();
		expect(screen.getByText("This month")).toBeOnTheScreen();

		await rerender(table({ columns }));
		expect(screen.getByRole("button", { name: "Note" })).toBeOnTheScreen();
	});
});

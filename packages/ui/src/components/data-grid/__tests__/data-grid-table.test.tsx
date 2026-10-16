// @vitest-environment jsdom
import { LIST_SLOT_INDEX } from "@workspace/shared";
import {
	dataGridFeatures,
	type DataGridFeatures,
	type DataGridRowStatus,
	type DataGridCellStatus,
	type DataGridTableInstance,
	type DataGridTableLayout,
} from "@workspace/ui/components/data-grid/data-grid";
import {
	DataGridTable,
	DataGridTableBase,
	DataGridTableBody,
	DataGridTableFootRow,
	DataGridTableFootRowCell,
	DataGridTableHeader,
	DataGridTableLoader,
	DataGridTableRowExpand,
	DataGridTableRowPin,
	DataGridTableRowSelect,
	DataGridTableRowSelectAll,
	getDataGridHeadCellResizeHeader,
	getDataGridHeadCellSizeVar,
	getDataGridScrollAreaViewport,
	getDataGridTableColumnEdges,
	getDataGridTableMergedHeaderGroups,
	getDataGridTableResolvedRows,
	getDataGridTableRowSections,
	getDataGridTreeIndentStyle,
	getPinningStyles,
	hasDataGridTableRightPinnedColumns,
	isDataGridPortalEvent,
	renderDataGridTableHeadCellContent,
} from "@workspace/ui/components/data-grid/data-grid-table";
import {
	DATA_GRID_TEST_COLUMNS,
	DATA_GRID_TEST_PEOPLE,
	DataGridResizeObserverStub,
	DataGridTestHarness,
	type DataGridTestPerson,
	type DataGridTestTableOptions,
} from "@workspace/ui/testing/data-grid-test-harness";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useTable, type ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { createPortal } from "react-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", DataGridResizeObserverStub);
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

type PersonColumn = ColumnDef<DataGridFeatures, DataGridTestPerson>;

/** Body rows only (the header row sits in the thead). */
function bodyRows(): HTMLElement[] {
	const [, ...rows] = screen.getAllByRole("row");
	return rows;
}

function firstCellTexts(): string[] {
	return bodyRows().map((row) => within(row).getAllByRole("cell").at(LIST_SLOT_INDEX.first)?.textContent ?? "");
}

const SORTED_BY_NAME_DESC: DataGridTestTableOptions = { initialState: { sorting: [{ id: "name", desc: true }] } };

const SORTABLE_COLUMNS: PersonColumn[] = [
	{
		accessorKey: "name",
		header: ({ column }) => (
			<button type="button" onClick={column.getToggleSortingHandler()}>
				Name
			</button>
		),
	},
	{ accessorKey: "email", header: "Email", enableSorting: false },
	{ accessorKey: "age", header: "Age" },
];

describe("DataGridTable rendering", () => {
	it("renders a column header per leaf and a row per record", (): void => {
		render(
			<DataGridTestHarness>
				<DataGridTable />
			</DataGridTestHarness>,
		);
		expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Name", "Email", "Age", "Role"]);
		expect(firstCellTexts()).toEqual(DATA_GRID_TEST_PEOPLE.map((person) => person.name));
	});

	it("reflects the sorting state in aria-sort and re-sorts on a header click", (): void => {
		render(
			<DataGridTestHarness columns={SORTABLE_COLUMNS} tableOptions={SORTED_BY_NAME_DESC}>
				<DataGridTable />
			</DataGridTestHarness>,
		);
		const [nameHeader, emailHeader, ageHeader] = screen.getAllByRole("columnheader");
		expect(nameHeader?.getAttribute("aria-sort")).toBe("descending");
		expect(emailHeader?.hasAttribute("aria-sort")).toBe(false);
		expect(ageHeader?.getAttribute("aria-sort")).toBe("none");
		expect(firstCellTexts().at(LIST_SLOT_INDEX.first)).toBe("Sarah Chen");

		// desc → unsorted (data order) → asc: the TanStack cycle for a text column that started descending.
		fireEvent.click(screen.getByRole("button", { name: "Name" }));
		expect(screen.getAllByRole("columnheader").at(LIST_SLOT_INDEX.first)?.getAttribute("aria-sort")).toBe("none");
		expect(firstCellTexts()).toEqual(DATA_GRID_TEST_PEOPLE.map((person) => person.name));
		fireEvent.click(screen.getByRole("button", { name: "Name" }));
		expect(screen.getAllByRole("columnheader").at(LIST_SLOT_INDEX.first)?.getAttribute("aria-sort")).toBe("ascending");
		expect(firstCellTexts().at(LIST_SLOT_INDEX.first)).toBe("Alex Johnson");
	});

	it("shows the empty label, or the emptyMessage override", (): void => {
		const { rerender } = render(
			<DataGridTestHarness data={[]}>
				<DataGridTable />
			</DataGridTestHarness>,
		);
		expect(screen.getByText("No data available")).toBeDefined();
		rerender(
			<DataGridTestHarness data={[]} emptyMessage="Nobody yet">
				<DataGridTable />
			</DataGridTestHarness>,
		);
		expect(screen.getByText("Nobody yet")).toBeDefined();
	});

	it("renders one skeleton row per page slot while loading", (): void => {
		render(
			<DataGridTestHarness isLoading tableOptions={SMALL_PAGE}>
				<DataGridTable />
			</DataGridTestHarness>,
		);
		expect(bodyRows()).toHaveLength(SMALL_PAGE_SIZE);
		expect(screen.queryByText("Alex Johnson")).toBeNull();
	});

	it("renders a status spinner with the loading label in spinner mode", (): void => {
		render(
			<DataGridTestHarness isLoading loadingMode="spinner">
				<DataGridTable />
			</DataGridTestHarness>,
		);
		expect(screen.getByRole("status").textContent).toBe("Loading…");
	});

	it("renders the footer and can omit the header", (): void => {
		render(
			<DataGridTestHarness>
				<DataGridTable renderHeader={false} footerContent={FOOTER} />
			</DataGridTestHarness>,
		);
		expect(screen.queryAllByRole("columnheader")).toHaveLength(0);
		expect(screen.getByText("Total").closest("tfoot")).not.toBeNull();
	});

	it("forwards its ref to the viewport and merges className last", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(
			<DataGridTestHarness>
				<DataGridTable ref={ref} className="extra-class" />
			</DataGridTestHarness>,
		);
		expect(ref.current?.dataset.slot).toBe("data-grid-table-viewport");
		expect(ref.current?.className.endsWith("extra-class")).toBe(true);
	});

	it("renders a header-only table", (): void => {
		render(
			<DataGridTestHarness>
				<DataGridTableHeader />
			</DataGridTestHarness>,
		);
		expect(screen.getAllByRole("columnheader")).toHaveLength(DATA_GRID_TEST_COLUMNS.length);
		expect(screen.queryByText("Alex Johnson")).toBeNull();
	});

	it("shows the floating loader with the loading label", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(
			<DataGridTestHarness loadingMessage="Fetching people">
				<DataGridTableLoader ref={ref} className="loader-class" />
			</DataGridTestHarness>,
		);
		expect(screen.getByRole("status").textContent).toBe("Fetching people");
		expect(ref.current?.className).toContain("loader-class");
	});
});

const SMALL_PAGE_SIZE = 3;
const SMALL_PAGE: DataGridTestTableOptions = { initialState: { pagination: { pageIndex: 0, pageSize: SMALL_PAGE_SIZE } } };

const FOOTER = (
	<DataGridTableFootRow>
		<DataGridTableFootRowCell colSpan={DATA_GRID_TEST_COLUMNS.length}>Total</DataGridTableFootRowCell>
	</DataGridTableFootRow>
);

function PortalButton(): React.ReactPortal {
	return createPortal(<button type="button">portal pick</button>, document.body);
}

const INTERACTIVE_COLUMNS: PersonColumn[] = [
	{ id: "select", header: () => <DataGridTableRowSelectAll />, cell: ({ row }) => <DataGridTableRowSelect row={row} /> },
	{ accessorKey: "name", header: "Name" },
	{ id: "portal", header: "Portal", cell: () => <PortalButton /> },
];

describe("row interactions", () => {
	it("fires onRowClick with the row, but not for checkbox or portalled clicks", (): void => {
		const onRowClick = vi.fn();
		render(
			<DataGridTestHarness columns={INTERACTIVE_COLUMNS} data={DATA_GRID_TEST_PEOPLE.slice(0, 1)} onRowClick={onRowClick}>
				<DataGridTable />
			</DataGridTestHarness>,
		);
		fireEvent.click(screen.getByText("Alex Johnson"));
		expect(onRowClick).toHaveBeenCalledTimes(1);
		expect(onRowClick).toHaveBeenCalledWith(DATA_GRID_TEST_PEOPLE.at(LIST_SLOT_INDEX.first));
		expect(screen.getByText("Alex Johnson").closest("tr")?.className).toContain("cursor-pointer");

		fireEvent.click(screen.getByRole("checkbox", { name: "Select row" }));
		fireEvent.click(screen.getByRole("button", { name: "portal pick" }));
		expect(onRowClick).toHaveBeenCalledTimes(1);
	});

	it("toggles one row and every page row through the selection checkboxes", (): void => {
		render(
			<DataGridTestHarness columns={INTERACTIVE_COLUMNS}>
				<DataGridTable />
			</DataGridTestHarness>,
		);
		const [firstRowCheckbox] = screen.getAllByRole("checkbox", { name: "Select row" });
		if (firstRowCheckbox === undefined) {
			throw new Error("no row checkbox");
		}
		fireEvent.click(firstRowCheckbox);
		expect(firstRowCheckbox.getAttribute("aria-checked")).toBe("true");
		expect(firstRowCheckbox.closest("tr")?.dataset.state).toBe("selected");
		expect(screen.getByRole("checkbox", { name: "Select all" }).getAttribute("aria-checked")).toBe("mixed");

		fireEvent.click(screen.getByRole("checkbox", { name: "Select all" }));
		expect(screen.getAllByRole("checkbox", { name: "Select row" }).every((checkbox) => checkbox.getAttribute("aria-checked") === "true")).toBe(true);
	});

	it("disables select-all while there are no records", (): void => {
		render(
			<DataGridTestHarness columns={INTERACTIVE_COLUMNS} data={[]}>
				<DataGridTable />
			</DataGridTestHarness>,
		);
		expect(screen.getByRole("checkbox", { name: "Select all" }).getAttribute("aria-disabled")).toBe("true");
	});

	it("expands a row into its detail content", (): void => {
		render(
			<DataGridTestHarness columns={EXPAND_COLUMNS} data={DATA_GRID_TEST_PEOPLE.slice(0, 1)} tableOptions={EXPANDABLE}>
				<DataGridTable />
			</DataGridTestHarness>,
		);
		expect(screen.queryByText("Details of alex@example.com")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Expand row" }));
		expect(screen.getByText("Details of alex@example.com")).toBeDefined();
		expect(screen.getByRole("button", { name: "Collapse row" }).getAttribute("aria-expanded")).toBe("true");
	});

	it("pins a row to the top and unpins it", (): void => {
		render(
			<DataGridTestHarness columns={PIN_COLUMNS} tableLayout={ROWS_PINNABLE}>
				<DataGridTable />
			</DataGridTestHarness>,
		);
		const pinButton = screen.getAllByRole("button", { name: "Pin row" }).at(LIST_SLOT_INDEX.third);
		if (pinButton === undefined) {
			throw new Error("no pin button");
		}
		fireEvent.click(pinButton);
		const [pinnedRow] = bodyRows();
		expect(pinnedRow?.dataset.rowId).toBe("p-3");
		expect(pinnedRow?.dataset.rowPinned).toBe("top");
		expect(pinnedRow?.dataset.rowPinnedBoundary).toBe("top");
		fireEvent.click(screen.getByRole("button", { name: "Unpin row" }));
		expect(bodyRows().at(LIST_SLOT_INDEX.first)?.dataset.rowId).toBe("p-1");
	});

	it("marks rows and cells with the consumer's CRUD statuses", (): void => {
		render(
			<DataGridTestHarness getRowStatus={statusOfRow} getCellStatus={statusOfCell}>
				<DataGridTable />
			</DataGridTestHarness>,
		);
		const rowOfMichael = screen.getByText("Michael Rodriguez").closest("tr");
		expect(rowOfMichael?.dataset.rowStatus).toBe("deleted");
		expect(screen.getByText("sarah@example.com").closest("td")?.dataset.cellStatus).toBe("invalid");
		expect(screen.getByText("Alex Johnson").closest("tr")?.dataset.rowStatus).toBeUndefined();
	});

	it("renders the add-row affordance and calls onRowCreate", (): void => {
		const onRowCreate = vi.fn();
		const { rerender } = render(
			<DataGridTestHarness onRowCreate={onRowCreate}>
				<DataGridTable />
			</DataGridTestHarness>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Add row" }));
		expect(onRowCreate).toHaveBeenCalledTimes(1);
		rerender(
			<DataGridTestHarness onRowCreate={onRowCreate} rowCreateLabel="New person">
				<DataGridTable />
			</DataGridTestHarness>,
		);
		expect(screen.getByRole("button", { name: "New person" })).toBeDefined();
	});
});

const EXPANDABLE: DataGridTestTableOptions = { getRowCanExpand: (): boolean => true };

function renderDetails(row: DataGridTestPerson): React.ReactNode {
	return `Details of ${row.email}`;
}

const EXPAND_COLUMNS: PersonColumn[] = [
	{ id: "expand", header: "", cell: ({ row }) => <DataGridTableRowExpand row={row} />, meta: { expandedContent: renderDetails } },
	{ accessorKey: "name", header: "Name" },
];

const PIN_COLUMNS: PersonColumn[] = [{ id: "pin", header: "", cell: ({ row }) => <DataGridTableRowPin row={row} /> }, ...DATA_GRID_TEST_COLUMNS];

const ROWS_PINNABLE: DataGridTableLayout = { rowsPinnable: true };

function statusOfRow(row: DataGridTestPerson): DataGridRowStatus | undefined {
	return row.id === "p-3" ? "deleted" : undefined;
}

function statusOfCell(row: DataGridTestPerson, columnId: string): DataGridCellStatus | undefined {
	return row.id === "p-2" && columnId === "email" ? "invalid" : undefined;
}

const PINNABLE: DataGridTableLayout = { columnsPinnable: true };
const NAME_PINNED_START: DataGridTestTableOptions = { initialState: { columnPinning: { start: ["name"], end: [] } } };
const RESIZABLE: DataGridTableLayout = { columnsResizable: true };
const CELL_SELECTION: DataGridTableLayout = { cellSelection: true };

describe("column layout", () => {
	it("makes a pinned column sticky when pinning is enabled", (): void => {
		render(
			<DataGridTestHarness tableLayout={PINNABLE} tableOptions={NAME_PINNED_START}>
				<DataGridTable />
			</DataGridTestHarness>,
		);
		const [nameHeader] = screen.getAllByRole("columnheader");
		expect(nameHeader?.dataset.pinned).toBe("start");
		expect(nameHeader?.style.position).toBe("sticky");
		expect(screen.getByText("Alex Johnson").closest("td")?.style.position).toBe("sticky");
	});

	it("writes column size variables and resizes through the handle", (): void => {
		render(
			<DataGridTestHarness tableLayout={RESIZABLE}>
				<DataGridTable />
			</DataGridTestHarness>,
		);
		const table = screen.getByRole("table");
		expect(table.style.getPropertyValue("--col-name-size")).toBe("160");
		const handle = screen.getByRole("button", { name: "Resize Name column" });

		fireEvent.mouseDown(handle, { button: 0, clientX: 100 });
		fireEvent.mouseMove(document, { clientX: 140 });
		fireEvent.mouseUp(document, { clientX: 140 });
		expect(table.style.getPropertyValue("--col-name-size")).toBe("200");

		fireEvent.doubleClick(handle);
		expect(table.style.getPropertyValue("--col-name-size")).toBe("160");

		fireEvent.keyDown(handle, { key: "ArrowRight" });
		expect(table.style.getPropertyValue("--col-name-size")).toBe("170");
		fireEvent.keyDown(handle, { key: "ArrowLeft" });
		expect(table.style.getPropertyValue("--col-name-size")).toBe("160");
	});

	it("ignores a secondary-button press on the resize handle", (): void => {
		render(
			<DataGridTestHarness tableLayout={RESIZABLE}>
				<DataGridTable />
			</DataGridTestHarness>,
		);
		const handle = screen.getByRole("button", { name: "Resize Name column" });
		fireEvent.mouseDown(handle, { button: 2, clientX: 100 });
		fireEvent.mouseUp(document, { clientX: 300 });
		expect(screen.getByRole("table").style.getPropertyValue("--col-name-size")).toBe("160");
	});

	it("announces a grid of selectable cells with cell selection on", (): void => {
		render(
			<DataGridTestHarness tableLayout={CELL_SELECTION}>
				<DataGridTable />
			</DataGridTestHarness>,
		);
		const grid = screen.getByRole("grid");
		expect(grid.getAttribute("aria-multiselectable")).toBe("true");
		expect(grid.getAttribute("aria-rowcount")).toBe(String(DATA_GRID_TEST_PEOPLE.length + 1));
		const cell = screen.getByText("Sarah Chen").closest("td");
		if (cell === null) {
			throw new Error("no cell");
		}
		expect(cell.getAttribute("role")).toBe("gridcell");
		expect(cell.getAttribute("aria-selected")).toBe("false");
		act((): void => {
			fireEvent.mouseDown(cell, { button: 0 });
			fireEvent.mouseUp(document);
		});
		expect(cell.getAttribute("aria-selected")).toBe("true");
		expect(cell.dataset.cellFocused).toBe("true");
	});
});

describe("building blocks", () => {
	it("forwards refs and merges className on the table base and body", (): void => {
		const tableRef = React.createRef<HTMLTableElement>();
		const bodyRef = React.createRef<HTMLTableSectionElement>();
		render(
			<DataGridTestHarness>
				<DataGridTableBase ref={tableRef} className="base-class">
					<DataGridTableBody ref={bodyRef} className="body-class" />
				</DataGridTableBase>
			</DataGridTestHarness>,
		);
		expect(tableRef.current?.dataset.slot).toBe("data-grid-table");
		expect(tableRef.current?.className.endsWith("base-class")).toBe(true);
		expect(bodyRef.current?.className.endsWith("body-class")).toBe(true);
		expect(tableRef.current?.querySelectorAll("col")).toHaveLength(DATA_GRID_TEST_COLUMNS.length);
	});
});

// ── Pure helpers ───────────────────────────────────────────────────────────

function TableProbe({
	columns,
	options,
	onTable,
}: {
	readonly columns: PersonColumn[];
	readonly options: DataGridTestTableOptions;
	readonly onTable: (table: DataGridTableInstance<DataGridTestPerson>) => void;
}): null {
	onTable(
		useTable({
			getRowId: (row: DataGridTestPerson): string => row.id,
			...options,
			features: dataGridFeatures,
			columns,
			data: [...DATA_GRID_TEST_PEOPLE],
		}),
	);
	return null;
}

function probeTable(columns: PersonColumn[], options: DataGridTestTableOptions = {}): DataGridTableInstance<DataGridTestPerson> {
	const tables: DataGridTableInstance<DataGridTestPerson>[] = [];
	function keep(table: DataGridTableInstance<DataGridTestPerson>): void {
		tables.push(table);
	}
	render(<TableProbe columns={columns} options={options} onTable={keep} />);
	const table = tables.at(-1);
	if (table === undefined) {
		throw new Error("table not created");
	}
	return table;
}

const GROUPED_COLUMNS: PersonColumn[] = [
	{
		id: "person",
		header: "Person",
		columns: [
			{ accessorKey: "name", header: "Name", size: 100, meta: { headerColSpan: 2 } },
			{ accessorKey: "email", header: "Email", size: 50 },
		],
	},
	{ accessorKey: "age", header: "Age", size: 80 },
];

describe("pure helpers", () => {
	it("merges header groups and resolves header spans", (): void => {
		const table = probeTable(GROUPED_COLUMNS);
		const groups = getDataGridTableMergedHeaderGroups(table);
		expect(groups).toHaveLength(2);
		const [groupRow, leafRow] = groups;
		expect(groupRow?.centerHeaders.map((header) => header.column.id)).toEqual(["person", "age"]);
		// Age heads both rows as one merged cell; the name header covers email.
		expect(leafRow?.centerHeaders.map((header) => header.column.id)).toEqual(["name"]);
		const nameHeader = leafRow?.centerHeaders.at(LIST_SLOT_INDEX.first);
		if (nameHeader === undefined) {
			throw new Error("no name header");
		}
		const covered = leafRow?.coveredHeaders.get(nameHeader.id) ?? [];
		expect(covered.map((header) => header.column.id)).toEqual(["email"]);
		expect(getDataGridHeadCellSizeVar(nameHeader)).toBe(`calc(var(--header-${nameHeader.id}-size) * 1px)`);
		expect(getDataGridHeadCellSizeVar(nameHeader, covered)).toBe(
			`calc((var(--header-${nameHeader.id}-size) + var(--header-${covered.at(LIST_SLOT_INDEX.first)?.id ?? ""}-size)) * 1px)`,
		);
		expect(getDataGridHeadCellResizeHeader(nameHeader, covered).column.id).toBe("email");
		expect(getDataGridHeadCellResizeHeader(nameHeader).column.id).toBe("name");
	});

	it("renders a header's content, including a merged placeholder's", (): void => {
		const table = probeTable(GROUPED_COLUMNS);
		const [groupRow] = getDataGridTableMergedHeaderGroups(table);
		const personHeader = groupRow?.centerHeaders.at(LIST_SLOT_INDEX.first);
		if (personHeader === undefined) {
			throw new Error("no header");
		}
		expect(renderDataGridTableHeadCellContent(personHeader)).toBe("Person");
		// Age heads both rows as a merged placeholder, which renders its column's header.
		const agePlaceholder = groupRow?.centerHeaders.at(LIST_SLOT_INDEX.second);
		if (agePlaceholder === undefined) {
			throw new Error("no merged header");
		}
		expect(agePlaceholder.isPlaceholder).toBe(true);
		expect(agePlaceholder.rowSpan).toBe(2);
		expect(renderDataGridTableHeadCellContent(agePlaceholder)).toBe("Age");
	});

	it("splits rows into pin sections and marks the pinned boundaries", (): void => {
		const table = probeTable(DATA_GRID_TEST_COLUMNS, { initialState: { rowPinning: { top: ["p-2"], bottom: ["p-4"] } } });
		const sections = getDataGridTableRowSections(table, true);
		expect(sections.topRows.map((row) => row.id)).toEqual(["p-2"]);
		expect(sections.bottomRows.map((row) => row.id)).toEqual(["p-4"]);
		expect(getDataGridTableRowSections(table, false).topRows).toHaveLength(0);
		const resolved = getDataGridTableResolvedRows(table, true);
		expect(resolved.map(({ row, pinnedBoundary }) => `${row.id}:${pinnedBoundary ?? "-"}`)).toEqual(["p-2:top", "p-1:-", "p-3:-", "p-5:-", "p-4:bottom"]);
	});

	it("computes pinning styles, edges and end-pinned presence", (): void => {
		const table = probeTable(DATA_GRID_TEST_COLUMNS, { initialState: { columnPinning: { start: ["email"], end: ["name"] } } });
		const email = table.getColumn("email");
		const age = table.getColumn("age");
		if (email === undefined || age === undefined) {
			throw new Error("missing columns");
		}
		expect(getPinningStyles(email)).toMatchObject({ position: "sticky", insetInlineStart: "0px" });
		expect(getPinningStyles(age)).toEqual({ width: age.getSize() });
		expect(hasDataGridTableRightPinnedColumns(table)).toBe(true);
		expect(getDataGridTableColumnEdges(table, "email")).toEqual({ isFirst: true, isLast: false });
		expect(getDataGridTableColumnEdges(table, "name")).toEqual({ isFirst: false, isLast: true });
		expect(hasDataGridTableRightPinnedColumns(probeTable(DATA_GRID_TEST_COLUMNS))).toBe(false);
	});

	it("indents tree rows by depth", (): void => {
		const table = probeTable(DATA_GRID_TEST_COLUMNS);
		const [row] = table.getRowModel().rows;
		if (row === undefined) {
			throw new Error("no row");
		}
		expect(getDataGridTreeIndentStyle(row)).toEqual({ "--data-grid-tree-padding": "0px" });
		expect(getDataGridTreeIndentStyle({ ...row, depth: 2 }, 12)).toEqual({ "--data-grid-tree-padding": "24px" });
	});

	it("finds only the scroll viewport inside its own grid", (): void => {
		document.body.innerHTML = `
			<div data-slot="scroll-area-viewport" id="page"><div data-slot="data-grid"><span id="outer-cell"></span></div></div>
			<div data-slot="data-grid"><div data-slot="scroll-area-viewport" id="own"><span id="inner-cell"></span></div></div>`;
		const inner = document.getElementById("inner-cell");
		const outer = document.getElementById("outer-cell");
		if (inner === null || outer === null) {
			throw new Error("fixture missing");
		}
		expect(getDataGridScrollAreaViewport(inner)?.id).toBe("own");
		expect(getDataGridScrollAreaViewport(outer)).toBeNull();
		document.body.innerHTML = "";
	});

	it("recognises events that only reached an element through a portal", (): void => {
		const host = document.createElement("div");
		const child = document.createElement("span");
		const elsewhere = document.createElement("span");
		host.append(child);
		document.body.append(host, elsewhere);
		expect(isDataGridPortalEvent({ currentTarget: host, target: child })).toBe(false);
		expect(isDataGridPortalEvent({ currentTarget: host, target: elsewhere })).toBe(true);
		expect(isDataGridPortalEvent({ currentTarget: host, target: null })).toBe(true);
		host.remove();
		elsewhere.remove();
	});
});

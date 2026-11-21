// @vitest-environment jsdom
import { LIST_SLOT_INDEX } from "@workspace/shared";
import {
	tableEngineFeatures,
	type TableEngineFeatures,
	type TableEngineRowStatus,
	type TableEngineCellStatus,
	type TableEngineTableInstance,
	type TableEngineTableLayout,
} from "../table-engine";
import {
	TableEngineTable,
	TableEngineTableBase,
	TableEngineTableBody,
	TableEngineTableFootRow,
	TableEngineTableFootRowCell,
	TableEngineTableHeader,
	TableEngineTableLoader,
	TableEngineTableRowExpand,
	TableEngineTableRowPin,
	TableEngineTableRowSelect,
	TableEngineTableRowSelectAll,
	getTableEngineHeadCellResizeHeader,
	getTableEngineHeadCellSizeVar,
	getTableEngineScrollAreaViewport,
	getTableEngineTableColumnEdges,
	getTableEngineTableMergedHeaderGroups,
	getTableEngineTableResolvedRows,
	getTableEngineTableRowSections,
	getTableEngineTreeIndentStyle,
	getPinningStyles,
	hasTableEngineTableRightPinnedColumns,
	isTableEnginePortalEvent,
	renderTableEngineTableHeadCellContent,
} from "../table-engine-table";
import {
	TABLE_ENGINE_TEST_COLUMNS,
	TABLE_ENGINE_TEST_PEOPLE,
	TableEngineResizeObserverStub,
	TableEngineTestHarness,
	type TableEngineTestPerson,
	type TableEngineTestTableOptions,
} from "../testing/table-engine-test-harness";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useTable, type ColumnDef } from "@tanstack/react-table";
import * as React from "react";
import { createPortal } from "react-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach((): void => {
	vi.stubGlobal("ResizeObserver", TableEngineResizeObserverStub);
});

afterEach((): void => {
	cleanup();
	vi.unstubAllGlobals();
});

type PersonColumn = ColumnDef<TableEngineFeatures, TableEngineTestPerson>;

/** Body rows only (the header row sits in the thead). */
function bodyRows(): HTMLElement[] {
	const [, ...rows] = screen.getAllByRole("row");
	return rows;
}

function firstCellTexts(): string[] {
	return bodyRows().map((row) => within(row).getAllByRole("cell").at(LIST_SLOT_INDEX.first)?.textContent ?? "");
}

const SORTED_BY_NAME_DESC: TableEngineTestTableOptions = { initialState: { sorting: [{ id: "name", desc: true }] } };

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

describe("TableEngineTable rendering", () => {
	it("renders a column header per leaf and a row per record", (): void => {
		render(
			<TableEngineTestHarness>
				<TableEngineTable />
			</TableEngineTestHarness>,
		);
		expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Name", "Email", "Age", "Role"]);
		expect(firstCellTexts()).toEqual(TABLE_ENGINE_TEST_PEOPLE.map((person) => person.name));
	});

	it("reflects the sorting state in aria-sort and re-sorts on a header click", (): void => {
		render(
			<TableEngineTestHarness columns={SORTABLE_COLUMNS} tableOptions={SORTED_BY_NAME_DESC}>
				<TableEngineTable />
			</TableEngineTestHarness>,
		);
		const [nameHeader, emailHeader, ageHeader] = screen.getAllByRole("columnheader");
		expect(nameHeader?.getAttribute("aria-sort")).toBe("descending");
		expect(emailHeader?.hasAttribute("aria-sort")).toBe(false);
		expect(ageHeader?.getAttribute("aria-sort")).toBe("none");
		expect(firstCellTexts().at(LIST_SLOT_INDEX.first)).toBe("Sarah Chen");

		// desc → unsorted (data order) → asc: the TanStack cycle for a text column that started descending.
		fireEvent.click(screen.getByRole("button", { name: "Name" }));
		expect(screen.getAllByRole("columnheader").at(LIST_SLOT_INDEX.first)?.getAttribute("aria-sort")).toBe("none");
		expect(firstCellTexts()).toEqual(TABLE_ENGINE_TEST_PEOPLE.map((person) => person.name));
		fireEvent.click(screen.getByRole("button", { name: "Name" }));
		expect(screen.getAllByRole("columnheader").at(LIST_SLOT_INDEX.first)?.getAttribute("aria-sort")).toBe("ascending");
		expect(firstCellTexts().at(LIST_SLOT_INDEX.first)).toBe("Alex Johnson");
	});

	it("shows the empty label, or the emptyMessage override", (): void => {
		const { rerender } = render(
			<TableEngineTestHarness data={[]}>
				<TableEngineTable />
			</TableEngineTestHarness>,
		);
		expect(screen.getByText("No data available")).toBeDefined();
		rerender(
			<TableEngineTestHarness data={[]} emptyMessage="Nobody yet">
				<TableEngineTable />
			</TableEngineTestHarness>,
		);
		expect(screen.getByText("Nobody yet")).toBeDefined();
	});

	it("renders one skeleton row per page slot while loading", (): void => {
		render(
			<TableEngineTestHarness isLoading tableOptions={SMALL_PAGE}>
				<TableEngineTable />
			</TableEngineTestHarness>,
		);
		expect(bodyRows()).toHaveLength(SMALL_PAGE_SIZE);
		expect(screen.queryByText("Alex Johnson")).toBeNull();
	});

	it("renders a status spinner with the loading label in spinner mode", (): void => {
		render(
			<TableEngineTestHarness isLoading loadingMode="spinner">
				<TableEngineTable />
			</TableEngineTestHarness>,
		);
		expect(screen.getByRole("status").textContent).toBe("Loading…");
	});

	it("renders the footer and can omit the header", (): void => {
		render(
			<TableEngineTestHarness>
				<TableEngineTable renderHeader={false} footerContent={FOOTER} />
			</TableEngineTestHarness>,
		);
		expect(screen.queryAllByRole("columnheader")).toHaveLength(0);
		expect(screen.getByText("Total").closest("tfoot")).not.toBeNull();
	});

	it("forwards its ref to the viewport and merges className last", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(
			<TableEngineTestHarness>
				<TableEngineTable ref={ref} className="extra-class" />
			</TableEngineTestHarness>,
		);
		expect(ref.current?.dataset.slot).toBe("table-engine-table-viewport");
		expect(ref.current?.className.endsWith("extra-class")).toBe(true);
	});

	it("renders a header-only table", (): void => {
		render(
			<TableEngineTestHarness>
				<TableEngineTableHeader />
			</TableEngineTestHarness>,
		);
		expect(screen.getAllByRole("columnheader")).toHaveLength(TABLE_ENGINE_TEST_COLUMNS.length);
		expect(screen.queryByText("Alex Johnson")).toBeNull();
	});

	it("shows the floating loader with the loading label", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(
			<TableEngineTestHarness loadingMessage="Fetching people">
				<TableEngineTableLoader ref={ref} className="loader-class" />
			</TableEngineTestHarness>,
		);
		expect(screen.getByRole("status").textContent).toBe("Fetching people");
		expect(ref.current?.className).toContain("loader-class");
	});
});

const SMALL_PAGE_SIZE = 3;
const SMALL_PAGE: TableEngineTestTableOptions = { initialState: { pagination: { pageIndex: 0, pageSize: SMALL_PAGE_SIZE } } };

const FOOTER = (
	<TableEngineTableFootRow>
		<TableEngineTableFootRowCell colSpan={TABLE_ENGINE_TEST_COLUMNS.length}>Total</TableEngineTableFootRowCell>
	</TableEngineTableFootRow>
);

function PortalButton(): React.ReactPortal {
	return createPortal(<button type="button">portal pick</button>, document.body);
}

const INTERACTIVE_COLUMNS: PersonColumn[] = [
	{ id: "select", header: () => <TableEngineTableRowSelectAll />, cell: ({ row }) => <TableEngineTableRowSelect row={row} /> },
	{ accessorKey: "name", header: "Name" },
	{ id: "portal", header: "Portal", cell: () => <PortalButton /> },
];

describe("row interactions", () => {
	it("fires onRowClick with the row, but not for checkbox or portalled clicks", (): void => {
		const onRowClick = vi.fn();
		render(
			<TableEngineTestHarness columns={INTERACTIVE_COLUMNS} data={TABLE_ENGINE_TEST_PEOPLE.slice(0, 1)} onRowClick={onRowClick}>
				<TableEngineTable />
			</TableEngineTestHarness>,
		);
		fireEvent.click(screen.getByText("Alex Johnson"));
		expect(onRowClick).toHaveBeenCalledTimes(1);
		expect(onRowClick).toHaveBeenCalledWith(TABLE_ENGINE_TEST_PEOPLE.at(LIST_SLOT_INDEX.first));
		expect(screen.getByText("Alex Johnson").closest("tr")?.className).toContain("cursor-pointer");

		fireEvent.click(screen.getByRole("checkbox", { name: "Select row" }));
		fireEvent.click(screen.getByRole("button", { name: "portal pick" }));
		expect(onRowClick).toHaveBeenCalledTimes(1);
	});

	it("toggles one row and every page row through the selection checkboxes", (): void => {
		render(
			<TableEngineTestHarness columns={INTERACTIVE_COLUMNS}>
				<TableEngineTable />
			</TableEngineTestHarness>,
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
			<TableEngineTestHarness columns={INTERACTIVE_COLUMNS} data={[]}>
				<TableEngineTable />
			</TableEngineTestHarness>,
		);
		// The kit's checkbox is a native <button>, so it is really disabled (no focus, no presses), not only marked aria-disabled.
		expect(screen.getByRole("checkbox", { name: "Select all" }).matches(":disabled")).toBe(true);
	});

	it("expands a row into its detail content", (): void => {
		render(
			<TableEngineTestHarness columns={EXPAND_COLUMNS} data={TABLE_ENGINE_TEST_PEOPLE.slice(0, 1)} tableOptions={EXPANDABLE}>
				<TableEngineTable />
			</TableEngineTestHarness>,
		);
		expect(screen.queryByText("Details of alex@example.com")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "Expand row" }));
		expect(screen.getByText("Details of alex@example.com")).toBeDefined();
		expect(screen.getByRole("button", { name: "Collapse row" }).getAttribute("aria-expanded")).toBe("true");
	});

	it("pins a row to the top and unpins it", (): void => {
		render(
			<TableEngineTestHarness columns={PIN_COLUMNS} tableLayout={ROWS_PINNABLE}>
				<TableEngineTable />
			</TableEngineTestHarness>,
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
			<TableEngineTestHarness getRowStatus={statusOfRow} getCellStatus={statusOfCell}>
				<TableEngineTable />
			</TableEngineTestHarness>,
		);
		const rowOfMichael = screen.getByText("Michael Rodriguez").closest("tr");
		expect(rowOfMichael?.dataset.rowStatus).toBe("deleted");
		expect(screen.getByText("sarah@example.com").closest("td")?.dataset.cellStatus).toBe("invalid");
		expect(screen.getByText("Alex Johnson").closest("tr")?.dataset.rowStatus).toBeUndefined();
	});

	it("renders the add-row affordance and calls onRowCreate", (): void => {
		const onRowCreate = vi.fn();
		const { rerender } = render(
			<TableEngineTestHarness onRowCreate={onRowCreate}>
				<TableEngineTable />
			</TableEngineTestHarness>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Add row" }));
		expect(onRowCreate).toHaveBeenCalledTimes(1);
		rerender(
			<TableEngineTestHarness onRowCreate={onRowCreate} rowCreateLabel="New person">
				<TableEngineTable />
			</TableEngineTestHarness>,
		);
		expect(screen.getByRole("button", { name: "New person" })).toBeDefined();
	});
});

const EXPANDABLE: TableEngineTestTableOptions = { getRowCanExpand: (): boolean => true };

function renderDetails(row: TableEngineTestPerson): React.ReactNode {
	return `Details of ${row.email}`;
}

const EXPAND_COLUMNS: PersonColumn[] = [
	{ id: "expand", header: "", cell: ({ row }) => <TableEngineTableRowExpand row={row} />, meta: { expandedContent: renderDetails } },
	{ accessorKey: "name", header: "Name" },
];

const PIN_COLUMNS: PersonColumn[] = [{ id: "pin", header: "", cell: ({ row }) => <TableEngineTableRowPin row={row} /> }, ...TABLE_ENGINE_TEST_COLUMNS];

const ROWS_PINNABLE: TableEngineTableLayout = { rowsPinnable: true };

function statusOfRow(row: TableEngineTestPerson): TableEngineRowStatus | undefined {
	return row.id === "p-3" ? "deleted" : undefined;
}

function statusOfCell(row: TableEngineTestPerson, columnId: string): TableEngineCellStatus | undefined {
	return row.id === "p-2" && columnId === "email" ? "invalid" : undefined;
}

const PINNABLE: TableEngineTableLayout = { columnsPinnable: true };
const NAME_PINNED_START: TableEngineTestTableOptions = { initialState: { columnPinning: { start: ["name"], end: [] } } };
const RESIZABLE: TableEngineTableLayout = { columnsResizable: true };
const RESIZABLE_PINNABLE: TableEngineTableLayout = { columnsResizable: true, columnsPinnable: true };
const LIVE_RESIZABLE: TableEngineTableLayout = { columnsResizable: true, columnsResizeMode: "onChange" };
/** The harness columns' sizes (`TABLE_ENGINE_TEST_COLUMNS`). */
const NAME_SIZE = 160;
const EMAIL_SIZE = 200;
const AGE_SIZE = 80;
const ROLE_SIZE = 120;
/** The harness columns with Email marked to take all the spare width. */
const EMAIL_FILLS_COLUMNS: ColumnDef<TableEngineFeatures, TableEngineTestPerson>[] = TABLE_ENGINE_TEST_COLUMNS.map(
	(column): ColumnDef<TableEngineFeatures, TableEngineTestPerson> => (column.header === "Email" ? { ...column, meta: { ...column.meta, fillWidth: true } } : column),
);
const ROLE_PINNED_END: TableEngineTestTableOptions = { initialState: { columnPinning: { start: [], end: ["role"] } } };
const CELL_SELECTION: TableEngineTableLayout = { cellSelection: true };

describe("column layout", () => {
	it("makes a pinned column sticky when pinning is enabled", (): void => {
		render(
			<TableEngineTestHarness tableLayout={PINNABLE} tableOptions={NAME_PINNED_START}>
				<TableEngineTable />
			</TableEngineTestHarness>,
		);
		const [nameHeader] = screen.getAllByRole("columnheader");
		expect(nameHeader?.dataset.pinned).toBe("start");
		expect(nameHeader?.style.position).toBe("sticky");
		expect(screen.getByText("Alex Johnson").closest("td")?.style.position).toBe("sticky");
	});

	it("writes column size variables and resizes through the handle", (): void => {
		render(
			<TableEngineTestHarness tableLayout={RESIZABLE}>
				<TableEngineTable />
			</TableEngineTestHarness>,
		);
		const table = screen.getByRole("table");
		// The header variable is the column's own size; the column variable adds its share of the spare width.
		expect(table.style.getPropertyValue("--header-name-size")).toBe("160");
		const handle = screen.getByRole("button", { name: "Resize Name column" });

		fireEvent.mouseDown(handle, { button: 0, clientX: 100 });
		fireEvent.mouseMove(document, { clientX: 140 });
		fireEvent.mouseUp(document, { clientX: 140 });
		expect(table.style.getPropertyValue("--header-name-size")).toBe("200");

		fireEvent.doubleClick(handle);
		expect(table.style.getPropertyValue("--header-name-size")).toBe("160");

		fireEvent.keyDown(handle, { key: "ArrowRight" });
		expect(table.style.getPropertyValue("--header-name-size")).toBe("170");
		fireEvent.keyDown(handle, { key: "ArrowLeft" });
		expect(table.style.getPropertyValue("--header-name-size")).toBe("160");
	});

	it("spreads the spare width over every data column by its width, so the table spans its container with no empty strip", (): void => {
		render(
			<TableEngineTestHarness tableLayout={RESIZABLE}>
				<TableEngineTable />
			</TableEngineTestHarness>,
		);
		const table = screen.getByRole("table");
		const totalSize = NAME_SIZE + EMAIL_SIZE + AGE_SIZE + ROLE_SIZE;
		expect(table.style.getPropertyValue("--col-name-size")).toBe(`calc(${String(NAME_SIZE)} + var(--table-engine-fill, 0) * ${String(NAME_SIZE / totalSize)})`);
		expect(table.style.getPropertyValue("--col-role-size")).toBe(`calc(${String(ROLE_SIZE)} + var(--table-engine-fill, 0) * ${String(ROLE_SIZE / totalSize)})`);
		// The fill strip collapses: the columns hold the space instead.
		expect(document.querySelector<HTMLElement>('[data-slot="table-engine-table-fill-col"]')?.style.width).toBe("0px");
	});

	it("keeps a column pinned to the end at its own size, and shares the spare width among the unpinned ones", (): void => {
		render(
			<TableEngineTestHarness tableLayout={RESIZABLE_PINNABLE} tableOptions={ROLE_PINNED_END}>
				<TableEngineTable />
			</TableEngineTestHarness>,
		);
		const table = screen.getByRole("table");
		const unpinnedSize = NAME_SIZE + EMAIL_SIZE + AGE_SIZE;
		expect(table.style.getPropertyValue("--col-role-size")).toBe(String(ROLE_SIZE));
		expect(table.style.getPropertyValue("--col-age-size")).toBe(`calc(${String(AGE_SIZE)} + var(--table-engine-fill, 0) * ${String(AGE_SIZE / unpinnedSize)})`);
	});

	it("gives all the spare width to a meta.fillWidth column", (): void => {
		render(
			<TableEngineTestHarness tableLayout={RESIZABLE} columns={EMAIL_FILLS_COLUMNS}>
				<TableEngineTable />
			</TableEngineTestHarness>,
		);
		const table = screen.getByRole("table");
		expect(table.style.getPropertyValue("--col-email-size")).toBe(`calc(${String(EMAIL_SIZE)} + var(--table-engine-fill, 0) * 1)`);
		expect(table.style.getPropertyValue("--col-name-size")).toBe(String(NAME_SIZE));
	});

	it("draws a live drag's guide down the table while the drag runs, and only then", (): void => {
		render(
			<TableEngineTestHarness tableLayout={LIVE_RESIZABLE}>
				<TableEngineTable />
			</TableEngineTestHarness>,
		);
		const table = screen.getByRole("table");
		const handle = screen.getByRole("button", { name: "Resize Name column" });
		expect(table.style.getPropertyValue("--table-engine-resize-guide")).toBe("");

		fireEvent.mouseDown(handle, { button: 0, clientX: 100 });
		// jsdom lays nothing out, so the measured height is 0; what matters is that the drag sets it.
		expect(table.style.getPropertyValue("--table-engine-resize-guide")).toBe("0px");

		fireEvent.mouseUp(document, { clientX: 140 });
		expect(table.style.getPropertyValue("--table-engine-resize-guide")).toBe("");
	});

	it("marks each edge with a soft divider at rest, and the full edge in the primary colour on hover", (): void => {
		render(
			<TableEngineTestHarness tableLayout={RESIZABLE}>
				<TableEngineTable />
			</TableEngineTestHarness>,
		);
		const classes = screen.getByRole("button", { name: "Resize Name column" }).className.split(" ");
		expect(classes).toEqual(expect.arrayContaining(["before:h-4", "before:bg-border", "hover:before:h-full", "hover:before:bg-primary"]));
		// After the last column there is no boundary to mark.
		expect(screen.getByRole("button", { name: "Resize Role column" }).className.split(" ")).toContain("before:bg-transparent");
	});

	it("ignores a secondary-button press on the resize handle", (): void => {
		render(
			<TableEngineTestHarness tableLayout={RESIZABLE}>
				<TableEngineTable />
			</TableEngineTestHarness>,
		);
		const handle = screen.getByRole("button", { name: "Resize Name column" });
		fireEvent.mouseDown(handle, { button: 2, clientX: 100 });
		fireEvent.mouseUp(document, { clientX: 300 });
		expect(screen.getByRole("table").style.getPropertyValue("--header-name-size")).toBe("160");
	});

	it("announces a grid of selectable cells with cell selection on", (): void => {
		render(
			<TableEngineTestHarness tableLayout={CELL_SELECTION}>
				<TableEngineTable />
			</TableEngineTestHarness>,
		);
		const grid = screen.getByRole("grid");
		expect(grid.getAttribute("aria-multiselectable")).toBe("true");
		expect(grid.getAttribute("aria-rowcount")).toBe(String(TABLE_ENGINE_TEST_PEOPLE.length + 1));
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
			<TableEngineTestHarness>
				<TableEngineTableBase ref={tableRef} className="base-class">
					<TableEngineTableBody ref={bodyRef} className="body-class" />
				</TableEngineTableBase>
			</TableEngineTestHarness>,
		);
		expect(tableRef.current?.dataset.slot).toBe("table-engine-table");
		expect(tableRef.current?.className.endsWith("base-class")).toBe(true);
		expect(bodyRef.current?.className.endsWith("body-class")).toBe(true);
		expect(tableRef.current?.querySelectorAll("col")).toHaveLength(TABLE_ENGINE_TEST_COLUMNS.length);
	});
});

// ── Pure helpers ───────────────────────────────────────────────────────────

function TableProbe({
	columns,
	options,
	onTable,
}: {
	readonly columns: PersonColumn[];
	readonly options: TableEngineTestTableOptions;
	readonly onTable: (table: TableEngineTableInstance<TableEngineTestPerson>) => void;
}): null {
	onTable(
		useTable({
			getRowId: (row: TableEngineTestPerson): string => row.id,
			...options,
			features: tableEngineFeatures,
			columns,
			data: [...TABLE_ENGINE_TEST_PEOPLE],
		}),
	);
	return null;
}

function probeTable(columns: PersonColumn[], options: TableEngineTestTableOptions = {}): TableEngineTableInstance<TableEngineTestPerson> {
	const tables: TableEngineTableInstance<TableEngineTestPerson>[] = [];
	function keep(table: TableEngineTableInstance<TableEngineTestPerson>): void {
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
		const groups = getTableEngineTableMergedHeaderGroups(table);
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
		expect(getTableEngineHeadCellSizeVar(nameHeader)).toBe(`calc(var(--header-${nameHeader.id}-size) * 1px)`);
		expect(getTableEngineHeadCellSizeVar(nameHeader, covered)).toBe(
			`calc((var(--header-${nameHeader.id}-size) + var(--header-${covered.at(LIST_SLOT_INDEX.first)?.id ?? ""}-size)) * 1px)`,
		);
		expect(getTableEngineHeadCellResizeHeader(nameHeader, covered).column.id).toBe("email");
		expect(getTableEngineHeadCellResizeHeader(nameHeader).column.id).toBe("name");
	});

	it("renders a header's content, including a merged placeholder's", (): void => {
		const table = probeTable(GROUPED_COLUMNS);
		const [groupRow] = getTableEngineTableMergedHeaderGroups(table);
		const personHeader = groupRow?.centerHeaders.at(LIST_SLOT_INDEX.first);
		if (personHeader === undefined) {
			throw new Error("no header");
		}
		expect(renderTableEngineTableHeadCellContent(personHeader)).toBe("Person");
		// Age heads both rows as a merged placeholder, which renders its column's header.
		const agePlaceholder = groupRow?.centerHeaders.at(LIST_SLOT_INDEX.second);
		if (agePlaceholder === undefined) {
			throw new Error("no merged header");
		}
		expect(agePlaceholder.isPlaceholder).toBe(true);
		expect(agePlaceholder.rowSpan).toBe(2);
		expect(renderTableEngineTableHeadCellContent(agePlaceholder)).toBe("Age");
	});

	it("splits rows into pin sections and marks the pinned boundaries", (): void => {
		const table = probeTable(TABLE_ENGINE_TEST_COLUMNS, { initialState: { rowPinning: { top: ["p-2"], bottom: ["p-4"] } } });
		const sections = getTableEngineTableRowSections(table, true);
		expect(sections.topRows.map((row) => row.id)).toEqual(["p-2"]);
		expect(sections.bottomRows.map((row) => row.id)).toEqual(["p-4"]);
		expect(getTableEngineTableRowSections(table, false).topRows).toHaveLength(0);
		const resolved = getTableEngineTableResolvedRows(table, true);
		expect(resolved.map(({ row, pinnedBoundary }) => `${row.id}:${pinnedBoundary ?? "-"}`)).toEqual(["p-2:top", "p-1:-", "p-3:-", "p-5:-", "p-4:bottom"]);
	});

	it("computes pinning styles, edges and end-pinned presence", (): void => {
		const table = probeTable(TABLE_ENGINE_TEST_COLUMNS, { initialState: { columnPinning: { start: ["email"], end: ["name"] } } });
		const email = table.getColumn("email");
		const age = table.getColumn("age");
		if (email === undefined || age === undefined) {
			throw new Error("missing columns");
		}
		expect(getPinningStyles(email)).toMatchObject({ position: "sticky", insetInlineStart: "0px" });
		expect(getPinningStyles(age)).toEqual({ width: age.getSize() });
		expect(hasTableEngineTableRightPinnedColumns(table)).toBe(true);
		expect(getTableEngineTableColumnEdges(table, "email")).toEqual({ isFirst: true, isLast: false });
		expect(getTableEngineTableColumnEdges(table, "name")).toEqual({ isFirst: false, isLast: true });
		expect(hasTableEngineTableRightPinnedColumns(probeTable(TABLE_ENGINE_TEST_COLUMNS))).toBe(false);
	});

	it("indents tree rows by depth", (): void => {
		const table = probeTable(TABLE_ENGINE_TEST_COLUMNS);
		const [row] = table.getRowModel().rows;
		if (row === undefined) {
			throw new Error("no row");
		}
		expect(getTableEngineTreeIndentStyle(row)).toEqual({ "--table-engine-tree-padding": "0px" });
		expect(getTableEngineTreeIndentStyle({ ...row, depth: 2 }, 12)).toEqual({ "--table-engine-tree-padding": "24px" });
	});

	it("finds only the scroll viewport inside its own grid", (): void => {
		document.body.innerHTML = `
			<div data-slot="scroll-area-viewport" id="page"><div data-slot="table-engine"><span id="outer-cell"></span></div></div>
			<div data-slot="table-engine"><div data-slot="scroll-area-viewport" id="own"><span id="inner-cell"></span></div></div>`;
		const inner = document.getElementById("inner-cell");
		const outer = document.getElementById("outer-cell");
		if (inner === null || outer === null) {
			throw new Error("fixture missing");
		}
		expect(getTableEngineScrollAreaViewport(inner)?.id).toBe("own");
		expect(getTableEngineScrollAreaViewport(outer)).toBeNull();
		document.body.innerHTML = "";
	});

	it("recognises events that only reached an element through a portal", (): void => {
		const host = document.createElement("div");
		const child = document.createElement("span");
		const elsewhere = document.createElement("span");
		host.append(child);
		document.body.append(host, elsewhere);
		expect(isTableEnginePortalEvent({ currentTarget: host, target: child })).toBe(false);
		expect(isTableEnginePortalEvent({ currentTarget: host, target: elsewhere })).toBe(true);
		expect(isTableEnginePortalEvent({ currentTarget: host, target: null })).toBe(true);
		host.remove();
		elsewhere.remove();
	});
});

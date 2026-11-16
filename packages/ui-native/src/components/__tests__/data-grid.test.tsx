import { useTable, type ColumnDef, type ColumnPinningState, type ExpandedState, type PaginationState, type TableOptions } from "@tanstack/react-table";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import UserIcon from "lucide-react-native/icons/user";
import { Text } from "react-native";

import {
	dataGridFeatures,
	dataGridValueText,
	type DataGridCellsChangeDetails,
	type DataGridCopyDetails,
	type DataGridFeatures,
	type DataGridTableLayout,
} from "../../lib/data-grid";
import { SHEET_MOTION } from "../../lib/motion";
import {
	DataGrid,
	DataGridContainer,
	DataGridTable,
	useDataGrid,
	type DataGridFootRow,
	type DataGridProps,
	type DataGridRowMove,
	type DataGridTableProps,
} from "../data-grid";
import {
	DataGridColumnHeader,
	DataGridColumnVisibility,
	DataGridPagination,
	DataGridRowExpand,
	DataGridRowHandle,
	DataGridRowPin,
	DataGridRowSelect,
	DataGridRowSelectAll,
} from "../data-grid-parts";

interface Person {
	readonly id: string;
	readonly name: string;
	readonly role: string;
	readonly balance: number;
	readonly reports?: readonly Person[];
}

const PEOPLE: readonly Person[] = [
	{ id: "p1", name: "Ada", role: "Engineer", balance: 300 },
	{ id: "p2", name: "Grace", role: "Admiral", balance: 100, reports: [{ id: "p2a", name: "Hedy", role: "Inventor", balance: 50 }] },
	{ id: "p3", name: "Alan", role: "Analyst", balance: 200 },
];

const HEADED: ColumnDef<DataGridFeatures, Person>[] = [
	{
		accessorKey: "name",
		header: ({ column }) => <DataGridColumnHeader column={column} visibility />,
		meta: { headerTitle: "Name", cellEdit: { parse: (raw: string): string => raw } },
	},
	{ accessorKey: "role", header: ({ column }) => <DataGridColumnHeader column={column} title="Role" />, meta: { headerTitle: "Role", cellEdit: {} } },
	{
		accessorKey: "balance",
		header: "Balance",
		size: 120,
		enableResizing: true,
		minSize: 60,
		meta: {
			align: "end",
			expandedContent: (row: Person): string => `${row.name}'s ledger`,
			cellEdit: { parse: (raw: string): number | undefined => (raw === "" ? undefined : Number(raw)), control: "number", clearValue: 0 },
		},
	},
];

interface HarnessProps {
	readonly columns?: ColumnDef<DataGridFeatures, Person>[];
	readonly data?: readonly Person[];
	readonly layout?: DataGridTableLayout;
	readonly grid?: Partial<Omit<DataGridProps<Person>, "table" | "recordCount" | "children">>;
	readonly tableProps?: DataGridTableProps;
	readonly pinning?: ColumnPinningState;
	readonly pageSize?: number;
	readonly options?: Partial<TableOptions<DataGridFeatures, Person>>;
	readonly withPager?: boolean;
	readonly withVisibility?: boolean;
}

function Harness({
	columns = HEADED,
	data = PEOPLE,
	layout,
	grid,
	tableProps,
	pinning,
	pageSize = 10,
	options,
	withPager = false,
	withVisibility = false,
}: HarnessProps): React.JSX.Element {
	const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize });
	const [expanded, setExpanded] = React.useState<ExpandedState>({});
	const table = useTable({
		features: dataGridFeatures,
		columns,
		data,
		getRowId: (row: Person): string => row.id,
		getSubRows: (row: Person): readonly Person[] | undefined => row.reports,
		getRowCanExpand: (): boolean => true,
		state: { pagination, expanded },
		onPaginationChange: setPagination,
		onExpandedChange: setExpanded,
		initialState: { columnPinning: pinning ?? { start: [], end: [] } },
		...options,
	});
	return (
		<DataGrid table={table} recordCount={data.length} tableLayout={layout} {...grid}>
			<DataGridContainer>
				{withVisibility ? <DataGridColumnVisibility /> : null}
				<DataGridTable testID="grid" {...tableProps} />
			</DataGridContainer>
			{withPager ? <DataGridPagination sizes={[2, 10]} hideSizes={data.length === 0} className="mt-2" /> : null}
		</DataGrid>
	);
}

/** A finger on a header or a handle. */
function touch(dx: number, timestamp: number): object {
	const record = {
		touchActive: true,
		startPageX: 0,
		startPageY: 0,
		startTimeStamp: 0,
		currentPageX: dx,
		currentPageY: 0,
		currentTimeStamp: timestamp,
		previousPageX: 0,
		previousPageY: 0,
		previousTimeStamp: 0,
	};
	return {
		nativeEvent: { locationX: dx, locationY: 0, pageX: dx, pageY: 0, touches: [{ pageX: dx, pageY: 0 }], changedTouches: [{ pageX: dx, pageY: 0 }], timestamp },
		touchHistory: { indexOfSingleActiveTouch: 0, mostRecentTimeStamp: timestamp, numberActiveTouches: 1, touchBank: [record] },
	};
}

async function settle(): Promise<void> {
	await act((): void => {
		jest.advanceTimersByTime(SHEET_MOTION.exit.duration);
	});
}

/** The text of every cell, row by row, in the order drawn. */
function names(): readonly string[] {
	return screen.getAllByText(/^(Ada|Grace|Alan|Hedy)$/u).map((node) => String(node.props.children));
}

/** The values of the last batch of cell changes the grid asked for. */
function lastValues(onCellsChange: jest.Mock<undefined, [DataGridCellsChangeDetails<Person>]>): readonly string[] {
	const [details] = onCellsChange.mock.lastCall ?? [];
	return details?.changes.map((change) => dataGridValueText(change.value)) ?? [];
}

beforeEach((): void => {
	jest.useFakeTimers();
});

afterEach((): void => {
	jest.useRealTimers();
});

describe("DataGrid", () => {
	it("draws headers and rows, and steps a column's sort from its header", async () => {
		await render(<Harness />);
		expect(screen.getByText("Balance")).toBeOnTheScreen();
		expect(names()).toEqual(["Ada", "Grace", "Alan"]);

		const role = screen.getByRole("button", { name: "Role" });
		await fireEvent.press(role);
		expect(screen.getByRole("button", { name: "Role" })).toHaveProp("accessibilityValue", { text: "Asc" });
		expect(names()).toEqual(["Grace", "Alan", "Ada"]);
		await fireEvent.press(screen.getByRole("button", { name: "Role" }));
		expect(screen.getByRole("button", { name: "Role" })).toHaveProp("accessibilityValue", { text: "Desc" });
		expect(names()).toEqual(["Ada", "Alan", "Grace"]);
		await fireEvent.press(screen.getByRole("button", { name: "Role" }));
		expect(names()).toEqual(["Ada", "Grace", "Alan"]);
	});

	it("opens a header's menu to sort, pin, move and hide columns", async () => {
		await render(<Harness layout={{ columnsPinnable: true, columnsMovable: true, columnsVisibility: true }} />);
		const header = screen.getByRole("button", { name: "Name" });
		expect(header).toHaveProp("accessibilityHint", "Name column options");

		await fireEvent.press(header);
		await fireEvent.press(screen.getByRole("radio", { name: "Desc" }));
		await settle();
		expect(names()).toEqual(["Grace", "Alan", "Ada"]);

		await fireEvent.press(screen.getByRole("button", { name: "Name" }));
		await fireEvent.press(screen.getByRole("menuitem", { name: "Move to right" }));
		await settle();
		await fireEvent.press(screen.getByRole("button", { name: "Name" }));
		await fireEvent.press(screen.getByRole("menuitem", { name: "Move to right" }));
		await settle();
		await fireEvent.press(screen.getByRole("button", { name: "Name" }));
		expect(screen.getByRole("menuitem", { name: "Move to right" })).toBeDisabled();
		await fireEvent.press(screen.getByRole("menuitem", { name: "Pin to left" }));
		await settle();
		await fireEvent.press(screen.getByRole("button", { name: "Name" }));
		await fireEvent.press(screen.getByRole("menuitem", { name: "Unpin Name column" }));
		await settle();
		await fireEvent.press(screen.getByRole("button", { name: "Name" }));
		await fireEvent.press(screen.getByRole("menuitem", { name: "Pin to right" }));
		await settle();
		await fireEvent.press(screen.getByRole("button", { name: "Name" }));
		await fireEvent.press(screen.getByRole("radio", { name: "Asc" }));
		await settle();
		expect(names()).toEqual(["Ada", "Alan", "Grace"]);

		await fireEvent.press(screen.getByRole("button", { name: "Name" }));
		await fireEvent.press(screen.getByRole("menuitem", { name: "Columns" }));
		await fireEvent.press(screen.getByRole("checkbox", { name: "Balance" }));
		expect(screen.queryByText("300")).toBeNull();
	});

	it("pins columns to either edge and draws them in their blocks", async () => {
		await render(<Harness pinning={{ start: ["name"], end: ["balance"] }} layout={{ cellBorder: true, dense: true, stripped: true, headerBackground: true }} />);
		expect(names()).toEqual(["Ada", "Grace", "Alan"]);
		expect(screen.getByText("300")).toBeOnTheScreen();
	});

	it("shares the width between columns under an auto layout", async () => {
		await render(<Harness layout={{ width: "auto", rowRounded: true }} pinning={{ start: ["name"], end: [] }} />);
		expect(screen.getByText("Ada")).toBeOnTheScreen();
	});

	it("pages through the rows and changes the page size", async () => {
		await render(<Harness pageSize={2} withPager />);
		expect(screen.getByText("1 - 2 of 3")).toBeOnTheScreen();
		expect(names()).toEqual(["Ada", "Grace"]);
		await fireEvent.press(screen.getByRole("button", { name: /Next/u }));
		expect(names()).toEqual(["Alan"]);
		expect(screen.getByText("3 - 3 of 3")).toBeOnTheScreen();

		await fireEvent.press(screen.getByRole("button", { name: "2" }));
		await fireEvent.press(screen.getByRole("radio", { name: "10" }));
		await settle();
		expect(screen.getByText("1 - 3 of 3")).toBeOnTheScreen();
	});

	it("selects rows one by one or the whole page", async () => {
		const columns: ColumnDef<DataGridFeatures, Person>[] = [
			{ id: "select", header: () => <DataGridRowSelectAll />, cell: ({ row }) => <DataGridRowSelect row={row} /> },
			{ accessorKey: "name", header: "Name" },
		];
		await render(<Harness columns={columns} />);
		const all = screen.getByRole("checkbox", { name: "Select all" });
		await fireEvent.press(screen.getAllByRole("checkbox", { name: "Select row" }).at(0) ?? all);
		expect(screen.getByRole("checkbox", { name: "Select all" })).toHaveProp("accessibilityState", expect.objectContaining({ checked: "mixed" }));
		await fireEvent.press(screen.getByRole("checkbox", { name: "Select all" }));
		expect(screen.getByRole("checkbox", { name: "Select all" })).toHaveProp("accessibilityState", expect.objectContaining({ checked: true }));
	});

	it("expands a row into its detail and its child rows, and reports a tapped row", async () => {
		const onRowPress = jest.fn();
		const columns: ColumnDef<DataGridFeatures, Person>[] = [{ id: "expand", header: "", cell: ({ row }) => <DataGridRowExpand row={row} /> }, ...HEADED];
		await render(<Harness columns={columns} grid={{ onRowPress }} />);
		const [first, second] = screen.getAllByRole("button", { name: "Expand row" });
		if (first === undefined || second === undefined) {
			throw new Error("Every row can expand.");
		}
		await fireEvent.press(second);
		expect(screen.getByText("Grace's ledger")).toBeOnTheScreen();
		expect(screen.getByText("Hedy")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Collapse row" }));
		expect(screen.queryByText("Hedy")).toBeNull();

		await fireEvent.press(screen.getByRole("button", { name: "Alan" }));
		expect(onRowPress).toHaveBeenCalledWith(expect.objectContaining({ id: "p3" }));
	});

	it("keeps pinned rows above the rest", async () => {
		const columns: ColumnDef<DataGridFeatures, Person>[] = [
			{ id: "pin", header: "", cell: ({ row }) => <DataGridRowPin row={row} /> },
			{ accessorKey: "name", header: "Name" },
		];
		await render(<Harness columns={columns} layout={{ rowsPinnable: true }} />);
		const pins = screen.getAllByRole("button", { name: "Pin row" });
		await fireEvent.press(pins.at(-1) ?? pins.at(0) ?? screen.getByText("Ada"));
		expect(names()).toEqual(["Alan", "Ada", "Grace"]);
		await fireEvent.press(screen.getByRole("button", { name: "Unpin row" }));
		expect(names()).toEqual(["Ada", "Grace", "Alan"]);
	});

	it("shows placeholder rows or a spinner while loading, and the empty message", async () => {
		const columns: ColumnDef<DataGridFeatures, Person>[] = [
			{ accessorKey: "name", header: "Name", meta: { skeleton: <Text>…name</Text> } },
			{ accessorKey: "role", header: "Role" },
		];
		const { rerender } = await render(<Harness columns={columns} grid={{ isLoading: true }} pageSize={2} />);
		expect(screen.getAllByText("…name")).toHaveLength(2);

		await rerender(<Harness columns={columns} grid={{ isLoading: true, loadingMode: "spinner", loadingMessage: "Fetching people" }} />);
		expect(screen.getByText("Fetching people")).toBeOnTheScreen();

		await rerender(<Harness columns={columns} data={[]} grid={{ emptyMessage: "Nobody yet" }} />);
		expect(screen.getByText("Nobody yet")).toBeOnTheScreen();
		await rerender(<Harness columns={columns} data={[]} />);
		expect(screen.getByText("No data available")).toBeOnTheScreen();
	});

	it("draws footer rows whose cells span columns", async () => {
		const footer: readonly DataGridFootRow[] = [
			{
				key: "total",
				cells: [
					{ key: "label", span: 2, content: "Total" },
					{ key: "sum", content: 600, align: "end" },
				],
			},
		];
		await render(<Harness tableProps={{ footer }} layout={{ footerBackground: true }} />);
		expect(screen.getByText("Total")).toBeOnTheScreen();
		expect(screen.getByText("600")).toBeOnTheScreen();
	});

	it("resizes a column by dragging its handle or stepping it, within its bounds", async () => {
		await render(<Harness layout={{ columnsResizable: true }} />);
		const handle = screen.getByLabelText("Resize Balance column");
		expect(handle).toHaveProp("accessibilityValue", { min: 60, max: 640, now: 120 });
		await fireEvent(handle, "responderGrant", touch(0, 1));
		await fireEvent(handle, "responderMove", touch(40, 2));
		expect(screen.getByLabelText("Resize Balance column")).toHaveProp("accessibilityValue", expect.objectContaining({ now: 160 }));
		await fireEvent(screen.getByLabelText("Resize Balance column"), "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
		expect(screen.getByLabelText("Resize Balance column")).toHaveProp("accessibilityValue", expect.objectContaining({ now: 144 }));
		await fireEvent(screen.getByLabelText("Resize Balance column"), "accessibilityAction", { nativeEvent: { actionName: "increment" } });
		expect(screen.getByLabelText("Resize Balance column")).toHaveProp("accessibilityValue", expect.objectContaining({ now: 160 }));
		await fireEvent(screen.getByLabelText("Resize Balance column"), "responderGrant", touch(0, 3));
		await fireEvent(screen.getByLabelText("Resize Balance column"), "responderMove", touch(-500, 4));
		expect(screen.getByLabelText("Resize Balance column")).toHaveProp("accessibilityValue", expect.objectContaining({ now: 60 }));
	});

	it("moves a column by its grip, past each neighbour whose middle it crossed, or a place at a time by action", async () => {
		const columns: ColumnDef<DataGridFeatures, Person>[] = [
			{ accessorKey: "name", header: "Name", size: 100 },
			{ accessorKey: "role", header: "Role", size: 100 },
			{ accessorKey: "balance", header: "Balance", size: 100 },
		];
		const headers = (): readonly string[] => screen.getAllByText(/^(Name|Role|Balance)$/u).map((node) => String(node.props.children));
		await render(<Harness columns={columns} layout={{ columnsDraggable: true }} />);
		const grip = screen.getByLabelText("Drag to reorder: Name");
		await fireEvent(grip, "responderGrant", touch(0, 1));
		await fireEvent(grip, "responderMove", touch(70, 2));
		await fireEvent(grip, "responderRelease", touch(70, 3));
		expect(headers()).toEqual(["Role", "Name", "Balance"]);

		await fireEvent(screen.getByLabelText("Drag to reorder: Name"), "responderGrant", touch(0, 4));
		await fireEvent(screen.getByLabelText("Drag to reorder: Name"), "responderMove", touch(20, 5));
		await fireEvent(screen.getByLabelText("Drag to reorder: Name"), "responderTerminate", touch(20, 6));
		await fireEvent(screen.getByLabelText("Drag to reorder: Name"), "responderGrant", touch(0, 7));
		await fireEvent(screen.getByLabelText("Drag to reorder: Name"), "responderRelease", touch(0, 8));
		expect(headers()).toEqual(["Role", "Name", "Balance"]);

		await fireEvent(screen.getByLabelText("Drag to reorder: Name"), "accessibilityAction", { nativeEvent: { actionName: "moveEnd" } });
		expect(headers()).toEqual(["Role", "Balance", "Name"]);
		await fireEvent(screen.getByLabelText("Drag to reorder: Name"), "accessibilityAction", { nativeEvent: { actionName: "moveEnd" } });
		expect(headers()).toEqual(["Role", "Balance", "Name"]);
		await fireEvent(screen.getByLabelText("Drag to reorder: Name"), "accessibilityAction", { nativeEvent: { actionName: "moveStart" } });
		expect(headers()).toEqual(["Role", "Name", "Balance"]);
	});

	it("names a column that neither sorts nor offers a menu as a plain header, and leaves out the expand button of a row that cannot expand", async () => {
		const columns: ColumnDef<DataGridFeatures, Person>[] = [
			{ id: "expand", header: "", cell: ({ row }) => <DataGridRowExpand row={row} /> },
			{ accessorKey: "name", enableSorting: false, header: ({ column }) => <DataGridColumnHeader column={column} title="Person" /> },
			{ accessorKey: "role" },
		];
		await render(<Harness columns={columns} options={{ getRowCanExpand: (): boolean => false }} />);
		expect(screen.getByRole("header", { name: "Person" })).toBeOnTheScreen();
		expect(screen.getByText("role")).toBeOnTheScreen();
		expect(screen.getByText("Engineer")).toBeOnTheScreen();
		expect(screen.queryByRole("button", { name: "Expand row" })).toBeNull();
	});

	it("offers a menu on a column that cannot sort, with its glyph and pin shown", async () => {
		const columns: ColumnDef<DataGridFeatures, Person>[] = [
			{ accessorKey: "name", enableSorting: false, meta: { headerTitle: "Person" }, header: ({ column }) => <DataGridColumnHeader column={column} icon={UserIcon} /> },
			{ accessorKey: "role", header: "Role" },
		];
		await render(<Harness columns={columns} layout={{ columnsPinnable: true }} />);
		await fireEvent.press(screen.getByRole("button", { name: "Person" }));
		expect(screen.queryByRole("radio", { name: "Asc" })).toBeNull();
		await fireEvent.press(screen.getByRole("menuitem", { name: "Pin to left" }));
		await settle();
		await fireEvent.press(screen.getByRole("button", { name: "Person" }));
		expect(screen.getByRole("menuitem", { name: "Unpin Person column" })).toBeOnTheScreen();
	});

	it("says there is nothing to page through, and can leave out the page sizes", async () => {
		await render(<Harness data={[]} withPager />);
		expect(screen.getByText("0 - 0 of 0")).toBeOnTheScreen();
	});

	it("pastes nothing when the clipboard cannot be read", async () => {
		const onCellsChange = jest.fn<undefined, [DataGridCellsChangeDetails<Person>]>();
		const readClipboard = jest.fn((): Promise<string> => Promise.reject(new Error("Clipboard locked")));
		await render(<Harness layout={{ cellSelection: true }} grid={{ onCellsChange, readClipboard }} />);
		await fireEvent.press(screen.getByRole("button", { name: "Name, Ada" }));
		await act(async (): Promise<void> => {
			await fireEvent.press(screen.getByRole("button", { name: "Paste" }));
		});
		expect(readClipboard).toHaveBeenCalledTimes(1);
		expect(onCellsChange).not.toHaveBeenCalled();
	});

	it("shows or hides columns from the columns menu", async () => {
		await render(<Harness withVisibility />);
		await fireEvent.press(screen.getByRole("button", { name: "Columns" }));
		await fireEvent.press(screen.getByRole("checkbox", { name: "Role" }));
		expect(screen.queryByText("Engineer")).toBeNull();
	});

	it("picks cells, stretches the pick, and copies, fills, clears, pastes and edits them through the caller", async () => {
		const onCellsChange = jest.fn<undefined, [DataGridCellsChangeDetails<Person>]>();
		const onCellsCopy = jest.fn<undefined, [DataGridCopyDetails]>();
		const readClipboard = jest.fn((): Promise<string> => Promise.resolve("Zed\tChef"));
		await render(<Harness layout={{ cellSelection: true }} grid={{ onCellsChange, onCellsCopy, readClipboard }} />);

		await fireEvent.press(screen.getByRole("button", { name: "Name, Ada" }));
		expect(screen.getByText("1 selected")).toBeOnTheScreen();
		await fireEvent(screen.getByRole("button", { name: "Role, Analyst" }), "longPress");
		expect(screen.getByText("6 selected")).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "Name, Grace" })).toHaveProp("accessibilityState", { selected: true });

		await fireEvent.press(screen.getByRole("button", { name: "Copy" }));
		expect(onCellsCopy).toHaveBeenCalledWith({ text: "Ada\tEngineer\r\nGrace\tAdmiral\r\nAlan\tAnalyst", rowCount: 3, columnCount: 2 });

		await fireEvent.press(screen.getByRole("button", { name: "Fill down" }));
		expect(onCellsChange).toHaveBeenLastCalledWith(expect.objectContaining({ source: "fill", rejected: [] }));
		expect(lastValues(onCellsChange)).toEqual(["Ada", "Engineer", "Ada", "Engineer", "Ada", "Engineer"]);
		await fireEvent.press(screen.getByRole("button", { name: "Fill right" }));
		expect(lastValues(onCellsChange)).toEqual(["Ada", "Ada", "Grace", "Grace", "Alan", "Alan"]);
		await fireEvent.press(screen.getByRole("button", { name: "Clear values" }));
		expect(onCellsChange).toHaveBeenLastCalledWith(expect.objectContaining({ source: "clear" }));

		await fireEvent.press(screen.getByRole("button", { name: "Name, Alan" }));
		expect(screen.getByRole("button", { name: "Fill down" })).toBeDisabled();
		await act(async (): Promise<void> => {
			await fireEvent.press(screen.getByRole("button", { name: "Paste" }));
		});
		expect(onCellsChange).toHaveBeenLastCalledWith(
			expect.objectContaining({
				source: "paste",
				changes: [expect.objectContaining({ rowId: "p3", columnId: "name", value: "Zed" }), expect.objectContaining({ rowId: "p3", columnId: "role", value: "Chef" })],
			}),
		);

		await fireEvent.press(screen.getByRole("button", { name: "Balance, 200" }));
		await fireEvent.press(screen.getByRole("button", { name: "Edit" }));
		const input = screen.getByLabelText("Balance");
		expect(input).toHaveProp("value", "200");
		await fireEvent.changeText(input, "250");
		await fireEvent.press(screen.getByRole("button", { name: "Save" }));
		expect(onCellsChange).toHaveBeenLastCalledWith(
			expect.objectContaining({ source: "edit", changes: [expect.objectContaining({ rowId: "p3", columnId: "balance", value: 250 })] }),
		);
		await settle();

		await fireEvent.press(screen.getByRole("button", { name: "Edit" }));
		await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
		await settle();
		await fireEvent.press(screen.getByRole("button", { name: "Clear selection" }));
		expect(screen.queryByText(/selected$/u)).toBeNull();
	});

	it("offers only what the caller can do with a selection", async () => {
		await render(<Harness layout={{ cellSelection: true }} />);
		await fireEvent.press(screen.getByRole("button", { name: "Name, Ada" }));
		expect(screen.queryByRole("button", { name: "Copy" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Paste" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
	});

	it("draws a long list as it scrolls, asks for more at its end, and says when all are loaded", async () => {
		const onFetchMore = jest.fn();
		const { rerender } = await render(<Harness tableProps={{ virtualized: true, height: 300, onFetchMore }} />);
		expect(screen.getByText("Ada")).toBeOnTheScreen();
		await fireEvent(screen.getByTestId("grid-list"), "endReached");
		expect(onFetchMore).toHaveBeenCalledTimes(1);

		await rerender(<Harness tableProps={{ virtualized: true, height: 300, onFetchMore, isFetchingMore: true }} />);
		expect(screen.getByText("Loading more…")).toBeOnTheScreen();
		await rerender(<Harness tableProps={{ virtualized: true, height: 300, onFetchMore, hasMore: false }} />);
		expect(screen.getByText("All records loaded")).toBeOnTheScreen();
	});

	it("scrolls the rows under a sticky header, or the header with them", async () => {
		const { rerender } = await render(<Harness layout={{ headerSticky: true }} tableProps={{ height: 200 }} />);
		expect(screen.getByText("Ada")).toBeOnTheScreen();
		await rerender(<Harness tableProps={{ height: 200 }} />);
		expect(screen.getByText("Ada")).toBeOnTheScreen();
	});

	it("draws only the columns in view when columns are virtualised", async () => {
		const columns: ColumnDef<DataGridFeatures, Person>[] = [
			{ accessorKey: "name", header: "Name", size: 100 },
			...["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"].map((id: string): ColumnDef<DataGridFeatures, Person> => ({
				id,
				header: id.toUpperCase(),
				accessorFn: (row: Person): string => `${id}-${row.id}`,
				size: 100,
			})),
		];
		await render(<Harness columns={columns} pinning={{ start: ["name"], end: [] }} tableProps={{ virtualizeColumns: true }} />);
		await fireEvent(screen.getByTestId("grid"), "layout", { nativeEvent: { layout: { width: 300, height: 400, x: 0, y: 0 } } });
		expect(screen.getByText("Ada")).toBeOnTheScreen();
		expect(screen.getByText("C2")).toBeOnTheScreen();
		expect(screen.queryByText("C8")).toBeNull();
		await fireEvent.scroll(screen.getByTestId("grid-scroll"), { nativeEvent: { contentOffset: { x: 600, y: 0 } } });
		expect(screen.getByText("Ada")).toBeOnTheScreen();
	});

	it("hands a dragged row's move to the caller", async () => {
		const onRowReorder = jest.fn<undefined, [DataGridRowMove]>();
		const columns: ColumnDef<DataGridFeatures, Person>[] = [
			{ id: "drag", header: "", cell: () => <DataGridRowHandle /> },
			{ accessorKey: "name", header: "Name" },
		];
		await render(<Harness columns={columns} layout={{ rowsDraggable: true }} grid={{ onRowReorder }} />);
		await fireEvent(screen.getByLabelText("Reorder Ada"), "accessibilityAction", { nativeEvent: { actionName: "down" } });
		expect(onRowReorder).toHaveBeenCalledWith({ rowId: "p1", from: 0, to: 1 });
	});

	it("refuses parts outside a grid", async () => {
		const Orphan = (): React.JSX.Element => <Text>{useDataGrid().labels.empty}</Text>;
		jest.spyOn(console, "error").mockImplementation((): undefined => undefined);
		await expect(render(<Orphan />)).rejects.toThrow("Data grid parts must sit inside <DataGrid>.");
	});
});

import { useTable, type ColumnDef } from "@tanstack/react-table";
import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import type { ViewInstance } from "react-native";

import { dataGridFeatures, type DataGridFeatures } from "../../lib/data-grid";
import { DataGrid, DataGridContainer, DataGridTable } from "../data-grid";
import {
	DataGridColumnHeader,
	DataGridColumnVisibility,
	DataGridPagination,
	DataGridRowExpand,
	DataGridRowPin,
	DataGridRowSelect,
	DataGridRowSelectAll,
} from "../data-grid-parts";

interface Fruit {
	readonly id: string;
	readonly name: string;
}

const FRUIT: readonly Fruit[] = [
	{ id: "f1", name: "Apple" },
	{ id: "f2", name: "Pear" },
];

/** Hands each part a callback ref that records its view by name. */
type Attach = (part: string) => (view: ViewInstance | null) => void;

/** The parts that take a ref, by the name the test records them under. */
const PARTS: readonly string[] = ["grid", "header", "selectAll", "select", "pin", "pager", "visibility", "table"];

/** Records every part's view, for the test to read after the render. */
function viewRecorder(): { readonly attach: Attach; readonly views: Map<string, ViewInstance | null> } {
	const views = new Map<string, ViewInstance | null>();
	return {
		views,
		attach:
			(part: string) =>
			(view: ViewInstance | null): void => {
				if (view !== null) {
					views.set(part, view);
				}
			},
	};
}

/** Callback refs that record nothing: for tests that do not read the views. */
const IGNORE_VIEWS: Attach = () => (): void => undefined;

/** The fruit grid's columns, each part recorded under its name. */
function fruitColumns(attach: Attach): ColumnDef<DataGridFeatures, Fruit>[] {
	return [
		{
			id: "select",
			header: () => <DataGridRowSelectAll ref={attach("selectAll")} testID="select-all" />,
			// Only the first row's parts are recorded: one name holds one view.
			cell: ({ row }) => <DataGridRowSelect ref={row.id === "f1" ? attach("select") : undefined} row={row} testID={`select-${row.id}`} />,
		},
		{ id: "pin", header: "Pin", cell: ({ row }) => <DataGridRowPin ref={row.id === "f1" ? attach("pin") : undefined} row={row} testID={`pin-${row.id}`} /> },
		{ id: "expand", header: "More", cell: ({ row }) => <DataGridRowExpand row={row} testID={`expand-${row.id}`} /> },
		{ accessorKey: "name", header: ({ column }) => <DataGridColumnHeader ref={attach("header")} column={column} testID="name-header" />, meta: { headerTitle: "Name" } },
	];
}

function Fruits({ attach }: { readonly attach: Attach }): React.JSX.Element {
	const columns = React.useMemo((): ColumnDef<DataGridFeatures, Fruit>[] => fruitColumns(attach), [attach]);
	const table = useTable({ features: dataGridFeatures, columns, data: FRUIT, getRowId: (fruit: Fruit): string => fruit.id, getRowCanExpand: (): boolean => false });
	return (
		<DataGrid ref={attach("grid")} table={table} recordCount={FRUIT.length} testID="fruit-grid">
			<DataGridColumnVisibility ref={attach("visibility")} testID="columns" />
			<DataGridContainer>
				<DataGridTable ref={attach("table")} testID="table" />
			</DataGridContainer>
			<DataGridPagination ref={attach("pager")} testID="pager" />
		</DataGrid>
	);
}

describe("the data grid's parts", () => {
	it("forward their refs to their views", async () => {
		const { attach, views } = viewRecorder();
		await render(<Fruits attach={attach} />);
		expect([...views.keys()].sort()).toStrictEqual([...PARTS].sort());
		expect(screen.getByTestId("fruit-grid")).toBeOnTheScreen();
	});

	it("act on the row they name by id: select it, pin it, and leave out an expand button for a row that cannot expand", async () => {
		await render(<Fruits attach={IGNORE_VIEWS} />);
		await fireEvent.press(screen.getByTestId("select-f2"));
		expect(screen.getByTestId("select-f2")).toBeChecked();
		expect(screen.getByTestId("select-f1")).not.toBeChecked();
		await fireEvent.press(screen.getByTestId("select-all"));
		expect(screen.getByTestId("select-f1")).toBeChecked();
		expect(screen.queryByTestId("expand-f1")).toBeNull();
		await fireEvent.press(screen.getByTestId("pin-f2"));
		expect(screen.getByTestId("pin-f2")).toBeSelected();
		expect(screen.getByTestId("pin-f1")).not.toBeSelected();
	});

	it("draw nothing for a column the grid does not have", async () => {
		function Stray(): React.JSX.Element {
			const columns = React.useMemo((): ColumnDef<DataGridFeatures, Fruit>[] => [{ accessorKey: "name", header: "Name" }], []);
			const table = useTable({ features: dataGridFeatures, columns, data: FRUIT });
			return (
				<DataGrid table={table} recordCount={FRUIT.length}>
					<DataGridColumnHeader column={STRAY_COLUMN} testID="stray" />
				</DataGrid>
			);
		}
		await render(<Stray />);
		expect(screen.queryByTestId("stray")).toBeNull();
	});
});

const STRAY_COLUMN = { id: "no-such-column" };

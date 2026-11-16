import type { RowSelectionState } from "@tanstack/react-table";
import { DataGridRowSelect, DataGridRowSelectAll } from "@workspace/ui-native/components/data-grid-parts";
import * as React from "react";
import { Text, View } from "react-native";

import { COLUMN_WIDTH, LocationCell, PeopleGrid, PersonCell, type PersonColumns } from "./data-grid-sample";

/** The checkbox column: narrow, never sorted. */
const SELECT_WIDTH = 48;

const COLUMNS: PersonColumns = [
	{
		id: "select",
		header: () => <DataGridRowSelectAll />,
		cell: ({ row }) => <DataGridRowSelect row={row} />,
		size: SELECT_WIDTH,
		enableSorting: false,
	},
	{ accessorKey: "name", header: "Name", cell: PersonCell, size: COLUMN_WIDTH.person },
	{ accessorKey: "location", header: "Location", cell: LocationCell, size: COLUMN_WIDTH.location },
	{ accessorKey: "joined", header: "Joined", size: COLUMN_WIDTH.short },
];

// A checkbox per row and one in the header for the page, held in the example's own state.
export function DataGrid7Example(): React.JSX.Element {
	const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
	const options = React.useMemo(() => ({ state: { rowSelection }, onRowSelectionChange: setRowSelection, enableRowSelection: true }), [rowSelection]);
	const count = Object.values(rowSelection).filter(Boolean).length;
	return (
		<View className="w-full gap-2">
			<Text className="text-caption font-sans text-muted-foreground">{count === 0 ? "No rows selected" : `${String(count)} selected`}</Text>
			<PeopleGrid columns={COLUMNS} options={options} />
		</View>
	);
}

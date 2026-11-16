import { useTable, type ColumnDef } from "@tanstack/react-table";
import { DataGrid, DataGridContainer, DataGridTable } from "@workspace/ui-native/components/data-grid";
import { dataGridFeatures, type DataGridFeatures, type DataGridTableLayout } from "@workspace/ui-native/lib/data-grid";
import * as React from "react";
import { Text } from "react-native";

import { formatUsd, LOCAL_ROWS, logRowId, type LogRow } from "./data-grid-sample-records";

const WIDTH = { index: 64, name: 160, email: 230, balance: 120 } satisfies Record<string, number>;

const COLUMNS: ColumnDef<DataGridFeatures, LogRow>[] = [
	{ accessorKey: "index", header: "#", size: WIDTH.index, meta: { align: "end" } },
	{ accessorKey: "name", header: "Name", size: WIDTH.name },
	{ accessorKey: "email", header: "Email", size: WIDTH.email },
	{
		accessorKey: "balance",
		header: "Balance",
		cell: ({ row }) => <Text className="text-label font-sans text-foreground tabular-nums">{formatUsd(row.original.balance)}</Text>,
		size: WIDTH.balance,
		meta: { align: "end" },
	},
];

const LAYOUT: DataGridTableLayout = { headerSticky: true, headerBackground: true, dense: true };
/** The list's window, in points. */
const HEIGHT = 480;

// Two hundred rows in memory, drawn only as they scroll into a 480-point window under a sticky header; no pager.
export function DataGrid27Example(): React.JSX.Element {
	// No pager: every row is in the list, drawn as it scrolls into view.
	const table = useTable({ features: dataGridFeatures, columns: COLUMNS, data: LOCAL_ROWS, getRowId: logRowId, manualPagination: true });
	return (
		<DataGrid table={table} recordCount={LOCAL_ROWS.length} tableLayout={LAYOUT}>
			<DataGridContainer>
				<DataGridTable virtualized height={HEIGHT} />
			</DataGridContainer>
		</DataGrid>
	);
}

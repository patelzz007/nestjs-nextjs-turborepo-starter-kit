import { useTable, type PaginationState, type RowPinningState } from "@tanstack/react-table";
import { Button } from "@workspace/ui-native/components/button";
import { DataGrid, DataGridContainer, DataGridTable } from "@workspace/ui-native/components/data-grid";
import { DataGridPagination, DataGridRowPin } from "@workspace/ui-native/components/data-grid-parts";
import { dataGridFeatures, type DataGridTableLayout } from "@workspace/ui-native/lib/data-grid";
import * as React from "react";
import { Text, View } from "react-native";

import { EmployeeBalanceCell, EmployeeCell, EmployeeStatusCell, type EmployeeColumns } from "./data-grid-sample";
import { EMPLOYEES, employeeId } from "./data-grid-sample-records";

const WIDTH = { pin: 44, person: 200, status: 110, balance: 120 } satisfies Record<string, number>;
const PAGE_SIZE = 5;
const NO_PINS: RowPinningState = { top: [], bottom: [] };

const COLUMNS: EmployeeColumns = [
	{ id: "pin", header: "", cell: ({ row }) => <DataGridRowPin row={row} />, size: WIDTH.pin, enableSorting: false },
	{ accessorKey: "name", header: "Employee", cell: EmployeeCell, size: WIDTH.person },
	{ accessorKey: "status", header: "Status", cell: EmployeeStatusCell, size: WIDTH.status },
	{ accessorKey: "balance", header: "Balance", cell: EmployeeBalanceCell, size: WIDTH.balance, meta: { align: "end" } },
];

const LAYOUT: DataGridTableLayout = { rowsPinnable: true };

// Pin rows above the rest from the pin column; they stay pinned across pages, with a count and Unpin all.
export function DataGrid29Example(): React.JSX.Element {
	const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE });
	const [rowPinning, setRowPinning] = React.useState<RowPinningState>(NO_PINS);
	const table = useTable({
		features: dataGridFeatures,
		columns: COLUMNS,
		data: EMPLOYEES,
		getRowId: employeeId,
		keepPinnedRows: true,
		state: { pagination, rowPinning },
		onPaginationChange: setPagination,
		onRowPinningChange: setRowPinning,
	});
	const pinned = rowPinning.top.length;
	const unpinAll = React.useCallback((): void => {
		setRowPinning(NO_PINS);
	}, []);
	return (
		<DataGrid table={table} recordCount={EMPLOYEES.length} tableLayout={LAYOUT}>
			<View className="w-full gap-2.5">
				<View className="flex-row items-center justify-between gap-2">
					<Text className="text-caption font-sans text-muted-foreground">{pinned === 0 ? "No rows pinned" : `${String(pinned)} pinned`}</Text>
					<Button label="Unpin all" variant="ghost" size="xs" onPress={unpinAll} disabled={pinned === 0} />
				</View>
				<DataGridContainer>
					<DataGridTable />
				</DataGridContainer>
				<DataGridPagination />
			</View>
		</DataGrid>
	);
}

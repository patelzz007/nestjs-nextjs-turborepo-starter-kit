// The footer examples' grid: the employees in a card, with whatever footer rows the example adds.

import { useTable } from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import { DataGrid, DataGridTable, type DataGridFootRow } from "@workspace/ui-native/components/data-grid";
import { DataGridColumnHeader } from "@workspace/ui-native/components/data-grid-parts";
import { dataGridFeatures, type DataGridTableLayout } from "@workspace/ui-native/lib/data-grid";
import * as React from "react";
import { Text } from "react-native";

import { EmployeeBalanceCell, EmployeeCell, EmployeeStatusCell, type EmployeeColumns } from "./data-grid-sample";
import { EMPLOYEES, employeeId, type Employee } from "./data-grid-sample-records";

const WIDTH = { person: 200, status: 110, balance: 130, transactions: 120 } satisfies Record<string, number>;
/** Six people: enough to sum, short enough to show the footer without scrolling. */
const SHOWN = 6;
export const FOOTER_EMPLOYEES: readonly Employee[] = EMPLOYEES.slice(0, SHOWN);

export const FOOTER_COLUMNS: EmployeeColumns = [
	{ accessorKey: "name", header: ({ column }) => <DataGridColumnHeader column={column} />, cell: EmployeeCell, size: WIDTH.person, meta: { headerTitle: "Employee" } },
	{ accessorKey: "status", header: "Status", cell: EmployeeStatusCell, size: WIDTH.status },
	{
		accessorKey: "balance",
		header: ({ column }) => <DataGridColumnHeader column={column} />,
		cell: EmployeeBalanceCell,
		size: WIDTH.balance,
		meta: { headerTitle: "Balance", align: "end" },
	},
	{
		accessorKey: "transactions",
		header: ({ column }) => <DataGridColumnHeader column={column} />,
		cell: ({ row }) => <Text className="text-label font-sans text-foreground tabular-nums">{row.original.transactions}</Text>,
		size: WIDTH.transactions,
		meta: { headerTitle: "Transactions", align: "end" },
	},
];

const LAYOUT: DataGridTableLayout = { footerBackground: true };

export function FooterGrid({ title, footer }: { readonly title: string; readonly footer: readonly DataGridFootRow[] }): React.JSX.Element {
	const table = useTable({ features: dataGridFeatures, columns: FOOTER_COLUMNS, data: FOOTER_EMPLOYEES, getRowId: employeeId });
	return (
		<DataGrid table={table} recordCount={FOOTER_EMPLOYEES.length} tableLayout={LAYOUT}>
			<Card className="w-full">
				<CardHeader>
					<CardTitle>{title}</CardTitle>
				</CardHeader>
				<CardContent className="px-0">
					<DataGridTable footer={footer} />
				</CardContent>
			</Card>
		</DataGrid>
	);
}

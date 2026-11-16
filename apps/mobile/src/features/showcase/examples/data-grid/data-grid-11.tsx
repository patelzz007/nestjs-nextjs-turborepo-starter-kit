import { DataGridColumnHeader } from "@workspace/ui-native/components/data-grid-parts";
import * as React from "react";

import { BalanceCell, COLUMN_WIDTH, PeopleGrid, PersonCell, type PersonColumns } from "./data-grid-sample";

const COLUMNS: PersonColumns = [
	{
		accessorKey: "name",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Staff" />,
		cell: PersonCell,
		size: COLUMN_WIDTH.person,
		meta: { headerTitle: "Staff" },
	},
	{ accessorKey: "role", header: ({ column }) => <DataGridColumnHeader column={column} title="Occupation" />, size: COLUMN_WIDTH.short, meta: { headerTitle: "Occupation" } },
	{ accessorKey: "company", header: ({ column }) => <DataGridColumnHeader column={column} title="Company" />, size: COLUMN_WIDTH.short, meta: { headerTitle: "Company" } },
	{
		accessorKey: "balance",
		header: ({ column }) => <DataGridColumnHeader column={column} title="Dividend" />,
		cell: BalanceCell,
		size: COLUMN_WIDTH.balance,
		meta: { headerTitle: "Dividend", align: "end" },
	},
];

// Each header is a button that steps its column through ascending, descending and unsorted, with an arrow.
export function DataGrid11Example(): React.JSX.Element {
	return <PeopleGrid columns={COLUMNS} />;
}

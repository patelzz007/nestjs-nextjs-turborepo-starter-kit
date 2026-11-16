import { DataGridColumnHeader } from "@workspace/ui-native/components/data-grid-parts";
import type { DataGridTableLayout } from "@workspace/ui-native/lib/data-grid";
import * as React from "react";

import { BalanceCell, COLUMN_WIDTH, EmailCell, LocationCell, PeopleGrid, PersonCell, type PersonColumns } from "./data-grid-sample";

const COLUMNS: PersonColumns = [
	{ accessorKey: "name", header: ({ column }) => <DataGridColumnHeader column={column} />, cell: PersonCell, size: COLUMN_WIDTH.person, meta: { headerTitle: "Name" } },
	{ accessorKey: "email", header: ({ column }) => <DataGridColumnHeader column={column} />, cell: EmailCell, size: COLUMN_WIDTH.email, meta: { headerTitle: "Email" } },
	{
		accessorKey: "location",
		header: ({ column }) => <DataGridColumnHeader column={column} />,
		cell: LocationCell,
		size: COLUMN_WIDTH.location,
		meta: { headerTitle: "Location" },
	},
	{
		accessorKey: "balance",
		header: ({ column }) => <DataGridColumnHeader column={column} />,
		cell: BalanceCell,
		size: COLUMN_WIDTH.balance,
		meta: { headerTitle: "Balance", align: "end" },
	},
];

const LAYOUT: DataGridTableLayout = { columnsDraggable: true };

// Drag a header's grip along the row to move its column; screen readers move it a place at a time.
export function DataGrid13Example(): React.JSX.Element {
	return <PeopleGrid columns={COLUMNS} layout={LAYOUT} />;
}

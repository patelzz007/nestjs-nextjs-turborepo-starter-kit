import { DataGridColumnHeader } from "@workspace/ui-native/components/data-grid-parts";
import type { DataGridTableLayout } from "@workspace/ui-native/lib/data-grid";
import * as React from "react";

import { COLUMN_WIDTH, PeopleGrid, PersonCell, StatusCell, type PersonColumns } from "./data-grid-sample";

const COLUMNS: PersonColumns = [
	{ accessorKey: "name", header: ({ column }) => <DataGridColumnHeader column={column} />, cell: PersonCell, size: COLUMN_WIDTH.person, meta: { headerTitle: "Staff" } },
	{ accessorKey: "role", header: ({ column }) => <DataGridColumnHeader column={column} />, size: COLUMN_WIDTH.short, meta: { headerTitle: "Occupation" } },
	{ accessorKey: "company", header: ({ column }) => <DataGridColumnHeader column={column} />, size: COLUMN_WIDTH.short, meta: { headerTitle: "Company" } },
	{ accessorKey: "status", header: ({ column }) => <DataGridColumnHeader column={column} />, cell: StatusCell, size: COLUMN_WIDTH.status, meta: { headerTitle: "Status" } },
];

const LAYOUT: DataGridTableLayout = { columnsMovable: true };

// Each header opens a menu: sort either way, or move the column a place left or right.
export function DataGrid12Example(): React.JSX.Element {
	return <PeopleGrid columns={COLUMNS} layout={LAYOUT} />;
}

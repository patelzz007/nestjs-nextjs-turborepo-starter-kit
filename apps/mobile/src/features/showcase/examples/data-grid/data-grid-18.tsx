import { DataGridColumnHeader } from "@workspace/ui-native/components/data-grid-parts";
import type { DataGridTableLayout } from "@workspace/ui-native/lib/data-grid";
import * as React from "react";

import { BalanceCell, COLUMN_WIDTH, EmailCell, LocationCell, PeopleGrid, PersonCell, StatusCell, type PersonColumns } from "./data-grid-sample";

const header: PersonColumns[number]["header"] = ({ column }) => <DataGridColumnHeader column={column} visibility />;

const COLUMNS: PersonColumns = [
	{ accessorKey: "name", header, cell: PersonCell, size: COLUMN_WIDTH.person, enableHiding: false, meta: { headerTitle: "Name" } },
	{ accessorKey: "email", header, cell: EmailCell, size: COLUMN_WIDTH.email, meta: { headerTitle: "Email" } },
	{ accessorKey: "location", header, cell: LocationCell, size: COLUMN_WIDTH.location, meta: { headerTitle: "Location" } },
	{ accessorKey: "status", header, cell: StatusCell, size: COLUMN_WIDTH.status, meta: { headerTitle: "Status" } },
	{ accessorKey: "balance", header, cell: BalanceCell, size: COLUMN_WIDTH.balance, meta: { headerTitle: "Balance", align: "end" } },
];

const LAYOUT: DataGridTableLayout = { columnsPinnable: true, columnsResizable: true, columnsMovable: true, columnsVisibility: true };

// One header menu for everything: sort, pin, move, and the list of columns to show; plus a width handle on each.
export function DataGrid18Example(): React.JSX.Element {
	return <PeopleGrid columns={COLUMNS} layout={LAYOUT} />;
}

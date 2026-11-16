import { DataGridColumnHeader } from "@workspace/ui-native/components/data-grid-parts";
import type { DataGridTableLayout } from "@workspace/ui-native/lib/data-grid";
import * as React from "react";

import { BalanceCell, COLUMN_WIDTH, EmailCell, LocationCell, PeopleGrid, PersonCell, StatusCell, type PersonColumns } from "./data-grid-sample";

const header: PersonColumns[number]["header"] = ({ column }) => <DataGridColumnHeader column={column} />;

const COLUMNS: PersonColumns = [
	{ accessorKey: "name", header, cell: PersonCell, size: COLUMN_WIDTH.person, meta: { headerTitle: "Name" } },
	{ accessorKey: "email", header, cell: EmailCell, size: COLUMN_WIDTH.email, meta: { headerTitle: "Email" } },
	{ accessorKey: "company", header, size: COLUMN_WIDTH.short, meta: { headerTitle: "Company" } },
	{ accessorKey: "role", header, size: COLUMN_WIDTH.short, meta: { headerTitle: "Role" } },
	{ accessorKey: "location", header, cell: LocationCell, size: COLUMN_WIDTH.location, meta: { headerTitle: "Location" } },
	{ accessorKey: "joined", header, size: COLUMN_WIDTH.short, meta: { headerTitle: "Joined" } },
	{ accessorKey: "status", header, cell: StatusCell, size: COLUMN_WIDTH.status, meta: { headerTitle: "Status" } },
	{ accessorKey: "balance", header, cell: BalanceCell, size: COLUMN_WIDTH.balance, meta: { headerTitle: "Balance", align: "end" } },
];

const LAYOUT: DataGridTableLayout = { columnsPinnable: true, columnsResizable: true };
const OPTIONS = { initialState: { columnPinning: { start: ["name"], end: [] } } };

// Eight columns scroll sideways under Name, pinned at the start; any header's menu pins a column to either edge.
export function DataGrid16Example(): React.JSX.Element {
	return <PeopleGrid columns={COLUMNS} layout={LAYOUT} options={OPTIONS} />;
}

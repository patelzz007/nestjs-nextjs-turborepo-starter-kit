import * as React from "react";

import { BalanceCell, COLUMN_WIDTH, EmailCell, LocationCell, PeopleGrid, StatusCell, type PersonColumns } from "./data-grid-sample";

/** The name is just another column: scroll sideways and every row loses who it is. */
const COLUMNS: PersonColumns = [
	{ accessorKey: "email", header: "Email", cell: EmailCell, size: COLUMN_WIDTH.email },
	{ accessorKey: "location", header: "Location", cell: LocationCell, size: COLUMN_WIDTH.location },
	{ accessorKey: "status", header: "Status", cell: StatusCell, size: COLUMN_WIDTH.status },
	{ accessorKey: "balance", header: "Balance", cell: BalanceCell, size: COLUMN_WIDTH.balance, meta: { align: "end" } },
	{ accessorKey: "name", header: "Name", size: COLUMN_WIDTH.name },
];

export function DataGridDont1Example(): React.JSX.Element {
	return <PeopleGrid columns={COLUMNS} />;
}

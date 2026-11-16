import * as React from "react";

import { BalanceCell, COLUMN_WIDTH, EmailCell, LocationCell, NameCell, PeopleGrid, type PersonColumns } from "./data-grid-sample";

const COLUMNS: PersonColumns = [
	{ accessorKey: "name", header: "Name", cell: NameCell, size: COLUMN_WIDTH.name },
	{ accessorKey: "email", header: "Email", cell: EmailCell, size: COLUMN_WIDTH.email },
	{ accessorKey: "location", header: "Location", cell: LocationCell, size: COLUMN_WIDTH.location },
	{ accessorKey: "balance", header: "Balance ($)", cell: BalanceCell, size: COLUMN_WIDTH.balance, meta: { align: "end" } },
];

// A starting point: an in-memory list of people paged on the phone.
export function DataGrid1Example(): React.JSX.Element {
	return <PeopleGrid columns={COLUMNS} />;
}

import * as React from "react";

import { BalanceCell, COLUMN_WIDTH, EmailCell, LocationCell, PeopleGrid, PersonCell, StatusCell, type PersonColumns } from "./data-grid-sample";

const COLUMNS: PersonColumns = [
	{ accessorKey: "name", header: "Name", cell: PersonCell, size: COLUMN_WIDTH.person },
	{ accessorKey: "email", header: "Email", cell: EmailCell, size: COLUMN_WIDTH.email },
	{ accessorKey: "location", header: "Location", cell: LocationCell, size: COLUMN_WIDTH.location },
	{ accessorKey: "status", header: "Status", cell: StatusCell, size: COLUMN_WIDTH.status },
	{ accessorKey: "balance", header: "Balance", cell: BalanceCell, size: COLUMN_WIDTH.balance, meta: { align: "end" } },
];
const OPTIONS = { initialState: { columnPinning: { start: ["name"], end: [] } } };

export function DataGridDo1Example(): React.JSX.Element {
	return <PeopleGrid columns={COLUMNS} options={OPTIONS} />;
}

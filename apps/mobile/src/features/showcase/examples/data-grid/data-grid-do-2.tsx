import * as React from "react";

import { BalanceCell, COLUMN_WIDTH, NameCell, PeopleGrid, type PersonColumns } from "./data-grid-sample";

const COLUMNS: PersonColumns = [
	{ accessorKey: "name", header: "Name", cell: NameCell, size: COLUMN_WIDTH.name },
	{ accessorKey: "balance", header: "Balance", cell: BalanceCell, size: COLUMN_WIDTH.balance, meta: { align: "end" } },
];

export function DataGridDo2Example(): React.JSX.Element {
	return <PeopleGrid columns={COLUMNS} />;
}

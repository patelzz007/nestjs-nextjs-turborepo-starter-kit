import type { DataGridTableLayout } from "@workspace/ui-native/lib/data-grid";
import * as React from "react";

import { BalanceCell, COLUMN_WIDTH, PeopleGrid, PersonCell, type PersonColumns } from "./data-grid-sample";

const COLUMNS: PersonColumns = [
	{ accessorKey: "name", header: "Name", cell: PersonCell, size: COLUMN_WIDTH.person },
	{ accessorKey: "role", header: "Occupation", size: COLUMN_WIDTH.short },
	{ accessorKey: "company", header: "Company", size: COLUMN_WIDTH.short },
	{ accessorKey: "balance", header: "Salary", cell: BalanceCell, size: COLUMN_WIDTH.balance, meta: { align: "end" } },
];

const LAYOUT: DataGridTableLayout = { cellBorder: true };

// Lines between columns as well as rows, the grid in its frame with the pager below.
export function DataGrid2Example(): React.JSX.Element {
	return <PeopleGrid columns={COLUMNS} layout={LAYOUT} />;
}

import type { DataGridTableLayout } from "@workspace/ui-native/lib/data-grid";
import * as React from "react";

import { BalanceCell, COLUMN_WIDTH, EmailCell, LocationCell, NameCell, PeopleGrid, type PersonColumns } from "./data-grid-sample";

const COLUMNS: PersonColumns = [
	{ accessorKey: "name", header: "Name", cell: NameCell, size: COLUMN_WIDTH.name },
	{ accessorKey: "email", header: "Email", cell: EmailCell, size: COLUMN_WIDTH.email },
	{ accessorKey: "location", header: "Location", cell: LocationCell, size: COLUMN_WIDTH.location },
	{ accessorKey: "balance", header: "Balance ($)", cell: BalanceCell, size: COLUMN_WIDTH.balance, meta: { align: "end" } },
];

const LAYOUT: DataGridTableLayout = { stripped: true, rowBorder: false, rowRounded: true };

// Every other row shaded, with rounded ends, so the eye follows a record across.
export function DataGrid5Example(): React.JSX.Element {
	return <PeopleGrid columns={COLUMNS} layout={LAYOUT} />;
}

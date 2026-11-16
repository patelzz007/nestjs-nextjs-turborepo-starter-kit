import type { DataGridTableLayout } from "@workspace/ui-native/lib/data-grid";
import * as React from "react";

import { BalanceCell, COLUMN_WIDTH, EmailCell, LocationCell, PeopleGrid, PersonCell, type PersonColumns } from "./data-grid-sample";

const COLUMNS: PersonColumns = [
	{ accessorKey: "name", header: "Name", cell: PersonCell, size: COLUMN_WIDTH.person },
	{ accessorKey: "email", header: "Email", cell: EmailCell, size: COLUMN_WIDTH.email },
	{ accessorKey: "location", header: "Location", cell: LocationCell, size: COLUMN_WIDTH.location },
	{ accessorKey: "balance", header: "Balance ($)", cell: BalanceCell, size: COLUMN_WIDTH.balance, meta: { align: "end" } },
];

const LAYOUT: DataGridTableLayout = { headerSticky: true, headerBackground: true };
const PAGE_SIZE = 10;
/** The rows' window: about five rows tall. */
const HEIGHT = 300;
const TABLE = { height: HEIGHT };

// The header stays put while a page of ten rows scrolls inside a fixed height.
export function DataGrid17Example(): React.JSX.Element {
	return <PeopleGrid columns={COLUMNS} layout={LAYOUT} pageSize={PAGE_SIZE} tableProps={TABLE} />;
}

import type { DataGridTableLayout } from "@workspace/ui-native/lib/data-grid";
import * as React from "react";

import { COLUMN_WIDTH, LocationCell, NameCell, PeopleGrid, type PersonColumns } from "./data-grid-sample";

const COLUMNS: PersonColumns = [
	{ accessorKey: "name", header: "Name", cell: NameCell, size: COLUMN_WIDTH.name },
	{ accessorKey: "location", header: "Location", cell: LocationCell, size: COLUMN_WIDTH.location },
	{ accessorKey: "joined", header: "Joined", size: COLUMN_WIDTH.short },
];

const LAYOUT: DataGridTableLayout = { width: "auto" };

// Columns share the phone's width by their sizes: no sideways scroll.
export function DataGrid6Example(): React.JSX.Element {
	return <PeopleGrid columns={COLUMNS} layout={LAYOUT} />;
}

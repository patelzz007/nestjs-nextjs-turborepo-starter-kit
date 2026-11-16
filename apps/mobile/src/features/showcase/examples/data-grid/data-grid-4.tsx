import type { DataGridTableLayout } from "@workspace/ui-native/lib/data-grid";
import * as React from "react";

import { COLUMN_WIDTH, LocationCell, PeopleGrid, PersonCell, StatusCell, type PersonColumns } from "./data-grid-sample";

const COLUMNS: PersonColumns = [
	{ accessorKey: "name", header: "Name", cell: PersonCell, size: COLUMN_WIDTH.person },
	{ accessorKey: "location", header: "Location", cell: LocationCell, size: COLUMN_WIDTH.location },
	{ accessorKey: "status", header: "Status", cell: StatusCell, size: COLUMN_WIDTH.status },
];

const LAYOUT: DataGridTableLayout = { rowBorder: false, headerBorder: false, rowRounded: true };

// No divider lines, rounded row ends, and a presence dot on each avatar.
export function DataGrid4Example(): React.JSX.Element {
	return <PeopleGrid columns={COLUMNS} layout={LAYOUT} border={false} />;
}

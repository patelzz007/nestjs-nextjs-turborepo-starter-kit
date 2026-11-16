import type { DataGridTableLayout } from "@workspace/ui-native/lib/data-grid";
import * as React from "react";

import { COLUMN_WIDTH, EmailCell, LocationCell, PeopleGrid, PersonCell, StatusCell, type PersonColumns } from "./data-grid-sample";

const MIN_WIDTH = 120;
const MAX_WIDTH = 360;

const COLUMNS: PersonColumns = [
	{
		accessorKey: "name",
		header: "Staff",
		cell: PersonCell,
		size: COLUMN_WIDTH.person,
		minSize: MIN_WIDTH,
		maxSize: MAX_WIDTH,
		meta: { headerTitle: "Staff", autoSize: true },
	},
	{ accessorKey: "email", header: "Email", cell: EmailCell, size: COLUMN_WIDTH.email, minSize: MIN_WIDTH, maxSize: MAX_WIDTH },
	{ accessorKey: "location", header: "Location", cell: LocationCell, size: COLUMN_WIDTH.location, minSize: MIN_WIDTH, maxSize: MAX_WIDTH },
	{ accessorKey: "status", header: "Status", cell: StatusCell, size: COLUMN_WIDTH.status, enableResizing: false },
];

const LAYOUT: DataGridTableLayout = { columnsResizable: true };

// Drag a header's end to set its width (screen readers step it); Staff takes any spare width, Status stays fixed.
export function DataGrid15Example(): React.JSX.Element {
	return <PeopleGrid columns={COLUMNS} layout={LAYOUT} />;
}

import { DataGridRowExpand } from "@workspace/ui-native/components/data-grid-parts";
import * as React from "react";

import { COLUMN_WIDTH, EmailCell, LocationCell, PeopleGrid, PersonCell, StatusCell, type PersonColumns } from "./data-grid-sample";
import type { DataGridSamplePerson } from "./data-grid-sample-people";

const EXPAND_WIDTH = 44;

const COLUMNS: PersonColumns = [
	{
		id: "expand",
		header: "",
		cell: ({ row }) => <DataGridRowExpand row={row} />,
		size: EXPAND_WIDTH,
		enableSorting: false,
		meta: { expandedContent: (person: DataGridSamplePerson): string => person.details },
	},
	{ accessorKey: "name", header: "Name", cell: PersonCell, size: COLUMN_WIDTH.person },
	{ accessorKey: "email", header: "Email", cell: EmailCell, size: COLUMN_WIDTH.email },
	{ accessorKey: "location", header: "Location", cell: LocationCell, size: COLUMN_WIDTH.location },
	{ accessorKey: "status", header: "Status", cell: StatusCell, size: COLUMN_WIDTH.status },
];

const OPTIONS = { getRowCanExpand: (): boolean => true };

// A chevron opens a short note under each row: the expand column's `expandedContent`, kept in view as the grid scrolls.
export function DataGrid8Example(): React.JSX.Element {
	return <PeopleGrid columns={COLUMNS} options={OPTIONS} />;
}

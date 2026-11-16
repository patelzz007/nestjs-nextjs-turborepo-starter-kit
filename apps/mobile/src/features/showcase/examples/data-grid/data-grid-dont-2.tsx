import * as React from "react";
import { Text } from "react-native";

import { COLUMN_WIDTH, NameCell, PeopleGrid, type PersonColumns } from "./data-grid-sample";

/** Amounts as plain text, left-aligned: the digits do not line up, so they cannot be compared at a glance. */
const COLUMNS: PersonColumns = [
	{ accessorKey: "name", header: "Name", cell: NameCell, size: COLUMN_WIDTH.name },
	{
		accessorKey: "balance",
		header: "Balance",
		cell: ({ row }) => <Text className="text-label font-sans text-foreground">{String(row.original.balance)}</Text>,
		size: COLUMN_WIDTH.balance,
	},
];

export function DataGridDont2Example(): React.JSX.Element {
	return <PeopleGrid columns={COLUMNS} />;
}

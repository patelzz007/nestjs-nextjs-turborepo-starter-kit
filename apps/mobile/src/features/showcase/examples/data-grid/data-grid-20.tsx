import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import { DataGrid, DataGridTable } from "@workspace/ui-native/components/data-grid";
import { DataGridColumnVisibility, DataGridPagination } from "@workspace/ui-native/components/data-grid-parts";
import * as React from "react";
import { View } from "react-native";

import { BalanceCell, COLUMN_WIDTH, EmailCell, LocationCell, PersonCell, StatusCell, usePeopleTable, type PersonColumns } from "./data-grid-sample";
import { DATA_GRID_SAMPLE_PEOPLE } from "./data-grid-sample-people";

const COLUMNS: PersonColumns = [
	{ accessorKey: "name", header: "Name", cell: PersonCell, size: COLUMN_WIDTH.person, enableHiding: false },
	{ accessorKey: "email", header: "Email", cell: EmailCell, size: COLUMN_WIDTH.email },
	{ accessorKey: "location", header: "Location", cell: LocationCell, size: COLUMN_WIDTH.location },
	{ accessorKey: "status", header: "Status", cell: StatusCell, size: COLUMN_WIDTH.status },
	{ accessorKey: "balance", header: "Balance", cell: BalanceCell, size: COLUMN_WIDTH.balance, meta: { align: "end" } },
];
const TITLE = "Team";

// A Columns button in the card's header shows or hides each column that can be hidden (Name cannot).
export function DataGrid20Example(): React.JSX.Element {
	const table = usePeopleTable({ columns: COLUMNS });
	return (
		<DataGrid table={table} recordCount={DATA_GRID_SAMPLE_PEOPLE.length}>
			<Card className="w-full">
				<CardHeader>
					<View className="flex-row items-center justify-between gap-3">
						<CardTitle>{TITLE}</CardTitle>
						<DataGridColumnVisibility />
					</View>
				</CardHeader>
				<CardContent className="px-0">
					<DataGridTable />
				</CardContent>
				<CardFooter>
					<DataGridPagination />
				</CardFooter>
			</Card>
		</DataGrid>
	);
}

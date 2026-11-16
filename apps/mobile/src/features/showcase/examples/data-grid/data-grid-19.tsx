import { Button } from "@workspace/ui-native/components/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import { DataGrid, DataGridTable } from "@workspace/ui-native/components/data-grid";
import { DataGridColumnHeader, DataGridPagination } from "@workspace/ui-native/components/data-grid-parts";
import UserPlusIcon from "lucide-react-native/icons/user-plus";
import * as React from "react";
import { View } from "react-native";

import { COLUMN_WIDTH, LocationCell, PersonCell, StatusCell, usePeopleTable, type PersonColumns } from "./data-grid-sample";
import { DATA_GRID_SAMPLE_PEOPLE } from "./data-grid-sample-people";

const header: PersonColumns[number]["header"] = ({ column }) => <DataGridColumnHeader column={column} />;

const COLUMNS: PersonColumns = [
	{ accessorKey: "name", header, cell: PersonCell, size: COLUMN_WIDTH.person, meta: { headerTitle: "User" } },
	{ accessorKey: "location", header, cell: LocationCell, size: COLUMN_WIDTH.location, meta: { headerTitle: "Location" } },
	{ accessorKey: "status", header, cell: StatusCell, size: COLUMN_WIDTH.status, meta: { headerTitle: "Status" } },
];
const TITLE = "Users";

// The grid in a Card: a title and an Add user action in its header, the pager in its footer.
export function DataGrid19Example(): React.JSX.Element {
	const table = usePeopleTable({ columns: COLUMNS });
	const add = React.useCallback((): void => undefined, []);
	return (
		<DataGrid table={table} recordCount={DATA_GRID_SAMPLE_PEOPLE.length}>
			<Card className="w-full">
				<CardHeader>
					<View className="flex-row items-center justify-between gap-3">
						<CardTitle>{TITLE}</CardTitle>
						<Button label="Add user" icon={UserPlusIcon} size="sm" variant="outline" onPress={add} />
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

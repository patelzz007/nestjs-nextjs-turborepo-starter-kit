import { Button } from "@workspace/ui-native/components/button";
import { DataGrid, DataGridContainer, DataGridTable } from "@workspace/ui-native/components/data-grid";
import { DataGridPagination } from "@workspace/ui-native/components/data-grid-parts";
import { Skeleton } from "@workspace/ui-native/components/skeleton";
import * as React from "react";
import { View } from "react-native";

import { BalanceCell, COLUMN_WIDTH, LocationCell, PersonCell, usePeopleTable, type PersonColumns } from "./data-grid-sample";
import { DATA_GRID_SAMPLE_PEOPLE } from "./data-grid-sample-people";

/** An avatar and two text bars, standing in for a person while they load. */
const PERSON_SKELETON = (
	<View className="flex-row items-center gap-2.5">
		<Skeleton className="size-8 rounded-full" />
		<View className="flex-1 gap-1.5">
			<Skeleton className="h-3 w-24 rounded" />
			<Skeleton className="h-2.5 w-32 rounded" />
		</View>
	</View>
);

const COLUMNS: PersonColumns = [
	{ accessorKey: "name", header: "User", cell: PersonCell, size: COLUMN_WIDTH.person, meta: { skeleton: PERSON_SKELETON } },
	{ accessorKey: "location", header: "Location", cell: LocationCell, size: COLUMN_WIDTH.location, meta: { skeleton: <Skeleton className="h-3 w-24 rounded" /> } },
	{ accessorKey: "balance", header: "Balance", cell: BalanceCell, size: COLUMN_WIDTH.balance, meta: { align: "end", skeleton: <Skeleton className="h-3 w-16 rounded" /> } },
];

/** How long the simulated load takes. */
const LOAD_MS = 1500;

// Placeholder rows drawn from each column's skeleton while the grid loads; Reload shows them again.
export function DataGrid21Example(): React.JSX.Element {
	const [loading, setLoading] = React.useState(true);
	const table = usePeopleTable({ columns: COLUMNS });
	React.useEffect((): (() => void) | undefined => {
		if (!loading) {
			return undefined;
		}
		const timer = setTimeout((): void => {
			setLoading(false);
		}, LOAD_MS);
		return (): void => {
			clearTimeout(timer);
		};
	}, [loading]);
	const reload = React.useCallback((): void => {
		setLoading(true);
	}, []);
	return (
		<DataGrid table={table} recordCount={DATA_GRID_SAMPLE_PEOPLE.length} isLoading={loading}>
			<View className="w-full gap-2.5">
				<Button label="Reload" variant="outline" size="sm" onPress={reload} disabled={loading} className="self-start" />
				<DataGridContainer>
					<DataGridTable />
				</DataGridContainer>
				<DataGridPagination />
			</View>
		</DataGrid>
	);
}

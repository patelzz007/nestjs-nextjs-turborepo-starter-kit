import { useTable, type PaginationState, type SortingState } from "@tanstack/react-table";
import { DataGrid, DataGridContainer, DataGridTable } from "@workspace/ui-native/components/data-grid";
import { DataGridColumnHeader, DataGridPagination } from "@workspace/ui-native/components/data-grid-parts";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { Input } from "@workspace/ui-native/components/input";
import { dataGridFeatures } from "@workspace/ui-native/lib/data-grid";
import * as React from "react";
import { Text, View } from "react-native";

import { EmployeeBalanceCell, EmployeeCell, EmployeeStatusCell, type EmployeeColumns } from "./data-grid-sample";
import { EMPLOYEE_STATUSES, employeeId, fetchServerPage, type Employee, type EmployeeStatus, type ServerRequest } from "./data-grid-sample-records";

const WIDTH = { person: 200, status: 110, balance: 120 } satisfies Record<string, number>;
const PAGE_SIZE = 5;
const ALL = "all";

const COLUMNS: EmployeeColumns = [
	{ accessorKey: "name", header: ({ column }) => <DataGridColumnHeader column={column} />, cell: EmployeeCell, size: WIDTH.person, meta: { headerTitle: "Name" } },
	{ accessorKey: "status", header: "Status", cell: EmployeeStatusCell, size: WIDTH.status, enableSorting: false },
	{
		accessorKey: "balance",
		header: ({ column }) => <DataGridColumnHeader column={column} />,
		cell: EmployeeBalanceCell,
		size: WIDTH.balance,
		meta: { headerTitle: "Balance", align: "end" },
	},
];

// The server pages, sorts, searches and filters: the grid sends what is asked and shows the page that comes back.
export function DataGrid34Example(): React.JSX.Element {
	const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE });
	const [sorting, setSorting] = React.useState<SortingState>([]);
	const [search, setSearch] = React.useState("");
	const [status, setStatus] = React.useState<EmployeeStatus | null>(null);
	const request = React.useMemo(
		(): ServerRequest => ({ pageIndex: pagination.pageIndex, pageSize: pagination.pageSize, sorting, search, status }),
		[pagination, search, sorting, status],
	);
	const requestText = JSON.stringify(request);
	/** The last answer, with the request it answered: while they differ, the grid is loading. */
	const [answer, setAnswer] = React.useState<{ readonly request: string; readonly rows: readonly Employee[]; readonly total: number } | null>(null);

	React.useEffect((): (() => void) => {
		let current = true;
		fetchServerPage(request)
			.then((response): void => {
				if (current) {
					setAnswer({ request: JSON.stringify(request), rows: response.rows, total: response.total });
				}
			})
			// The simulated server always answers; a real one's failure would show an error state here.
			.catch((): void => undefined);
		return (): void => {
			current = false;
		};
	}, [request]);
	const loading = answer?.request !== requestText;
	const page = answer ?? { rows: [], total: 0 };

	const table = useTable({
		features: dataGridFeatures,
		columns: COLUMNS,
		data: page.rows,
		getRowId: employeeId,
		manualPagination: true,
		manualSorting: true,
		rowCount: page.total,
		state: { pagination, sorting },
		onPaginationChange: setPagination,
		onSortingChange: setSorting,
	});
	const changeSearch = React.useCallback((text: string): void => {
		setSearch(text);
		setPagination((current) => ({ ...current, pageIndex: 0 }));
	}, []);
	const items = React.useMemo(
		(): readonly DropdownMenuItemData<string>[] => [
			{ value: ALL, label: "All statuses", kind: "radio", checked: status === null },
			...EMPLOYEE_STATUSES.map((option: EmployeeStatus): DropdownMenuItemData<string> => ({ value: option, label: option, kind: "radio", checked: status === option })),
		],
		[status],
	);
	const changeStatus = React.useCallback((value: string): void => {
		setStatus(EMPLOYEE_STATUSES.find((option: EmployeeStatus): boolean => option === value) ?? null);
		setPagination((current) => ({ ...current, pageIndex: 0 }));
	}, []);
	return (
		<DataGrid table={table} recordCount={page.total} isLoading={loading} loadingMode="spinner" emptyMessage="No records match.">
			<View className="w-full gap-2.5">
				<View className="flex-row items-center gap-2">
					<View className="flex-1">
						<Input value={search} onChange={changeSearch} placeholder="Search the server" accessibilityLabel="Search the server" size="sm" />
					</View>
					<DropdownMenu label={status ?? "All"} title="Status" items={items} onSelect={changeStatus} size="sm" variant="outline" />
				</View>
				<DataGridContainer>
					<DataGridTable />
				</DataGridContainer>
				<DataGridPagination />
				<Text numberOfLines={2} className="text-caption font-mono text-muted-foreground">
					{requestText}
				</Text>
			</View>
		</DataGrid>
	);
}

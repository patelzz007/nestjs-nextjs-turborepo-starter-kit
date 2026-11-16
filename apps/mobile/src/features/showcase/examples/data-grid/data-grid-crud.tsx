// The two CRUD examples' shared admin list: a search, a status filter that counts each status, row checkboxes and a
// row menu (copy the email, block or unblock, remove), over employees the example holds in its own state.

import { useTable, type PaginationState, type RowSelectionState, type SortingState } from "@tanstack/react-table";
import { Badge } from "@workspace/ui-native/components/badge";
import { DataGrid, DataGridTable } from "@workspace/ui-native/components/data-grid";
import { DataGridColumnHeader, DataGridPagination, DataGridRowSelect, DataGridRowSelectAll } from "@workspace/ui-native/components/data-grid-parts";
import { DropdownMenu, type DropdownMenuItemData } from "@workspace/ui-native/components/dropdown-menu";
import { Input } from "@workspace/ui-native/components/input";
import { dataGridFeatures, type DataGridTableLayout } from "@workspace/ui-native/lib/data-grid";
import * as Clipboard from "expo-clipboard";
import FunnelIcon from "lucide-react-native/icons/funnel";
import MoreHorizontalIcon from "lucide-react-native/icons/ellipsis";
import SearchIcon from "lucide-react-native/icons/search";
import { Icon } from "@workspace/ui-native/components/icon";
import * as React from "react";
import { Text, View } from "react-native";

import { EmployeeBalanceCell, EmployeeCell, EmployeeStatusCell, type EmployeeColumns } from "./data-grid-sample";
import { EMPLOYEE_STATUSES, EMPLOYEES, employeeId, type Employee, type EmployeeStatus } from "./data-grid-sample-records";

const WIDTH = { select: 48, person: 200, status: 110, balance: 120, actions: 56 } satisfies Record<string, number>;
const PAGE_SIZE = 5;

/** The people whose name or email holds `search` (ignoring case) and whose status is one of `statuses` (any when none). */
export function filterEmployees(rows: readonly Employee[], search: string, statuses: readonly EmployeeStatus[]): readonly Employee[] {
	const needle = search.trim().toLowerCase();
	return rows.filter(
		(row: Employee): boolean =>
			(needle === "" || row.name.toLowerCase().includes(needle) || row.email.includes(needle)) && (statuses.length === 0 || statuses.includes(row.status)),
	);
}

/** How many people hold each status. */
export function countStatuses(rows: readonly Employee[]): Readonly<Record<EmployeeStatus, number>> {
	return {
		Active: 0,
		Inactive: 0,
		Pending: 0,
		Blocked: 0,
		...Object.fromEntries(
			EMPLOYEE_STATUSES.map((status: EmployeeStatus): [EmployeeStatus, number] => [status, rows.filter((row: Employee): boolean => row.status === status).length]),
		),
	};
}

type RowAction = "copy" | "block" | "remove";

interface RowMenuProps {
	readonly employee: Employee;
	readonly onAction: (employee: Employee, action: RowAction) => void;
}

function RowMenu({ employee, onAction }: RowMenuProps): React.JSX.Element {
	const items = React.useMemo(
		(): readonly DropdownMenuItemData<RowAction>[] => [
			{ value: "copy", label: "Copy email" },
			{ value: "block", label: employee.status === "Blocked" ? "Unblock" : "Block" },
			{ value: "remove", label: "Remove", variant: "destructive" },
		],
		[employee.status],
	);
	const select = React.useCallback(
		(action: RowAction): void => {
			onAction(employee, action);
		},
		[employee, onAction],
	);
	return <DropdownMenu label={`Actions for ${employee.name}`} items={items} onSelect={select} icon={MoreHorizontalIcon} size="sm" variant="ghost" hideChevron />;
}

export interface CrudGridProps {
	readonly layout?: DataGridTableLayout | undefined;
	/** Draws the grid's chrome: the toolbar (search and filter) and the grid with its pager. */
	readonly frame: (parts: { readonly toolbar: React.ReactNode; readonly grid: React.ReactNode; readonly pager: React.ReactNode; readonly count: string }) => React.JSX.Element;
}

/** The grid's columns; the row menu's actions go to `act`. */
function employeeColumns(act: RowMenuProps["onAction"]): EmployeeColumns {
	return [
		{
			id: "select",
			header: () => <DataGridRowSelectAll />,
			cell: ({ row }) => <DataGridRowSelect row={row} />,
			size: WIDTH.select,
			enableSorting: false,
		},
		{
			accessorKey: "name",
			header: ({ column }) => <DataGridColumnHeader column={column} />,
			cell: EmployeeCell,
			size: WIDTH.person,
			meta: { headerTitle: "Member" },
		},
		{
			accessorKey: "status",
			header: ({ column }) => <DataGridColumnHeader column={column} />,
			cell: EmployeeStatusCell,
			size: WIDTH.status,
			meta: { headerTitle: "Status" },
		},
		{
			accessorKey: "balance",
			header: ({ column }) => <DataGridColumnHeader column={column} />,
			cell: EmployeeBalanceCell,
			size: WIDTH.balance,
			meta: { headerTitle: "Balance", align: "end" },
		},
		{
			id: "actions",
			header: "",
			cell: ({ row }) => <RowMenu employee={row.original} onAction={act} />,
			size: WIDTH.actions,
			enableSorting: false,
		},
	];
}

/** The admin list: its own rows, search, status filter, selection and row actions; `frame` lays them out. */
export function CrudGrid({ layout, frame }: CrudGridProps): React.JSX.Element {
	const [rows, setRows] = React.useState<readonly Employee[]>(EMPLOYEES);
	const [search, setSearch] = React.useState("");
	const [statuses, setStatuses] = React.useState<readonly EmployeeStatus[]>([]);
	const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE });
	const [sorting, setSorting] = React.useState<SortingState>([]);
	const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
	const [notice, setNotice] = React.useState("");
	const shown = React.useMemo(() => filterEmployees(rows, search, statuses), [rows, search, statuses]);
	const counts = React.useMemo(() => countStatuses(rows), [rows]);

	const act = React.useCallback((employee: Employee, action: RowAction): void => {
		if (action === "copy") {
			Clipboard.setStringAsync(employee.email)
				.then((): void => {
					setNotice(`Copied ${employee.email}`);
				})
				// A clipboard that refuses the copy leaves nothing to undo: the notice simply does not change.
				.catch((): void => undefined);
			return;
		}
		if (action === "remove") {
			setRows((current) => current.filter((row: Employee): boolean => row.id !== employee.id));
			setNotice(`Removed ${employee.name}`);
			return;
		}
		setRows((current) => current.map((row: Employee): Employee => (row.id === employee.id ? { ...row, status: row.status === "Blocked" ? "Active" : "Blocked" } : row)));
	}, []);

	const columns = React.useMemo((): EmployeeColumns => employeeColumns(act), [act]);
	const table = useTable({
		features: dataGridFeatures,
		columns,
		data: shown,
		getRowId: employeeId,
		enableRowSelection: true,
		state: { pagination, sorting, rowSelection },
		onPaginationChange: setPagination,
		onSortingChange: setSorting,
		onRowSelectionChange: setRowSelection,
	});

	const changeSearch = React.useCallback((text: string): void => {
		setSearch(text);
		setPagination((current) => ({ ...current, pageIndex: 0 }));
	}, []);
	const filterItems = React.useMemo(
		(): readonly DropdownMenuItemData<EmployeeStatus>[] =>
			EMPLOYEE_STATUSES.map((status: EmployeeStatus): DropdownMenuItemData<EmployeeStatus> => ({
				value: status,
				label: status,
				kind: "checkbox",
				checked: statuses.includes(status),
				trailing: String(counts[status]),
			})),
		[counts, statuses],
	);
	const toggleStatus = React.useCallback((status: EmployeeStatus): void => {
		setStatuses((current) => (current.includes(status) ? current.filter((candidate: EmployeeStatus): boolean => candidate !== status) : [...current, status]));
		setPagination((current) => ({ ...current, pageIndex: 0 }));
	}, []);
	const selected = Object.values(rowSelection).filter(Boolean).length;

	const toolbar = (
		<View className="gap-2">
			<View className="flex-row items-center gap-2">
				<View className="flex-1">
					<Input
						value={search}
						onChange={changeSearch}
						placeholder="Search members"
						accessibilityLabel="Search members"
						leading={<Icon icon={SearchIcon} size="sm" colorClassName="accent-muted-foreground" />}
						size="sm"
					/>
				</View>
				<DropdownMenu label="Status" title="Filter by status" items={filterItems} onSelect={toggleStatus} icon={FunnelIcon} size="sm" variant="outline" />
			</View>
			{statuses.length === 0 && notice === "" ? null : (
				<View className="flex-row flex-wrap items-center gap-1.5">
					{statuses.map((status: EmployeeStatus): React.JSX.Element => (
						<Badge key={status} label={status} variant="light" tone="primary" size="sm" />
					))}
					{notice === "" ? null : <Text className="text-caption font-sans text-muted-foreground">{notice}</Text>}
				</View>
			)}
		</View>
	);
	return (
		<DataGrid table={table} recordCount={shown.length} tableLayout={layout} emptyMessage="No members match.">
			{frame({
				toolbar,
				grid: <DataGridTable />,
				pager: <DataGridPagination />,
				count: selected === 0 ? `${String(shown.length)} members` : `${String(selected)} selected`,
			})}
		</DataGrid>
	);
}

"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Badge, type BadgeVariant } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardFooter, CardHeader } from "@workspace/ui/components/card";
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures, type DataGridTableLayout } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridColumnHeader } from "@workspace/ui/components/data-grid/data-grid-column-header";
import { DataGridPagination } from "@workspace/ui/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import { DataGridTable, DataGridTableRowPin } from "@workspace/ui/components/data-grid/data-grid-table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { toastMessage } from "@workspace/ui/components/toast";
import { useCopyToClipboard } from "@workspace/ui/hooks/use-copy-to-clipboard";
import { useTable, type ColumnDef, type Row, type RowPinningState, type TableOptions } from "@tanstack/react-table";
import { MoreHorizontalIcon, RefreshCwIcon } from "lucide-react";
import * as React from "react";

type EmployeeStatus = "Active" | "Inactive" | "Pending" | "Blocked";

interface IData {
	readonly id: string;
	readonly name: string;
	readonly avatar: string;
	readonly role: string;
	readonly status: EmployeeStatus;
	readonly balance: number;
}

const DEMO_DATA: readonly IData[] = [
	{
		id: "1",
		name: "Alex Johnson",
		avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
		role: "CEO",
		status: "Active",
		balance: 5143.03,
	},
	{
		id: "2",
		name: "Sarah Chen",
		avatar: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
		role: "CTO",
		status: "Active",
		balance: 4321.87,
	},
	{
		id: "3",
		name: "Michael Rodriguez",
		avatar: "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80",
		role: "Designer",
		status: "Blocked",
		balance: 7654.98,
	},
	{
		id: "4",
		name: "Emma Wilson",
		avatar: "https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80",
		role: "Developer",
		status: "Inactive",
		balance: 3456.45,
	},
	{
		id: "5",
		name: "David Kim",
		avatar: "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=96&h=96&dpr=2&q=80",
		role: "Lawyer",
		status: "Active",
		balance: 9876.54,
	},
	{
		id: "6",
		name: "Aron Thompson",
		avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=96&h=96&dpr=2&q=80",
		role: "Director",
		status: "Pending",
		balance: 6214.22,
	},
	{
		id: "7",
		name: "James Brown",
		avatar: "https://images.unsplash.com/photo-1543299750-19d1d6297053?w=96&h=96&dpr=2&q=80",
		role: "Product Manager",
		status: "Inactive",
		balance: 5321.77,
	},
	{
		id: "8",
		name: "Maria Garcia",
		avatar: "https://images.unsplash.com/photo-1620075225255-8c2051b6c015?w=96&h=96&dpr=2&q=80",
		role: "Marketing Lead",
		status: "Active",
		balance: 8452.39,
	},
	{
		id: "9",
		name: "Nick Johnson",
		avatar: "https://images.unsplash.com/photo-1485206412256-701ccc5b93ca?w=96&h=96&dpr=2&q=80",
		role: "Data Scientist",
		status: "Pending",
		balance: 7345.1,
	},
	{
		id: "10",
		name: "Liam Thompson",
		avatar: "https://images.unsplash.com/photo-1542595913-85d69b0edbaf?w=96&h=96&dpr=2&q=80",
		role: "Engineer",
		status: "Inactive",
		balance: 5214.88,
	},
	{
		id: "11",
		name: "Olivia Martinez",
		avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=96&h=96&dpr=2&q=80",
		role: "VP of Sales",
		status: "Active",
		balance: 11234.56,
	},
	{
		id: "12",
		name: "Ethan Park",
		avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=96&h=96&dpr=2&q=80",
		role: "DevOps Lead",
		status: "Active",
		balance: 8910.33,
	},
	{
		id: "13",
		name: "Sophie Taylor",
		avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=96&h=96&dpr=2&q=80",
		role: "UX Researcher",
		status: "Pending",
		balance: 6543.21,
	},
	{
		id: "14",
		name: "Ryan Mitchell",
		avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=96&h=96&dpr=2&q=80",
		role: "Architect",
		status: "Inactive",
		balance: 7821.44,
	},
	{
		id: "15",
		name: "Isabella Wong",
		avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=96&h=96&dpr=2&q=80",
		role: "QA Manager",
		status: "Active",
		balance: 5678.9,
	},
];

const STATUS_BADGE_VARIANTS: Readonly<Record<EmployeeStatus, BadgeVariant>> = {
	Active: "success-outline",
	Blocked: "destructive-outline",
	Inactive: "info-outline",
	Pending: "warning-outline",
};

const USD_FORMAT = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

function getInitials(name: string): string {
	return name
		.split(" ")
		.map((part: string): string => part.charAt(0))
		.join("");
}

function getRowId(row: IData): string {
	return row.id;
}

/** Rows per page. */
const PAGE_SIZE = 10;

const INITIAL_STATE: NonNullable<TableOptions<DataGridFeatures, IData>["initialState"]> = {
	pagination: { pageIndex: 0, pageSize: PAGE_SIZE },
	sorting: [{ id: "name", desc: false }],
};

const NO_PINNED_ROWS: RowPinningState = { top: [], bottom: [] };

const TABLE_LAYOUT: DataGridTableLayout = { rowsPinnable: true, columnsResizable: true };

interface ActionsCellProps {
	readonly row: Row<DataGridFeatures, IData>;
}

function ActionsCell({ row }: ActionsCellProps): React.JSX.Element {
	const { copyToClipboard } = useCopyToClipboard();
	const isPinned = row.getIsPinned() !== false;
	const { id, name } = row.original;

	const handleTogglePin = React.useCallback((): void => {
		row.pin(isPinned ? false : "top");
	}, [row, isPinned]);

	const handleEdit = React.useCallback((): void => {
		toastMessage.info({ title: "Edit employee", description: name });
	}, [name]);

	const handleCopyId = React.useCallback((): void => {
		copyToClipboard(id);
		toastMessage.success({ title: "Employee ID copied", description: id });
	}, [copyToClipboard, id]);

	const handleDelete = React.useCallback((): void => {
		toastMessage.warning({ title: "Delete employee", description: name });
	}, [name]);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button className="size-7" size="icon" variant="ghost" aria-label={`Actions for ${name}`}>
						<MoreHorizontalIcon />
					</Button>
				}
			/>
			<DropdownMenuContent side="bottom" align="start">
				<DropdownMenuItem onClick={handleTogglePin}>{isPinned ? "Unpin row" : "Pin to top"}</DropdownMenuItem>
				<DropdownMenuItem onClick={handleEdit}>Edit</DropdownMenuItem>
				<DropdownMenuItem onClick={handleCopyId}>Copy ID</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem variant="destructive" onClick={handleDelete}>
					Delete
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

const COLUMNS: ColumnDef<DataGridFeatures, IData>[] = [
	{
		id: "pin",
		header: "",
		cell: ({ row }): React.JSX.Element => <DataGridTableRowPin row={row} />,
		size: 40,
		enableSorting: false,
		enableHiding: false,
		enableResizing: false,
	},
	{
		accessorKey: "name",
		id: "name",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="User" column={column} />,
		cell: ({ row }): React.JSX.Element => (
			<div className="flex items-center gap-3">
				<Avatar className="size-8">
					<AvatarImage src={row.original.avatar} alt={row.original.name} />
					<AvatarFallback>{getInitials(row.original.name)}</AvatarFallback>
				</Avatar>
				<div className="min-w-0 truncate font-medium text-foreground">{row.original.name}</div>
			</div>
		),
		minSize: 150,
		meta: { autoSize: true },
		enableSorting: true,
		enableHiding: false,
	},
	{
		accessorKey: "role",
		id: "role",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Role" column={column} />,
		cell: ({ row }): React.JSX.Element => <span className="text-foreground">{row.original.role}</span>,
		size: 160,
		enableSorting: true,
	},
	{
		accessorKey: "status",
		id: "status",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Status" column={column} />,
		cell: ({ row }): React.JSX.Element => <Badge variant={STATUS_BADGE_VARIANTS[row.original.status]}>{row.original.status}</Badge>,
		size: 120,
		enableSorting: true,
	},
	{
		accessorKey: "balance",
		id: "balance",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Balance" column={column} />,
		cell: ({ row }): React.JSX.Element => <span className="text-foreground tabular-nums">{USD_FORMAT.format(row.original.balance)}</span>,
		size: 140,
		enableSorting: true,
	},
	{
		id: "actions",
		header: "",
		cell: ({ row }): React.JSX.Element => <ActionsCell row={row} />,
		size: 60,
		enableSorting: false,
		enableHiding: false,
		enableResizing: false,
	},
];

export function DataGrid29Example(): React.JSX.Element {
	const [rowPinning, setRowPinning] = React.useState<RowPinningState>(NO_PINNED_ROWS);

	const table = useTable({
		features: dataGridFeatures,
		columns: COLUMNS,
		data: DEMO_DATA,
		getRowId,
		enableRowPinning: true,
		keepPinnedRows: true,
		initialState: INITIAL_STATE,
		state: { rowPinning },
		onRowPinningChange: setRowPinning,
	});

	const pinnedCount = rowPinning.top.length;

	const handleUnpinAll = React.useCallback((): void => {
		setRowPinning(NO_PINNED_ROWS);
	}, []);

	return (
		<DataGrid table={table} recordCount={DEMO_DATA.length} tableLayout={TABLE_LAYOUT}>
			<Card className="w-full gap-0 p-0">
				<CardHeader className="flex items-center justify-between px-3 py-2">
					<div className="flex items-center gap-2">
						<span className="text-sm font-medium text-foreground">Team Members</span>
						{pinnedCount > 0 ? (
							<Badge variant="primary-outline" size="sm">
								{pinnedCount} pinned
							</Badge>
						) : null}
					</div>
					<div className="flex items-center gap-1">
						{pinnedCount > 0 ? (
							<Button variant="ghost" size="sm" onClick={handleUnpinAll}>
								Unpin all
							</Button>
						) : null}
						<Button variant="ghost" size="icon" className="size-8" aria-label="Refresh">
							<RefreshCwIcon className="size-4" />
						</Button>
					</div>
				</CardHeader>
				<CardContent className="p-0">
					<Card className="p-0">
						<DataGridContainer>
							<DataGridScrollArea>
								<DataGridTable />
							</DataGridScrollArea>
						</DataGridContainer>
					</Card>
				</CardContent>
				<CardFooter className="border-none bg-transparent! px-3 py-2">
					<DataGridPagination />
				</CardFooter>
			</Card>
		</DataGrid>
	);
}

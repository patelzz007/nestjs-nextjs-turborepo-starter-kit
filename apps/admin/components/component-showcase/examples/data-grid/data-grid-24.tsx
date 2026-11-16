"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Badge, type BadgeVariant } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader } from "@workspace/ui/components/card";
import { DataGrid, dataGridFeatures, type DataGridFeatures, type DataGridTableLayout } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridColumnHeader } from "@workspace/ui/components/data-grid/data-grid-column-header";
import { DataGridPagination } from "@workspace/ui/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import {
	DataGridTable,
	DataGridTableFootRow,
	DataGridTableFootRowCell,
	DataGridTableRowSelect,
	DataGridTableRowSelectAll,
} from "@workspace/ui/components/data-grid/data-grid-table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { toastMessage } from "@workspace/ui/components/toast";
import { useCopyToClipboard } from "@workspace/ui/hooks/use-copy-to-clipboard";
import { useTable, type ColumnDef, type Row, type TableOptions } from "@tanstack/react-table";
import { DownloadIcon, MoreHorizontalIcon, TableIcon } from "lucide-react";
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

const STATUS_BADGE_VARIANTS: Readonly<Record<EmployeeStatus, BadgeVariant>> = {
	Active: "success-outline",
	Blocked: "destructive-outline",
	Inactive: "info-outline",
	Pending: "warning-outline",
};

const USD_FORMAT = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

function formatUsd(amount: number): string {
	return USD_FORMAT.format(amount);
}

function getInitials(name: string): string {
	return name
		.split(" ")
		.map((part: string): string => part.charAt(0))
		.join("");
}

function getRowId(row: IData): string {
	return row.id;
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
		status: "Inactive",
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
		status: "Blocked",
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
];

const TOTAL_BALANCE = DEMO_DATA.reduce((sum: number, row: IData): number => sum + row.balance, 0);

/** Rows per page. */
const PAGE_SIZE = 5;

/** Footer cells after the label: the balance total and the empty actions cell. */
const FOOTER_TRAILING_CELLS = 2;

const INITIAL_STATE: NonNullable<TableOptions<DataGridFeatures, IData>["initialState"]> = {
	pagination: { pageIndex: 0, pageSize: PAGE_SIZE },
	sorting: [{ id: "name", desc: false }],
};

const TABLE_LAYOUT: DataGridTableLayout = { columnsPinnable: true, columnsResizable: true, columnsVisibility: true };

interface ActionsCellProps {
	readonly row: Row<DataGridFeatures, IData>;
}

function ActionsCell({ row }: ActionsCellProps): React.JSX.Element {
	const { copyToClipboard } = useCopyToClipboard();
	const { id, name } = row.original;

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
		accessorKey: "id",
		id: "id",
		header: (): React.JSX.Element => <DataGridTableRowSelectAll />,
		cell: ({ row }): React.JSX.Element => <DataGridTableRowSelect row={row} />,
		enableSorting: false,
		size: 35,
		enableResizing: false,
	},
	{
		accessorKey: "name",
		id: "name",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="User" visibility column={column} />,
		cell: ({ row }): React.JSX.Element => (
			<div className="flex items-center gap-3">
				<Avatar className="size-8">
					<AvatarImage src={row.original.avatar} alt={row.original.name} />
					<AvatarFallback>{getInitials(row.original.name)}</AvatarFallback>
				</Avatar>
				<div className="font-medium text-foreground">{row.original.name}</div>
			</div>
		),
		minSize: 200,
		meta: { autoSize: true },
		enableSorting: true,
		enableHiding: false,
		enableResizing: true,
	},
	{
		accessorKey: "role",
		id: "role",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Role" visibility column={column} />,
		cell: ({ row }): React.JSX.Element => <div className="font-medium text-foreground">{row.original.role}</div>,
		size: 150,
		enableSorting: true,
		enableHiding: true,
		enableResizing: true,
	},
	{
		accessorKey: "status",
		id: "status",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Status" visibility column={column} />,
		cell: ({ row }): React.JSX.Element => <Badge variant={STATUS_BADGE_VARIANTS[row.original.status]}>{row.original.status}</Badge>,
		size: 110,
		enableSorting: true,
		enableHiding: true,
		enableResizing: true,
	},
	{
		accessorKey: "balance",
		id: "balance",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Balance" visibility column={column} />,
		cell: ({ row }): React.JSX.Element => <div className="font-medium text-foreground tabular-nums">{formatUsd(row.original.balance)}</div>,
		size: 130,
		enableSorting: true,
		enableHiding: true,
		enableResizing: true,
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

export function DataGrid24Example(): React.JSX.Element {
	const table = useTable({
		features: dataGridFeatures,
		columns: COLUMNS,
		data: DEMO_DATA,
		getRowId,
		initialState: INITIAL_STATE,
	});

	const visibleCount = table.getVisibleLeafColumns().length;

	const footer = (
		<DataGridTableFootRow>
			{/* Label spans every column before the balance. */}
			<DataGridTableFootRowCell colSpan={visibleCount - FOOTER_TRAILING_CELLS}>
				<span className="text-muted-foreground">Total balance</span>
			</DataGridTableFootRowCell>
			<DataGridTableFootRowCell className="font-bold tabular-nums">{formatUsd(TOTAL_BALANCE)}</DataGridTableFootRowCell>
			<DataGridTableFootRowCell />
		</DataGridTableFootRow>
	);

	return (
		<DataGrid table={table} recordCount={DEMO_DATA.length} tableLayout={TABLE_LAYOUT}>
			<Card className="w-full gap-0 py-0">
				<CardHeader className="flex items-center justify-between px-3.5 py-2">
					<div className="flex items-center gap-2">
						<TableIcon className="size-4 text-muted-foreground" />
						<span className="text-sm font-medium text-foreground">Employee Balances</span>
					</div>
					<CardAction>
						<Button variant="outline" size="sm">
							<DownloadIcon />
							Export
						</Button>
					</CardAction>
				</CardHeader>
				<CardContent className="border-y px-0">
					<DataGridScrollArea>
						<DataGridTable footerContent={footer} />
					</DataGridScrollArea>
				</CardContent>
				<CardFooter className="border-none bg-transparent! px-3.5 py-2">
					<DataGridPagination />
				</CardFooter>
			</Card>
		</DataGrid>
	);
}

"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Badge, type BadgeVariant } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { DataGrid, dataGridFeatures, type DataGridFeatures, type DataGridTableLayout } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridColumnHeader } from "@workspace/ui/components/data-grid/data-grid-column-header";
import { DataGridPagination } from "@workspace/ui/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import { DataGridTable, DataGridTableFootRow, DataGridTableFootRowCell } from "@workspace/ui/components/data-grid/data-grid-table";
import { useTable, type ColumnDef, type TableOptions } from "@tanstack/react-table";
import { DownloadIcon } from "lucide-react";
import * as React from "react";

type EmployeeStatus = "Active" | "Inactive" | "Pending" | "Blocked";

interface IData {
	readonly id: string;
	readonly name: string;
	readonly avatar: string;
	readonly status: EmployeeStatus;
	readonly balance: number;
	readonly transactions: number;
}

const DEMO_DATA: readonly IData[] = [
	{
		id: "1",
		name: "Alex Johnson",
		avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
		status: "Active",
		balance: 5143.03,
		transactions: 48,
	},
	{
		id: "2",
		name: "Sarah Chen",
		avatar: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
		status: "Inactive",
		balance: 4321.87,
		transactions: 31,
	},
	{
		id: "3",
		name: "Michael Rodriguez",
		avatar: "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80",
		status: "Blocked",
		balance: 7654.98,
		transactions: 67,
	},
	{
		id: "4",
		name: "Emma Wilson",
		avatar: "https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80",
		status: "Inactive",
		balance: 3456.45,
		transactions: 22,
	},
	{
		id: "5",
		name: "David Kim",
		avatar: "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=96&h=96&dpr=2&q=80",
		status: "Active",
		balance: 9876.54,
		transactions: 93,
	},
	{
		id: "6",
		name: "Aron Thompson",
		avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=96&h=96&dpr=2&q=80",
		status: "Pending",
		balance: 6214.22,
		transactions: 55,
	},
	{
		id: "7",
		name: "James Brown",
		avatar: "https://images.unsplash.com/photo-1543299750-19d1d6297053?w=96&h=96&dpr=2&q=80",
		status: "Inactive",
		balance: 5321.77,
		transactions: 40,
	},
	{
		id: "8",
		name: "Maria Garcia",
		avatar: "https://images.unsplash.com/photo-1620075225255-8c2051b6c015?w=96&h=96&dpr=2&q=80",
		status: "Blocked",
		balance: 8452.39,
		transactions: 74,
	},
	{
		id: "9",
		name: "Nick Johnson",
		avatar: "https://images.unsplash.com/photo-1485206412256-701ccc5b93ca?w=96&h=96&dpr=2&q=80",
		status: "Pending",
		balance: 7345.1,
		transactions: 61,
	},
	{
		id: "10",
		name: "Liam Thompson",
		avatar: "https://images.unsplash.com/photo-1542595913-85d69b0edbaf?w=96&h=96&dpr=2&q=80",
		status: "Inactive",
		balance: 5214.88,
		transactions: 37,
	},
];

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

function sum(values: readonly number[]): number {
	return values.reduce((total: number, value: number): number => total + value, 0);
}

interface ColumnAggregates {
	readonly avgBalance: number;
	readonly minBalance: number;
	readonly maxBalance: number;
	readonly avgTxns: number;
	readonly minTxns: number;
	readonly maxTxns: number;
}

function getAggregates(rows: readonly IData[]): ColumnAggregates {
	const balances = rows.map((row: IData): number => row.balance);
	const txns = rows.map((row: IData): number => row.transactions);
	return {
		avgBalance: sum(balances) / rows.length,
		minBalance: Math.min(...balances),
		maxBalance: Math.max(...balances),
		avgTxns: Math.round(sum(txns) / rows.length),
		minTxns: Math.min(...txns),
		maxTxns: Math.max(...txns),
	};
}

const AGGREGATES = getAggregates(DEMO_DATA);

/** Rows per page. */
const PAGE_SIZE = 5;

/** The summary label spans the user and status columns. */
const SUMMARY_COL_SPAN = 2;

const INITIAL_STATE: NonNullable<TableOptions<DataGridFeatures, IData>["initialState"]> = {
	pagination: { pageIndex: 0, pageSize: PAGE_SIZE },
	sorting: [{ id: "name", desc: false }],
};

const TABLE_LAYOUT: DataGridTableLayout = { columnsPinnable: true, columnsResizable: true, columnsVisibility: true };

const COLUMNS: ColumnDef<DataGridFeatures, IData>[] = [
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
		accessorKey: "status",
		id: "status",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Status" visibility column={column} />,
		cell: ({ row }): React.JSX.Element => <Badge variant={STATUS_BADGE_VARIANTS[row.original.status]}>{row.original.status}</Badge>,
		size: 150,
		enableSorting: true,
		enableHiding: true,
		enableResizing: true,
	},
	{
		accessorKey: "balance",
		id: "balance",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Balance" visibility column={column} />,
		cell: ({ row }): React.JSX.Element => <div className="font-medium text-foreground tabular-nums">{formatUsd(row.original.balance)}</div>,
		size: 150,
		enableSorting: true,
		enableHiding: true,
		enableResizing: true,
	},
	{
		accessorKey: "transactions",
		id: "transactions",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Transactions" visibility column={column} />,
		cell: ({ row }): React.JSX.Element => <div className="font-medium text-foreground tabular-nums">{row.original.transactions}</div>,
		size: 150,
		enableSorting: true,
		enableHiding: true,
		enableResizing: true,
	},
];

const FOOTER: React.JSX.Element = (
	<DataGridTableFootRow>
		<DataGridTableFootRowCell colSpan={SUMMARY_COL_SPAN}>
			<div className="flex flex-col gap-0.5">
				<span className="text-muted-foreground">Summary</span>
				<span className="font-medium text-foreground">Across all members</span>
				<span className="text-muted-foreground tabular-nums">{DEMO_DATA.length} members</span>
			</div>
		</DataGridTableFootRowCell>
		<DataGridTableFootRowCell>
			<div className="flex flex-col gap-0.5">
				<span className="text-muted-foreground">Avg</span>
				<span className="tabular-nums">{formatUsd(AGGREGATES.avgBalance)}</span>
				<span className="text-muted-foreground tabular-nums">
					{formatUsd(AGGREGATES.minBalance)} - {formatUsd(AGGREGATES.maxBalance)}
				</span>
			</div>
		</DataGridTableFootRowCell>
		<DataGridTableFootRowCell>
			<div className="flex flex-col gap-0.5">
				<span className="text-muted-foreground">Avg</span>
				<span className="tabular-nums">{AGGREGATES.avgTxns}</span>
				<span className="text-muted-foreground tabular-nums">
					{AGGREGATES.minTxns} - {AGGREGATES.maxTxns}
				</span>
			</div>
		</DataGridTableFootRowCell>
	</DataGridTableFootRow>
);

export function DataGrid26Example(): React.JSX.Element {
	const table = useTable({
		features: dataGridFeatures,
		columns: COLUMNS,
		data: DEMO_DATA,
		getRowId,
		initialState: INITIAL_STATE,
	});

	return (
		<DataGrid table={table} recordCount={DEMO_DATA.length} tableLayout={TABLE_LAYOUT}>
			<Card className="w-full gap-0 p-0">
				<CardHeader className="flex items-center justify-between gap-3 px-4 py-2">
					<CardTitle className="text-sm font-medium">Column Aggregates</CardTitle>
					<CardAction>
						<Button variant="outline" size="sm">
							<DownloadIcon />
							Export
						</Button>
					</CardAction>
				</CardHeader>
				<CardContent className="border-y px-0">
					<DataGridScrollArea>
						<DataGridTable footerContent={FOOTER} />
					</DataGridScrollArea>
				</CardContent>
				<CardFooter className="border-none bg-transparent! px-3.5 py-2">
					<DataGridPagination />
				</CardFooter>
			</Card>
		</DataGrid>
	);
}

"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Badge, type BadgeVariant } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { DataGrid, dataGridFeatures, type DataGridFeatures, type DataGridTableClassNames, type DataGridTableLayout } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridColumnHeader } from "@workspace/ui/components/data-grid/data-grid-column-header";
import { DataGridScrollArea } from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import { DataGridTableVirtual } from "@workspace/ui/components/data-grid/data-grid-table-virtual";
import { useTable, type ColumnDef } from "@tanstack/react-table";
import { RefreshCwIcon } from "lucide-react";
import * as React from "react";

type MemberStatus = "Active" | "Inactive" | "Pending";

interface IData {
	readonly id: string;
	readonly name: string;
	readonly avatar: string;
	readonly department: string;
	readonly status: MemberStatus;
	readonly balance: number;
}

/** A non-empty list, so cycling through it always yields a value. */
type NonEmptyList<TItem> = readonly [TItem, ...TItem[]];

const AVATARS: NonEmptyList<string> = [
	"https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
	"https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
	"https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80",
	"https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80",
	"https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=96&h=96&dpr=2&q=80",
	"https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=96&h=96&dpr=2&q=80",
];

const NAMES: NonEmptyList<string> = [
	"Alex Johnson",
	"Sarah Chen",
	"Michael Rodriguez",
	"Emma Wilson",
	"David Kim",
	"Aron Thompson",
	"James Brown",
	"Maria Garcia",
	"Nick Johnson",
	"Liam Thompson",
];

const DEPARTMENTS: NonEmptyList<string> = ["Engineering", "Marketing", "Design", "Sales", "Finance", "Operations", "Legal", "Support"];

const STATUSES: NonEmptyList<MemberStatus> = ["Active", "Inactive", "Pending"];

/** Rows in the virtualized directory. */
const ROW_COUNT = 200;

/** Generated balances fall in [BALANCE_MIN, BALANCE_MIN + BALANCE_RANGE). */
const BALANCE_MIN = 1000;
const BALANCE_RANGE = 9000;
/** A prime stride spreads consecutive rows across the balance range without randomness, so renders are deterministic. */
const BALANCE_STRIDE = 7919;
const CENTS_PER_DOLLAR = 100;
const CENTS_STRIDE = 37;

/** Row height before measurement, in pixels. */
const ROW_ESTIMATE_PX = 49;

function cycle<TItem>(items: NonEmptyList<TItem>, index: number): TItem {
	const [first] = items;
	return items.at(index % items.length) ?? first;
}

function generateData(count: number): IData[] {
	return Array.from({ length: count }, (_value: undefined, index: number): IData => ({
		id: String(index + 1),
		name: cycle(NAMES, index),
		avatar: cycle(AVATARS, index),
		department: cycle(DEPARTMENTS, index),
		status: cycle(STATUSES, index),
		balance: BALANCE_MIN + ((index * BALANCE_STRIDE) % BALANCE_RANGE) + ((index * CENTS_STRIDE) % CENTS_PER_DOLLAR) / CENTS_PER_DOLLAR,
	}));
}

const ALL_DATA: readonly IData[] = generateData(ROW_COUNT);

const STATUS_BADGE_VARIANTS: Readonly<Record<MemberStatus, BadgeVariant>> = {
	Active: "success-outline",
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

const TABLE_LAYOUT: DataGridTableLayout = { columnsResizable: true, headerSticky: true };

const TABLE_CLASS_NAMES: DataGridTableClassNames = { headerSticky: "sticky top-0 z-10 bg-muted/90 backdrop-blur-xs" };

const COLUMNS: ColumnDef<DataGridFeatures, IData>[] = [
	{
		accessorKey: "id",
		id: "id",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="#" column={column} />,
		cell: ({ row }): React.JSX.Element => <span className="text-muted-foreground tabular-nums">{row.original.id}</span>,
		size: 70,
		enableSorting: false,
	},
	{
		accessorKey: "name",
		id: "name",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="User" column={column} />,
		cell: ({ row }): React.JSX.Element => (
			<div className="flex items-center gap-3">
				<Avatar className="size-7">
					<AvatarImage src={row.original.avatar} alt={row.original.name} />
					<AvatarFallback>{getInitials(row.original.name)}</AvatarFallback>
				</Avatar>
				<span className="font-medium text-foreground">{row.original.name}</span>
			</div>
		),
		minSize: 150,
		meta: { autoSize: true },
		enableSorting: true,
	},
	{
		accessorKey: "department",
		id: "department",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Department" column={column} />,
		cell: ({ row }): string => row.original.department,
		size: 150,
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
		cell: ({ row }): React.JSX.Element => <span className="tabular-nums">{USD_FORMAT.format(row.original.balance)}</span>,
		size: 140,
		enableSorting: true,
		enableResizing: true,
	},
];

export function DataGrid27Example(): React.JSX.Element {
	const table = useTable({
		features: dataGridFeatures,
		// The data is the whole list: manualPagination keeps every row unsliced so
		// the virtualizer, not a pager, decides what renders.
		manualPagination: true,
		columns: COLUMNS,
		data: ALL_DATA,
		getRowId,
	});

	return (
		<DataGrid table={table} recordCount={ALL_DATA.length} tableLayout={TABLE_LAYOUT} tableClassNames={TABLE_CLASS_NAMES}>
			<Card className="w-full gap-0 p-0">
				<CardHeader className="flex items-center justify-between gap-3 px-4 py-2">
					<CardTitle className="text-sm font-medium">Virtualized Directory</CardTitle>
					<CardAction>
						<Button variant="outline" size="sm">
							<RefreshCwIcon />
							Refresh
						</Button>
					</CardAction>
				</CardHeader>
				<CardContent className="border-t p-0">
					<DataGridScrollArea className="h-[480px]">
						<DataGridTableVirtual estimateSize={ROW_ESTIMATE_PX} />
					</DataGridScrollArea>
				</CardContent>
			</Card>
		</DataGrid>
	);
}

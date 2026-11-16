"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Badge, type BadgeVariant } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardAction, CardContent, CardHeader } from "@workspace/ui/components/card";
import { DataGrid, dataGridFeatures, type DataGridFeatures, type DataGridTableClassNames, type DataGridTableLayout } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridColumnHeader } from "@workspace/ui/components/data-grid/data-grid-column-header";
import { DataGridScrollArea } from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import { DataGridTableVirtual } from "@workspace/ui/components/data-grid/data-grid-table-virtual";
import { useTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { CloudDownloadIcon, DownloadIcon, RefreshCwIcon } from "lucide-react";
import * as React from "react";

type MemberStatus = "Active" | "Inactive" | "Pending";

interface IData {
	readonly id: string;
	readonly name: string;
	readonly avatar: string;
	readonly email: string;
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

const STATUSES: NonEmptyList<MemberStatus> = ["Active", "Inactive", "Pending"];

/** Records the simulated server holds. */
const TOTAL_SERVER_RECORDS = 200;
/** Records one simulated request returns. */
const PAGE_SIZE = 20;
/** Simulated server latency for one "load more" request — a timer, never the network. */
const FETCH_LATENCY_MS = 800;

/** Generated balances fall in [BALANCE_MIN, BALANCE_MIN + BALANCE_RANGE). */
const BALANCE_MIN = 1000;
const BALANCE_RANGE = 9000;
/** A prime stride spreads consecutive rows across the balance range without randomness, so renders are deterministic. */
const BALANCE_STRIDE = 7919;
const CENTS_PER_DOLLAR = 100;
const CENTS_STRIDE = 37;

/** Row height before measurement, in pixels (two-line user cell). */
const ROW_ESTIMATE_PX = 57;

function cycle<TItem>(items: NonEmptyList<TItem>, index: number): TItem {
	const [first] = items;
	return items.at(index % items.length) ?? first;
}

function simulateRow(index: number): IData {
	const name = cycle(NAMES, index);
	return {
		id: String(index + 1),
		name,
		avatar: cycle(AVATARS, index),
		email: `${name.toLowerCase().replace(" ", ".")}${String(index)}@company.com`,
		status: cycle(STATUSES, index),
		balance: BALANCE_MIN + ((index * BALANCE_STRIDE) % BALANCE_RANGE) + ((index * CENTS_STRIDE) % CENTS_PER_DOLLAR) / CENTS_PER_DOLLAR,
	};
}

function simulatePage(offset: number): IData[] {
	return Array.from({ length: PAGE_SIZE }, (_value: undefined, index: number): IData => simulateRow(offset + index));
}

const INITIAL_DATA: readonly IData[] = simulatePage(0);

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
				<div>
					<div className="font-medium text-foreground">{row.original.name}</div>
					<div className="text-xs text-muted-foreground">{row.original.email}</div>
				</div>
			</div>
		),
		minSize: 200,
		meta: { autoSize: true },
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
	},
];

export function DataGrid28Example(): React.JSX.Element {
	const [sorting, setSorting] = React.useState<SortingState>([]);
	const [data, setData] = React.useState<readonly IData[]>(INITIAL_DATA);
	const [isFetching, setIsFetching] = React.useState(false);
	const [resetVersion, setResetVersion] = React.useState(0);
	const fetchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
	const hasMore = data.length < TOTAL_SERVER_RECORDS;

	const clearPendingFetch = React.useCallback((): void => {
		if (fetchTimeoutRef.current !== null) {
			clearTimeout(fetchTimeoutRef.current);
			fetchTimeoutRef.current = null;
		}
	}, []);

	React.useEffect((): (() => void) => clearPendingFetch, [clearPendingFetch]);

	const handleReset = React.useCallback((): void => {
		clearPendingFetch();
		setSorting([]);
		setData(INITIAL_DATA);
		setIsFetching(false);
		setResetVersion((version: number): number => version + 1);
	}, [clearPendingFetch]);

	const fetchMore = React.useCallback((): void => {
		if (isFetching || !hasMore) {
			return;
		}
		clearPendingFetch();
		setIsFetching(true);
		fetchTimeoutRef.current = setTimeout((): void => {
			setData((previous: readonly IData[]): readonly IData[] => [...previous, ...simulatePage(previous.length)]);
			setIsFetching(false);
			fetchTimeoutRef.current = null;
		}, FETCH_LATENCY_MS);
	}, [clearPendingFetch, hasMore, isFetching]);

	const table = useTable({
		features: dataGridFeatures,
		// The loaded rows are the whole list: manualPagination keeps them unsliced
		// so the virtualizer, not a pager, decides what renders.
		manualPagination: true,
		columns: COLUMNS,
		data,
		getRowId,
		state: { sorting },
		onSortingChange: setSorting,
	});

	return (
		<DataGrid table={table} recordCount={data.length} tableLayout={TABLE_LAYOUT} tableClassNames={TABLE_CLASS_NAMES}>
			<Card className="w-full gap-0 p-0">
				<CardHeader className="flex items-center justify-between gap-3 px-4 py-2">
					<div className="flex items-center gap-2">
						<CloudDownloadIcon className="size-4 text-muted-foreground" />
						<span className="text-sm font-medium text-foreground">Remote Data</span>
						<Badge variant="secondary" size="sm">
							{data.length} / {TOTAL_SERVER_RECORDS}
						</Badge>
					</div>
					<CardAction className="flex items-center gap-2">
						<Button variant="outline" size="sm" onClick={handleReset}>
							<RefreshCwIcon className="size-4" />
							Start over
						</Button>
						<Button variant="ghost" size="icon" className="size-8" aria-label="Download snapshot" title="Download snapshot">
							<DownloadIcon className="size-4" />
						</Button>
					</CardAction>
				</CardHeader>
				<CardContent className="border-t p-0">
					<DataGridScrollArea key={resetVersion} className="h-[480px]">
						<DataGridTableVirtual estimateSize={ROW_ESTIMATE_PX} onFetchMore={fetchMore} isFetchingMore={isFetching} hasMore={hasMore} />
					</DataGridScrollArea>
				</CardContent>
			</Card>
		</DataGrid>
	);
}

"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Badge, type BadgeVariant } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { DataGrid, dataGridFeatures, type DataGridFeatures, type DataGridTableLayout } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridColumnHeader } from "@workspace/ui/components/data-grid/data-grid-column-header";
import { DataGridPagination } from "@workspace/ui/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import { DataGridTable } from "@workspace/ui/components/data-grid/data-grid-table";
import { Input } from "@workspace/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, type SelectOption } from "@workspace/ui/components/select";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useTable, type ColumnDef, type PaginationState, type SortingState } from "@tanstack/react-table";
import { XIcon } from "lucide-react";
import * as React from "react";

type UserStatus = "Active" | "Inactive" | "Pending";

interface IData {
	readonly id: string;
	readonly name: string;
	readonly avatar: string;
	readonly email: string;
	readonly company: string;
	readonly status: UserStatus;
	readonly balance: number;
}

type StatusFilter = "all" | UserStatus;

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

const COMPANIES: NonEmptyList<string> = ["Apple", "OpenAI", "Meta", "Tesla", "SAP", "Keenthemes", "BBVA", "Sony", "LVMH", "ENI"];

const STATUSES: NonEmptyList<UserStatus> = ["Active", "Inactive", "Pending"];

// Deterministic, so sorting and paging are reproducible across fetches. A
// non-round total makes the "1 - 5 of 487" info text read like a real API.
const TOTAL_SERVER_RECORDS = 487;
/** Rows per page. */
const PAGE_SIZE = 5;
/** Simulated server latency — a timer, never the network — so the skeleton state is visible. */
const SERVER_LATENCY_MS = 500;
/** Typing settles into one query after this pause. */
const SEARCH_DEBOUNCE_MS = 350;
/** Spreads companies so neighbouring rows do not share one. */
const COMPANY_STRIDE = 3;
/** Generated balances: BALANCE_MIN plus a deterministic offset below BALANCE_RANGE, rounded to cents. */
const BALANCE_MIN = 1000;
const BALANCE_RANGE = 9000;
const BALANCE_STRIDE = 137.17;
const CENTS_PER_DOLLAR = 100;

function cycle<TItem>(items: NonEmptyList<TItem>, index: number): TItem {
	const [first] = items;
	return items.at(index % items.length) ?? first;
}

const SERVER_RECORDS: readonly IData[] = Array.from({ length: TOTAL_SERVER_RECORDS }, (_value: undefined, index: number): IData => {
	const name = cycle(NAMES, index);
	return {
		id: String(index + 1),
		name,
		avatar: cycle(AVATARS, index),
		email: `${name.toLowerCase().replace(" ", ".")}${String(index + 1)}@company.com`,
		company: cycle(COMPANIES, index * COMPANY_STRIDE),
		status: cycle(STATUSES, index),
		balance: Math.round((BALANCE_MIN + ((index * BALANCE_STRIDE) % BALANCE_RANGE)) * CENTS_PER_DOLLAR) / CENTS_PER_DOLLAR,
	};
});

type RecordComparator = (left: IData, right: IData) => number;

/** The sortable columns and how the server orders each one (ascending). */
const SERVER_COMPARATORS: ReadonlyMap<string, RecordComparator> = new Map<string, RecordComparator>([
	["name", (left: IData, right: IData): number => left.name.localeCompare(right.name)],
	["company", (left: IData, right: IData): number => left.company.localeCompare(right.company)],
	["status", (left: IData, right: IData): number => left.status.localeCompare(right.status)],
	["balance", (left: IData, right: IData): number => left.balance - right.balance],
]);

interface ServerQuery {
	readonly pageIndex: number;
	readonly pageSize: number;
	readonly sorting: SortingState;
	readonly search: string;
	readonly status: StatusFilter;
}

interface ServerPage {
	/** The query this page answers, so a render can tell a settled page from a pending one. */
	readonly key: string;
	readonly rows: readonly IData[];
	/** Matching records AFTER filtering. */
	readonly total: number;
}

/**
 * The simulated server: what a real backend does with the query string of a
 * paged endpoint — filter, sort, count, slice. Replace it with a call to your
 * own API and keep the return shape: one page of rows plus the filtered total.
 */
function queryServer(query: ServerQuery): Omit<ServerPage, "key"> {
	const search = query.search.toLowerCase();
	const matching = SERVER_RECORDS.filter(
		(record: IData): boolean =>
			(query.status === "all" || record.status === query.status) &&
			(search === "" || [record.name, record.email, record.company].some((value: string): boolean => value.toLowerCase().includes(search))),
	);
	const [sort] = query.sorting;
	const comparator = sort === undefined ? undefined : SERVER_COMPARATORS.get(sort.id);
	const ordered =
		sort === undefined || comparator === undefined
			? matching
			: [...matching].sort((left: IData, right: IData): number => (sort.desc ? -comparator(left, right) : comparator(left, right)));
	const start = query.pageIndex * query.pageSize;
	return { rows: ordered.slice(start, start + query.pageSize), total: ordered.length };
}

const STATUS_FILTER_OPTIONS: readonly SelectOption<StatusFilter>[] = [
	{ value: "all", label: "All statuses" },
	{ value: "Active", label: "Active" },
	{ value: "Inactive", label: "Inactive" },
	{ value: "Pending", label: "Pending" },
];

const STATUS_BADGE_VARIANTS: Readonly<Record<UserStatus, BadgeVariant>> = {
	Active: "success-outline",
	Inactive: "info-outline",
	Pending: "warning-outline",
};

const USD_FORMAT = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const NO_ROWS: readonly IData[] = [];

const INITIAL_PAGINATION: PaginationState = { pageIndex: 0, pageSize: PAGE_SIZE };

const TABLE_LAYOUT: DataGridTableLayout = { columnsResizable: true };

function getInitials(name: string): string {
	return name
		.split(" ")
		.map((part: string): string => part.charAt(0))
		.join("");
}

function getRowId(row: IData): string {
	return row.id;
}

function toFirstPage(current: PaginationState): PaginationState {
	return current.pageIndex === 0 ? current : { ...current, pageIndex: 0 };
}

function renderStatusFilterItem(option: SelectOption<StatusFilter>): React.JSX.Element {
	return (
		<SelectItem key={option.value} value={option.value}>
			{option.label}
		</SelectItem>
	);
}

const COLUMNS: ColumnDef<DataGridFeatures, IData>[] = [
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
		minSize: 220,
		meta: {
			autoSize: true,
			skeleton: (
				<div className="flex items-center gap-3">
					<Skeleton className="size-7 rounded-full" />
					<div className="space-y-1.5">
						<Skeleton className="h-3.5 w-24" />
						<Skeleton className="h-3 w-36" />
					</div>
				</div>
			),
		},
		enableSorting: true,
	},
	{
		accessorKey: "company",
		id: "company",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Company" column={column} />,
		cell: ({ row }): React.JSX.Element => <span className="text-foreground">{row.original.company}</span>,
		size: 130,
		meta: { skeleton: <Skeleton className="h-4 w-20" /> },
		enableSorting: true,
	},
	{
		accessorKey: "status",
		id: "status",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Status" column={column} />,
		cell: ({ row }): React.JSX.Element => <Badge variant={STATUS_BADGE_VARIANTS[row.original.status]}>{row.original.status}</Badge>,
		size: 120,
		meta: { skeleton: <Skeleton className="h-5 w-16" /> },
		enableSorting: true,
	},
	{
		accessorKey: "balance",
		id: "balance",
		header: ({ column }): React.JSX.Element => <DataGridColumnHeader title="Balance" column={column} />,
		cell: ({ row }): React.JSX.Element => <span className="tabular-nums">{USD_FORMAT.format(row.original.balance)}</span>,
		size: 140,
		meta: { skeleton: <Skeleton className="h-4 w-24" /> },
		enableSorting: true,
	},
];

export function DataGrid34Example(): React.JSX.Element {
	const [pagination, setPagination] = React.useState<PaginationState>(INITIAL_PAGINATION);
	const [sorting, setSorting] = React.useState<SortingState>([]);
	const [searchInput, setSearchInput] = React.useState("");
	const [search, setSearch] = React.useState("");
	const [status, setStatus] = React.useState<StatusFilter>("all");
	const [page, setPage] = React.useState<ServerPage | null>(null);

	const hasActiveFilters = searchInput.trim() !== "" || status !== "all";

	const query = React.useMemo(
		(): ServerQuery => ({ pageIndex: pagination.pageIndex, pageSize: pagination.pageSize, sorting, search, status }),
		[pagination.pageIndex, pagination.pageSize, sorting, search, status],
	);
	const queryKey = JSON.stringify(query);
	// Loading until the page for THIS query lands; the previous rows stay mounted underneath the skeleton.
	const isLoading = page?.key !== queryKey;
	const total = page?.total ?? 0;

	// Debounce typing into one server query, and return to the first page: the
	// old page index is meaningless against a different filtered set.
	React.useEffect((): (() => void) => {
		const timeoutId = setTimeout((): void => {
			setSearch(searchInput.trim());
			setPagination(toFirstPage);
		}, SEARCH_DEBOUNCE_MS);
		return (): void => {
			clearTimeout(timeoutId);
		};
	}, [searchInput]);

	// One request per settled query. A newer query cancels the pending one, so a
	// slow response can never land after a newer one and overwrite fresher rows.
	React.useEffect((): (() => void) => {
		const timeoutId = setTimeout((): void => {
			setPage({ key: queryKey, ...queryServer(query) });
		}, SERVER_LATENCY_MS);
		return (): void => {
			clearTimeout(timeoutId);
		};
	}, [query, queryKey]);

	const table = useTable({
		features: dataGridFeatures,
		columns: COLUMNS,
		data: page?.rows ?? NO_ROWS,
		// Server-side mode: `data` is exactly one page, so paging and sorting are
		// the server's job instead of the row models'.
		manualPagination: true,
		manualSorting: true,
		// The server-side total. REQUIRED alongside recordCount below: without it
		// getPageCount() is derived from the one loaded page and the pagination
		// buttons collapse to a single page. recordCount only drives the info text.
		rowCount: total,
		getRowId,
		state: { pagination, sorting },
		onPaginationChange: setPagination,
		onSortingChange: setSorting,
	});

	const handleSearchChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setSearchInput(event.target.value);
	}, []);

	// The primitive types the callback value as nullable; null (nothing selected) means the unfiltered view.
	const handleStatusChange = React.useCallback((next: StatusFilter | null): void => {
		setStatus(next ?? "all");
		setPagination(toFirstPage);
	}, []);

	// Search is cleared through both halves at once: waiting out the debounce would leave stale rows behind.
	const handleClearFilters = React.useCallback((): void => {
		setSearchInput("");
		setSearch("");
		setStatus("all");
		setPagination(toFirstPage);
	}, []);

	return (
		<DataGrid table={table} recordCount={total} isLoading={isLoading} tableLayout={TABLE_LAYOUT}>
			<Card className="w-full gap-3 py-3.5">
				<CardHeader className="items-center px-3.5">
					<CardTitle className="flex items-center gap-2">
						Users
						<Badge variant="secondary" size="sm" className="tabular-nums">
							{total}
						</Badge>
					</CardTitle>
					<CardAction className="flex flex-wrap items-center justify-end gap-2">
						<Input value={searchInput} onChange={handleSearchChange} aria-label="Search users" placeholder="Search name, email, company..." className="w-56" />
						<Select items={STATUS_FILTER_OPTIONS} value={status} onValueChange={handleStatusChange}>
							<SelectTrigger className="w-32" aria-label="Filter by status">
								<SelectValue placeholder="Status" />
							</SelectTrigger>
							<SelectContent>{STATUS_FILTER_OPTIONS.map(renderStatusFilterItem)}</SelectContent>
						</Select>
						{/* Present only while a filter is active, so the resting toolbar stays quiet. */}
						{hasActiveFilters ? (
							<Button variant="ghost" size="sm" onClick={handleClearFilters}>
								<XIcon className="size-4" />
								Clear
							</Button>
						) : null}
					</CardAction>
				</CardHeader>
				<CardContent className="border-t p-0">
					<DataGridScrollArea>
						<DataGridTable />
					</DataGridScrollArea>
				</CardContent>
				<CardFooter className="border-none bg-transparent! px-3.5 py-0">
					<DataGridPagination />
				</CardFooter>
			</Card>
		</DataGrid>
	);
}

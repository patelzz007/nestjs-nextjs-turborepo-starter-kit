"use client";

// ============================================
// app/(panel)/telescope/sql/page.tsx
// SQL query log — every captured Prisma query, slowest-first by default.
// Clicking a row drills into the originating request via its correlation id
// (the requests page accepts `?correlation=`).
// ============================================

import { useAuth } from "@workspace/client/lib/auth";
import { telescopeEndpoints } from "@workspace/client/lib/api/endpoints";
import { DataTable, type DataTableFeatures } from "@workspace/ui/components/display/data-table";
import { Input } from "@workspace/ui/components/form/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/form/select";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { TelescopeSqlListQuerySchema, type QueryLogEntry, type TelescopeSqlListQuery } from "@workspace/shared";

import { durationLabel, formatTime } from "@/lib/telescope";

const PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50, 100];

const SORT_OPTIONS: readonly { readonly value: string; readonly label: string }[] = [
	{ value: "duration", label: "Slowest first" },
	{ value: "newest", label: "Newest first" },
];

export default function TelescopeSqlPage(): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();

	const [model, setModel] = useState<string>("");
	const [minDuration, setMinDuration] = useState<string>("");
	const [sort, setSort] = useState<string>("duration");
	const [page, setPage] = useState<number>(1);
	const [pageSize, setPageSize] = useState<number>(20);

	const query: TelescopeSqlListQuery = useMemo((): TelescopeSqlListQuery => {
		const draft: Record<string, string | number> = { page, pageSize, sort };
		if (model !== "") draft.model = model;
		if (minDuration !== "") draft.minDurationMs = minDuration;
		return TelescopeSqlListQuerySchema.parse(draft);
	}, [page, pageSize, sort, model, minDuration]);

	const listQuery = api.procedure(telescopeEndpoints.sql(query)).useQuery(
		{ query },
		{ placeholderData: (previous) => previous },
	);

	const rows: readonly QueryLogEntry[] = useMemo(() => listQuery.data?.list.items ?? [], [listQuery.data]);
	const totalCount: number = listQuery.data?.list.total ?? 0;

	const handleManualPaginationChange = useCallback((nextPage: number, nextPageSize: number): void => {
		setPage(nextPage);
		setPageSize(nextPageSize);
	}, []);

	const handleRowClick = useCallback(
		(row: QueryLogEntry): void => {
			router.push(`/telescope/requests?correlation=${encodeURIComponent(row.correlationId)}`);
		},
		[router],
	);

	const columns = useMemo<ColumnDef<DataTableFeatures, QueryLogEntry>[]>(
		() => [
			{
				accessorKey: "model",
				header: "Model",
				cell: ({ row }): React.JSX.Element => <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-foreground">{row.original.model}</span>,
			},
			{
				accessorKey: "operation",
				header: "Operation",
				cell: ({ row }): React.JSX.Element => <span className="font-mono text-xs text-muted-foreground">{row.original.operation}</span>,
			},
			{
				accessorKey: "query",
				header: "Query",
				cell: ({ row }): React.JSX.Element => <span className="block max-w-xl truncate font-mono text-xs text-foreground">{row.original.query}</span>,
			},
			{
				accessorKey: "durationMs",
				header: "Duration",
				cell: ({ row }): React.JSX.Element => {
					const slow: boolean = row.original.durationMs >= 500;
					return (
						<span className={`font-mono text-xs tabular-nums ${slow ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
							{durationLabel(row.original.durationMs)}
						</span>
					);
				},
			},
			{
				accessorKey: "createdAt",
				header: (): React.JSX.Element => <div className="w-full text-end">Time</div>,
				cell: ({ row }): React.JSX.Element => <div className="text-end text-xs text-muted-foreground tabular-nums">{formatTime(row.original.createdAt)}</div>,
			},
		],
		[],
	);

	const mobileCardRender = useCallback(
		(item: QueryLogEntry): React.ReactNode => (
			<div className="rounded-lg border bg-card p-3">
				<div className="flex items-center justify-between gap-2">
					<div className="flex min-w-0 items-center gap-2">
						<span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs font-medium">{item.model}</span>
						<span className="truncate font-mono text-xs text-muted-foreground">{item.operation}</span>
					</div>
					<span className="shrink-0 font-mono text-xs tabular-nums">{durationLabel(item.durationMs)}</span>
				</div>
				<p className="mt-1.5 truncate font-mono text-xs text-foreground">{item.query}</p>
				<p className="mt-1 text-[11px] text-muted-foreground tabular-nums">{formatTime(item.createdAt)}</p>
			</div>
		),
		[],
	);

	const filtersKey: string = useMemo(() => JSON.stringify({ model, minDuration, sort }), [model, minDuration, sort]);
	const sortItems = useMemo(() => SORT_OPTIONS, []);

	return (
		<div className="mx-auto w-full max-w-7xl space-y-6">
			<header>
				<h1 className="text-2xl font-semibold tracking-tight text-foreground">SQL</h1>
				<p className="mt-1 max-w-xl text-sm text-muted-foreground">
					Every Prisma query captured alongside its requests. Click a row to open the originating request, filtered to that correlation.
				</p>
			</header>

			<div className="flex flex-wrap items-end gap-3">
				<div className="space-y-1.5">
					<label htmlFor="tel-sql-model" className="text-xs font-medium text-muted-foreground">
						Model
					</label>
					<Input
						id="tel-sql-model"
						placeholder="e.g. EmailLog"
						value={model}
						onChange={(event: React.ChangeEvent<HTMLInputElement>): void => setModel(event.target.value)}
						className="h-9 w-40 text-sm"
					/>
				</div>
				<div className="space-y-1.5">
					<label htmlFor="tel-sql-min" className="text-xs font-medium text-muted-foreground">
						Min duration (ms)
					</label>
					<Input
						id="tel-sql-min"
						type="number"
						min={0}
						placeholder="e.g. 500"
						value={minDuration}
						onChange={(event: React.ChangeEvent<HTMLInputElement>): void => setMinDuration(event.target.value)}
						className="h-9 w-36 text-sm"
					/>
				</div>
				<div className="space-y-1.5">
					<label htmlFor="tel-sql-sort" className="text-xs font-medium text-muted-foreground">
						Sort
					</label>
					<Select value={sort} onValueChange={setSort} items={sortItems}>
						<SelectTrigger id="tel-sql-sort" className="h-9 w-40 text-sm">
							<SelectValue placeholder="Sort" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="duration">Slowest first</SelectItem>
							<SelectItem value="newest">Newest first</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			<DataTable
				key={filtersKey}
				data={[...rows]}
				columns={columns}
				manual
				totalCount={totalCount}
				pageSize={pageSize}
				pageSizeOptions={PAGE_SIZE_OPTIONS}
				onManualPaginationChange={handleManualPaginationChange}
				onRowClick={handleRowClick}
				enableColumnVisibility
				exportable
				exportFilename="telescope-sql"
				isLoading={listQuery.isLoading}
				error={listQuery.error !== null ? "Failed to load SQL queries." : null}
				mobileCardRender={mobileCardRender}
			/>
		</div>
	);
}

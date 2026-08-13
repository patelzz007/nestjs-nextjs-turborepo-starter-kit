"use client";

// ============================================
// app/(panel)/telescope/requests/page.tsx
// Request log — a manual (server-side) DataTable. The page owns the filter
// state and the page/pageSize round-trip; the DataTable's manual pager
// notifies this page via `onManualPaginationChange`, and the API response
// supplies the current page + totalCount.
//
// Drill-down: `?correlation=<id>` (linked from the SQL page) pre-filters the
// list to one request's correlation. Filter changes remount the table (key)
// so its internal pager resets to page 1.
// ============================================

import { useAuth } from "@workspace/client/lib/auth";
import { telescopeEndpoints } from "@workspace/client/lib/api/endpoints";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, type BulkAction, type DataTableFeatures } from "@workspace/ui/components/display/data-table";
import { Button } from "@workspace/ui/components/form/button";
import { Input } from "@workspace/ui/components/form/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/form/select";
import { GitCompareArrows, RefreshCw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { TelescopeRequestListQuerySchema, type RequestLogSummary, type TelescopeRequestListQuery, type TelescopeStreamEvent } from "@workspace/shared";

import { SavedFilters } from "@/components/telescope/saved-filters";
import { addSavedFilter, loadSavedFilters, removeSavedFilter, type SavedFilter, type SavedFilterValue } from "@/lib/saved-filters";
import { durationLabel, durationTone, formatTime, statusTone } from "@/lib/telescope";
import { useTelescopeLive } from "@/lib/use-telescope-live";

const PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50, 100];

const METHOD_OPTIONS: readonly { readonly value: string; readonly label: string }[] = [
	{ value: "GET", label: "GET" },
	{ value: "POST", label: "POST" },
	{ value: "PUT", label: "PUT" },
	{ value: "PATCH", label: "PATCH" },
	{ value: "DELETE", label: "DELETE" },
];

const STATUS_OPTIONS: readonly { readonly value: string; readonly label: string }[] = [200, 201, 204, 400, 401, 403, 404, 422, 429, 500, 502, 503].map((code) => ({
	value: String(code),
	label: String(code),
}));

const SORT_OPTIONS: readonly { readonly value: string; readonly label: string }[] = [
	{ value: "newest", label: "Newest first" },
	{ value: "duration", label: "Slowest first" },
];

function RequestsContent(): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();
	const searchParams = useSearchParams();
	const correlationParam: string | null = searchParams.get("correlation");

	const [method, setMethod] = useState<string>("all");
	const [status, setStatus] = useState<string>("all");
	const [minDuration, setMinDuration] = useState<string>("");
	const [sort, setSort] = useState<string>("newest");
	const [correlationFilter, setCorrelationFilter] = useState<string | null>(correlationParam);
	const [page, setPage] = useState<number>(1);
	const [pageSize, setPageSize] = useState<number>(20);

	// Feature 9 — saved filters (localStorage-backed bookmarks).
	const [savedFilters, setSavedFilters] = useState<readonly SavedFilter[]>(() => loadSavedFilters());

	// The active query — parsed through the shared schema so defaults and
	// coercion are identical to the server's DTO (rule 6: infer, don't guess).
	const query: TelescopeRequestListQuery = useMemo((): TelescopeRequestListQuery => {
		const draft: Record<string, string | number> = { page, pageSize, sort };
		if (method !== "all") draft.method = method;
		if (status !== "all") draft.status = status;
		if (minDuration !== "") draft.minDurationMs = minDuration;
		if (correlationFilter !== null) draft.correlationId = correlationFilter;
		return TelescopeRequestListQuerySchema.parse(draft);
	}, [page, pageSize, sort, method, status, minDuration, correlationFilter]);

	const listQuery = api.procedure(telescopeEndpoints.requests(query)).useQuery({ query }, { placeholderData: (previous) => previous });

	const rows: readonly RequestLogSummary[] = useMemo(() => listQuery.data?.data.list.items ?? [], [listQuery.data]);
	const totalCount: number = listQuery.data?.data.list.total ?? 0;

	// Improvement v2 — live "N new" pill: count request frames pushed over the
	// SSE stream since the last acknowledged refresh, without auto-refetching
	// (the table is manual-paginated; the dev clicks the pill when ready).
	const [newRequestCount, setNewRequestCount] = useState<number>(0);
	const live = useTelescopeLive(
		useCallback((event: TelescopeStreamEvent): void => {
			if (event.type === "request") {
				setNewRequestCount((count: number): number => count + 1);
			}
		}, []),
	);

	const handleRefreshNew = useCallback((): void => {
		setNewRequestCount(0);
		void listQuery.refetch();
	}, [listQuery]);

	// Any filter change (or correlation clear) makes the view current again —
	// reset the pill in the handlers themselves (an effect would trip the
	// react-hooks/purity rule on synchronous setState).
	const resetNewCount = useCallback((): void => {
		setNewRequestCount(0);
	}, []);

	const handleManualPaginationChange = useCallback((nextPage: number, nextPageSize: number): void => {
		setPage(nextPage);
		setPageSize(nextPageSize);
		setNewRequestCount(0);
	}, []);

	const handleRowClick = useCallback(
		(row: RequestLogSummary): void => {
			router.push(`/telescope/requests/${row.id}`);
		},
		[router],
	);

	// Improvement 6 — Compare: exactly two selected rows open the diff page.
	const bulkActions = useMemo(
		(): BulkAction<RequestLogSummary>[] => [
			{
				key: "compare",
				label: "Compare",
				icon: <GitCompareArrows className="size-3.5" />,
				onClick: (rows: RequestLogSummary[]): void => {
					if (rows.length !== 2) {
						toast.warning("Select exactly two requests to compare.");
						return;
					}
					router.push(`/telescope/compare?a=${encodeURIComponent(rows[0]?.id ?? "")}&b=${encodeURIComponent(rows[1]?.id ?? "")}`);
				},
			},
		],
		[router],
	);

	const clearCorrelation = useCallback((): void => {
		setCorrelationFilter(null);
		resetNewCount();
		router.replace("/telescope/requests");
	}, [router, resetNewCount]);

	// Select's `onValueChange` passes `string | null` — narrow before writing.
	const handleMethodChange = useCallback(
		(value: string | null): void => {
			if (value !== null) setMethod(value);
			resetNewCount();
		},
		[resetNewCount],
	);
	const handleStatusChange = useCallback(
		(value: string | null): void => {
			if (value !== null) setStatus(value);
			resetNewCount();
		},
		[resetNewCount],
	);
	const handleSortChange = useCallback(
		(value: string | null): void => {
			if (value !== null) setSort(value);
			resetNewCount();
		},
		[resetNewCount],
	);
	const handleMinDurationChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			setMinDuration(event.target.value);
			resetNewCount();
		},
		[resetNewCount],
	);

	// Feature 9 — apply a saved filter to the live filter state.
	const handleApplySavedFilter = useCallback(
		(filter: SavedFilterValue): void => {
			setMethod(filter.method);
			setStatus(filter.status);
			setMinDuration(filter.minDuration);
			setSort(filter.sort);
			resetNewCount();
		},
		[resetNewCount],
	);

	const handleSaveFilter = useCallback((name: string, filter: SavedFilterValue): void => {
		setSavedFilters(
			addSavedFilter({
				id: `${Date.now().toString(36)}-${name
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, "-")
					.slice(0, 24)}`,
				name,
				filter,
				createdAt: new Date().toISOString(),
			}),
		);
		toast.success("Filter saved.");
	}, []);

	const handleDeleteFilter = useCallback((id: string): void => {
		setSavedFilters(removeSavedFilter(id));
	}, []);

	// The current filter value (what a bookmark would capture).
	const currentFilter: SavedFilterValue = useMemo((): SavedFilterValue => ({ method, status, minDuration, sort }), [method, status, minDuration, sort]);

	// Column defs — status/duration/time cells are pure presentations.
	const columns = useMemo<ColumnDef<DataTableFeatures, RequestLogSummary>[]>(
		() => [
			{
				accessorKey: "method",
				header: "Method",
				cell: ({ row }): React.JSX.Element => <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-foreground">{row.original.method}</span>,
			},
			{
				accessorKey: "path",
				header: "Path",
				cell: ({ row }): React.JSX.Element => <span className="font-mono text-xs text-foreground">{row.original.path}</span>,
			},
			{
				accessorKey: "statusCode",
				header: "Status",
				cell: ({ row }): React.JSX.Element => {
					const tone = statusTone(row.original.statusCode);
					return (
						<span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-xs tabular-nums ${tone.pillClass}`}>
							<span className={`size-1.5 rounded-full ${tone.dotClass}`} />
							{tone.label}
						</span>
					);
				},
			},
			{
				accessorKey: "durationMs",
				header: "Duration",
				cell: ({ row }): React.JSX.Element => {
					const tone = durationTone(row.original.durationMs);
					return <span className={`font-mono text-xs tabular-nums ${tone.textClass}`}>{durationLabel(row.original.durationMs)}</span>;
				},
			},
			{
				accessorKey: "createdAt",
				header: "Time",
				cell: ({ row }): React.JSX.Element => <span className="text-xs text-muted-foreground tabular-nums">{formatTime(row.original.createdAt)}</span>,
			},
		],
		[],
	);

	const mobileCardRender = useCallback((item: RequestLogSummary): React.ReactNode => {
		const tone = statusTone(item.statusCode);
		return (
			<div className="rounded-lg border bg-card p-3">
				<div className="flex items-center justify-between gap-2">
					<div className="flex min-w-0 items-center gap-2">
						<span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs font-medium">{item.method}</span>
						<span className="truncate font-mono text-xs">{item.path}</span>
					</div>
					<span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-xs ${tone.pillClass}`}>
						<span className={`size-1.5 rounded-full ${tone.dotClass}`} />
						{tone.label}
					</span>
				</div>
				<div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
					<span className={`tabular-nums ${durationTone(item.durationMs).textClass}`}>{durationLabel(item.durationMs)}</span>
					<span className="tabular-nums">{formatTime(item.createdAt)}</span>
				</div>
			</div>
		);
	}, []);

	// Filter bar — dumb controls; changing any filter remounts the table (key)
	// so its internal pager resets to page 1 instead of fetching a stale page.
	const filtersKey: string = useMemo(
		() => JSON.stringify({ method, status, minDuration, sort, correlationFilter, page, pageSize }),
		[method, status, minDuration, sort, correlationFilter, page, pageSize],
	);

	const selectItems = useMemo(() => [{ value: "all", label: "All methods" }, ...METHOD_OPTIONS], []);
	const statusItems = useMemo(() => [{ value: "all", label: "Any status" }, ...STATUS_OPTIONS], []);
	const sortItems = useMemo(() => [{ value: "newest", label: "Newest first" }, ...SORT_OPTIONS], []);

	return (
		<div className="mx-auto w-full max-w-7xl space-y-6">
			<header>
				<h1 className="text-2xl font-semibold tracking-tight text-foreground">Requests</h1>
				<p className="mt-1 max-w-xl text-sm text-muted-foreground">
					Every captured HTTP request with its status, duration and timeline. Click a row for the full breakdown — spans, SQL and bodies.
				</p>
			</header>

			{correlationFilter !== null ? (
				<div className="flex items-center gap-2 rounded-lg border border-sky-300/60 bg-sky-500/10 px-3 py-2 text-xs text-sky-700 dark:border-sky-500/40 dark:text-sky-400">
					<span className="font-medium">Filtered to correlation</span>
					<code className="rounded bg-muted px-1.5 py-0.5 font-mono">{correlationFilter}</code>
					<Button variant="ghost" size="sm" onClick={clearCorrelation} className="ml-auto h-6 px-2 text-xs">
						Clear
					</Button>
				</div>
			) : null}

			{newRequestCount > 0 ? (
				<div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
					<span className="size-1.5 animate-pulse rounded-full bg-primary" />
					<span className="font-medium">
						{String(newRequestCount)} new request{newRequestCount === 1 ? "" : "s"} arrived {live.paused ? "(stream paused)" : null}
					</span>
					<Button variant="outline" size="sm" onClick={handleRefreshNew} className="ml-auto h-6 gap-1 px-2 text-xs">
						<RefreshCw className="size-3" />
						Refresh
					</Button>
				</div>
			) : null}

			{/* Feature 9 — saved filter bookmarks. */}
			<SavedFilters saved={savedFilters} current={currentFilter} onApply={handleApplySavedFilter} onSave={handleSaveFilter} onDelete={handleDeleteFilter} />

			<div className="flex flex-wrap items-end gap-3">
				<div className="flex flex-col gap-1.5">
					<label htmlFor="tel-method" className="text-xs font-medium text-muted-foreground">
						Method
					</label>
					<Select value={method} onValueChange={handleMethodChange} items={selectItems}>
						<SelectTrigger id="tel-method" className="h-9 w-36 text-sm">
							<SelectValue placeholder="Method" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All methods</SelectItem>
							{METHOD_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="flex flex-col gap-1.5">
					<label htmlFor="tel-status" className="text-xs font-medium text-muted-foreground">
						Status
					</label>
					<Select value={status} onValueChange={handleStatusChange} items={statusItems}>
						<SelectTrigger id="tel-status" className="h-9 w-32 text-sm">
							<SelectValue placeholder="Status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">Any status</SelectItem>
							{STATUS_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="flex flex-col gap-1.5">
					<label htmlFor="tel-min" className="text-xs font-medium text-muted-foreground">
						Min duration (ms)
					</label>
					<Input id="tel-min" type="number" min={0} placeholder="e.g. 500" value={minDuration} onChange={handleMinDurationChange} className="h-9 w-36 text-sm" />
				</div>

				<div className="flex flex-col gap-1.5">
					<label htmlFor="tel-sort" className="text-xs font-medium text-muted-foreground">
						Sort
					</label>
					<Select value={sort} onValueChange={handleSortChange} items={sortItems}>
						<SelectTrigger id="tel-sort" className="h-9 w-40 text-sm">
							<SelectValue placeholder="Sort" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="newest">Newest first</SelectItem>
							<SelectItem value="duration">Slowest first</SelectItem>
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
				enableBulkSelection
				bulkActions={bulkActions}
				enableColumnVisibility
				exportable
				exportFilename="telescope-requests"
				isLoading={listQuery.isLoading}
				error={listQuery.error !== null ? "Failed to load requests." : null}
				mobileCardRender={mobileCardRender}
			/>
		</div>
	);
}

/** `useSearchParams` must render under a Suspense boundary during prerender. */
export default function TelescopeRequestsPage(): React.JSX.Element {
	return (
		<Suspense fallback={null}>
			<RequestsContent />
		</Suspense>
	);
}

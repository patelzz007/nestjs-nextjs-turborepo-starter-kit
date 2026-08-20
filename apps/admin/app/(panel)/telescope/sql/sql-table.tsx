"use client";

// ============================================
// app/(panel)/telescope/sql/page.tsx
// SQL query log — every captured Prisma query, slowest-first by default.
// Clicking a row drills into the originating request via its correlation id
// (the requests page accepts `?correlation=`).
// ============================================

import { useAuth } from "@workspace/client/lib/auth";

import type { ColumnDef } from "@tanstack/react-table";
import { ADMIN_DATA_TABLE_LABELS } from "@/lib/data-table-labels";
import { DataTable, type DataTableFeatures } from "@workspace/ui/components/display/data-table";
import { Button } from "@workspace/ui/components/form/button";
import { Input } from "@workspace/ui/components/form/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/form/select";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { Copy, ExternalLink, RefreshCw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import {
	TelescopeSqlListQuerySchema,
	type QueryLogEntry,
	type TelescopeSqlListQuery,
	type TelescopeStreamEvent,
	type TelescopeSqlListResponse,
	type Envelope,
} from "@workspace/shared";

import { durationLabel, formatTime } from "@/lib/telescope";
import { useTelescopeLive } from "@/lib/use-telescope-live";

const PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50, 100];

const SORT_OPTIONS: readonly { readonly value: string; readonly label: string }[] = [
	{ value: "duration", label: "Slowest first" },
	{ value: "newest", label: "Newest first" },
];

/** Improvement v2 — one-click duration thresholds for the SQL log. */
const DURATION_PRESETS: readonly { readonly label: string; readonly value: string }[] = [
	{ label: "All", value: "" },
	{ label: "≥100ms", value: "100" },
	{ label: "≥500ms", value: "500" },
	{ label: "≥1s", value: "1000" },
	{ label: "≥2s", value: "2000" },
];

interface DurationPresetButtonProps {
	readonly preset: { readonly label: string; readonly value: string };
	readonly active: boolean;
	readonly onSelect: (value: string) => void;
}

/** One preset chip — the per-option closure lives here (rule 16). */
function DurationPresetButton({ preset, active, onSelect }: DurationPresetButtonProps): React.JSX.Element {
	const handleClick = useCallback((): void => {
		onSelect(preset.value);
	}, [onSelect, preset.value]);

	return (
		<button
			type="button"
			onClick={handleClick}
			className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
				active ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
			}`}>
			{preset.label}
		</button>
	);
}

export default function TelescopeSqlPage({ initialEnvelope }: { readonly initialEnvelope: Envelope<{ readonly list: TelescopeSqlListResponse }> }): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();

	const [model, setModel] = useState<string>("");
	const [minDuration, setMinDuration] = useState<string>("100");
	const [sort, setSort] = useState<string>("duration");
	const [page, setPage] = useState<number>(1);
	const [pageSize, setPageSize] = useState<number>(20);

	const query: TelescopeSqlListQuery = useMemo((): TelescopeSqlListQuery => {
		const draft: Record<string, string | number> = { page, pageSize, sort };
		if (model !== "") draft.model = model;
		if (minDuration !== "") draft.minDurationMs = minDuration;
		return TelescopeSqlListQuerySchema.parse(draft);
	}, [page, pageSize, sort, model, minDuration]);

	const isDefaultQuery: boolean = page === 1 && sort === "duration" && minDuration === "100" && model === "";
	const listQuery = api.telescope.sql.useQuery(query, { placeholderData: (previous) => previous, initialData: isDefaultQuery ? initialEnvelope : undefined });

	const rows: readonly QueryLogEntry[] = useMemo(() => listQuery.data?.data.list.items ?? [], [listQuery.data]);
	const totalCount: number = listQuery.data?.data.list.total ?? 0;

	// Feature 16 — SQL detail drawer: clicking a row opens the full query text
	// + bind params + one-click copy, instead of jumping straight away.
	const [selected, setSelected] = useState<QueryLogEntry | null>(null);

	// Feature 18 — live "N new" pill: the stream only reports REQUEST frames
	// (queries ride along inside requests), so every request push bumps the
	// counter; the dev clicks Refresh when ready (no auto-refetch churn).
	const [newQueryCount, setNewQueryCount] = useState<number>(0);
	const live = useTelescopeLive(
		useCallback((event: TelescopeStreamEvent): void => {
			if (event.type === "request") {
				setNewQueryCount((count: number): number => count + 1);
			}
		}, []),
	);
	const handleRefreshNew = useCallback((): void => {
		setNewQueryCount(0);
		void listQuery.refetch();
	}, [listQuery]);

	const handleManualPaginationChange = useCallback((nextPage: number, nextPageSize: number): void => {
		setPage(nextPage);
		setPageSize(nextPageSize);
	}, []);

	// Feature 16 — row click opens the detail drawer; the drawer's "view
	// request" link still routes to the originating correlation.
	const handleRowClick = useCallback((row: QueryLogEntry): void => {
		setSelected(row);
	}, []);

	const handleCloseDrawer = useCallback((): void => {
		setSelected(null);
	}, []);

	const handleViewRequest = useCallback(
		(row: QueryLogEntry): void => {
			router.push(`/telescope/requests?correlation=${encodeURIComponent(row.correlationId)}`);
		},
		[router],
	);

	const handleCopySql = useCallback((sql: string): void => {
		void navigator.clipboard.writeText(sql).then((): void => {
			toastMessage.success({ title: "SQL copied." });
		});
	}, []);

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
				header: "Time",
				cell: ({ row }): React.JSX.Element => <span className="text-xs text-muted-foreground tabular-nums">{formatTime(row.original.createdAt)}</span>,
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

	// Select's `onValueChange` passes `string | null` — narrow before writing.
	const handleSortChange = useCallback((value: string | null): void => {
		if (value !== null) setSort(value);
	}, []);
	const handleModelChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setModel(event.target.value);
	}, []);
	const handleMinDurationChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setMinDuration(event.target.value);
	}, []);
	const handlePresetClick = useCallback((presetValue: string): void => {
		setMinDuration(presetValue);
	}, []);

	const filtersKey: string = useMemo(() => JSON.stringify({ model, minDuration, sort }), [model, minDuration, sort]);
	const sortItems = useMemo(() => SORT_OPTIONS, []);

	return (
		<div className="mx-auto w-full max-w-7xl space-y-6">
			<header>
				<h1 className="text-2xl font-semibold tracking-tight text-foreground">SQL</h1>
				<p className="mt-1 max-w-xl text-sm text-muted-foreground">
					Every Prisma query captured alongside its requests, filtered to ≥100ms by default so slow queries surface. Click a row for the full query + params.
				</p>
			</header>

			{newQueryCount > 0 ? (
				<div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
					<span className="size-1.5 animate-pulse rounded-full bg-primary" />
					<span className="font-medium">
						{String(newQueryCount)} new request{newQueryCount === 1 ? "" : "s"} arrived {live.paused ? "(stream paused)" : null}
					</span>
					<Button variant="outline" size="sm" onClick={handleRefreshNew} className="ml-auto h-6 gap-1 px-2 text-xs">
						<RefreshCw className="size-3" />
						Refresh
					</Button>
				</div>
			) : null}

			<div className="flex flex-wrap items-end gap-3">
				<div className="flex flex-col gap-1.5">
					<label htmlFor="tel-sql-model" className="text-xs font-medium text-muted-foreground">
						Model
					</label>
					<Input id="tel-sql-model" placeholder="e.g. EmailLog" value={model} onChange={handleModelChange} className="h-9 w-40 text-sm" />
				</div>
				<div className="flex flex-col gap-1.5">
					<label htmlFor="tel-sql-min" className="text-xs font-medium text-muted-foreground">
						Min duration (ms)
					</label>
					<div className="flex items-center gap-1.5">
						<Input id="tel-sql-min" type="number" min={0} placeholder="e.g. 500" value={minDuration} onChange={handleMinDurationChange} className="h-9 w-32 text-sm" />
						{/* Quick presets (improvement v2) — one click, no typing. */}
						<div className="inline-flex items-center gap-0.5 rounded-lg border border-input bg-background p-0.5">
							{DURATION_PRESETS.map((preset) => (
								<DurationPresetButton key={preset.label} preset={preset} active={minDuration === preset.value} onSelect={handlePresetClick} />
							))}
						</div>
					</div>
				</div>
				<div className="flex flex-col gap-1.5">
					<label htmlFor="tel-sql-sort" className="text-xs font-medium text-muted-foreground">
						Sort
					</label>
					<Select value={sort} onValueChange={handleSortChange} items={sortItems}>
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
				labels={ADMIN_DATA_TABLE_LABELS}
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

			{/* Feature 16 — SQL detail drawer. */}
			{selected !== null ? <SqlDetailDrawer row={selected} onClose={handleCloseDrawer} onViewRequest={handleViewRequest} onCopy={handleCopySql} /> : null}
		</div>
	);
}

/** The SQL detail drawer — full query, bind params, one-click copy. */
function SqlDetailDrawer({
	row,
	onClose,
	onViewRequest,
	onCopy,
}: {
	readonly row: QueryLogEntry;
	readonly onClose: () => void;
	readonly onViewRequest: (row: QueryLogEntry) => void;
	readonly onCopy: (sql: string) => void;
}): React.JSX.Element {
	const handleView = useCallback((): void => {
		onViewRequest(row);
	}, [onViewRequest, row]);
	const handleCopy = useCallback((): void => {
		onCopy(row.query);
	}, [onCopy, row.query]);

	return (
		<div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="SQL detail">
			<button type="button" aria-label="Close" className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
			<div className="relative flex h-full w-full max-w-xl flex-col border-l bg-card shadow-xl">
				<div className="flex items-center justify-between gap-2 border-b px-4 py-3">
					<div>
						<h2 className="text-sm font-semibold">SQL detail</h2>
						<p className="text-xs text-muted-foreground">
							{row.model}.{row.operation} · {durationLabel(row.durationMs)} · {formatTime(row.createdAt)}
						</p>
					</div>
					<div className="flex items-center gap-1">
						<Button variant="outline" size="sm" onClick={handleView}>
							<ExternalLink className="size-3.5" />
							View request
						</Button>
						<Button variant="outline" size="sm" onClick={handleCopy}>
							<Copy className="size-3.5" />
							Copy
						</Button>
						<Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
							<X className="size-4" />
						</Button>
					</div>
				</div>
				<div className="flex-1 space-y-4 overflow-y-auto p-4">
					<div>
						<h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Query</h3>
						<pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs break-words whitespace-pre-wrap">{row.query}</pre>
					</div>
					<div>
						<h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Bind parameters</h3>
						{row.params === null ? (
							<p className="text-xs text-muted-foreground">None captured.</p>
						) : (
							<pre className="max-h-40 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs break-words whitespace-pre-wrap">{row.params}</pre>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}

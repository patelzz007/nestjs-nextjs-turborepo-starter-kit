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
import { Download, GitCompareArrows, RefreshCw, Search as SearchIcon, Star } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { TelescopeRequestListQuerySchema, type RequestLogSummary, type TelescopeRequestListQuery, type TelescopeStreamEvent } from "@workspace/shared";

import { SavedFilters } from "@/components/telescope/saved-filters";
import { addSavedFilter, loadSavedFilters, removeSavedFilter, type SavedFilter, type SavedFilterValue } from "@/lib/saved-filters";
import { durationLabel, durationTone, formatTime, statusTone } from "@/lib/telescope";
import { useTelescopeLive } from "@/lib/use-telescope-live";

const PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50, 100];

/** Improvement 10 — per-user table preferences persisted across sessions. */
const TABLE_PREFS_KEY = "telescope.requests.prefs";

interface TablePrefs {
	readonly pageSize: number;
	readonly sort: string;
}

function loadTablePrefs(): TablePrefs {
	if (typeof window === "undefined") {
		return { pageSize: 20, sort: "newest" };
	}
	try {
		const raw: string | null = window.localStorage.getItem(TABLE_PREFS_KEY);
		if (raw === null) {
			return { pageSize: 20, sort: "newest" };
		}
		// Zod-parse the persisted blob so a corrupt/foreign value falls back
		// to defaults instead of throwing (no type assertions — repo rule).
		const parsed = z
			.object({
				pageSize: z.number().int().positive().optional(),
				sort: z.string().optional(),
			})
			.safeParse(JSON.parse(raw));
		if (!parsed.success) {
			return { pageSize: 20, sort: "newest" };
		}
		const pageSize: number = parsed.data.pageSize !== undefined && PAGE_SIZE_OPTIONS.includes(parsed.data.pageSize) ? parsed.data.pageSize : 20;
		const sort: string = parsed.data.sort !== undefined && SORT_OPTIONS.some((option) => option.value === parsed.data.sort) ? parsed.data.sort : "newest";
		return { pageSize, sort };
	} catch {
		return { pageSize: 20, sort: "newest" };
	}
}

function saveTablePrefs(prefs: TablePrefs): void {
	try {
		window.localStorage.setItem(TABLE_PREFS_KEY, JSON.stringify(prefs));
	} catch {
		// localStorage unavailable (private mode) — prefs simply don't persist.
	}
}

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

const ENV_OPTIONS: readonly { readonly value: string; readonly label: string }[] = [
	{ value: "development", label: "Dev" },
	{ value: "production", label: "Prod" },
];

/**
 * Feature 14 (end-to-end) — inline star toggle for one request row. Owns its
 * own mutation (rule: no hooks inside a column `cell` render), so starring is
 * possible straight from the list without opening the detail page.
 */
function RowStarToggle({ request, onChanged }: { readonly request: RequestLogSummary; readonly onChanged: () => void }): React.JSX.Element {
	const { api } = useAuth();
	const starMutation = api.procedure(telescopeEndpoints.setAnnotation(request.id)).useMutation();

	const handleToggle = useCallback(
		(event: React.MouseEvent): void => {
			event.stopPropagation();
			const next = !request.starred;
			starMutation.mutate(
				{ starred: next },
				{
					onSuccess: (): void => {
						onChanged();
						toast.success(next ? "Request starred." : "Star removed.");
					},
					onError: (): void => {
						toast.error("Failed to update the star.");
					},
				},
			);
		},
		[request.starred, starMutation, onChanged],
	);

	return (
		<button
			type="button"
			onClick={handleToggle}
			className="inline-flex size-7 items-center justify-center rounded-md transition-colors hover:bg-muted"
			title={request.starred ? "Unstar this request" : "Star this request"}
			aria-label={request.starred ? "Unstar" : "Star"}
			disabled={starMutation.isPending}>
			<Star className={`size-4 ${request.starred ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`} fill={request.starred ? "currentColor" : "none"} />
		</button>
	);
}

/** Feature 5 — download the selected rows as a timestamped JSON file. */
function downloadJsonRows(rows: readonly RequestLogSummary[]): void {
	const blob: Blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json;charset=utf-8" });
	const url: string = URL.createObjectURL(blob);
	const link: HTMLAnchorElement = document.createElement("a");
	link.href = url;
	link.download = `telescope-requests-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.json`;
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
}

function RequestsContent(): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();
	const searchParams = useSearchParams();
	const correlationParam: string | null = searchParams.get("correlation");

	// Improvement 11 — filters live in the URL (?method=&status=&min=&sort=&correlation=)
	// so a filtered view is shareable and survives a refresh. Initial state is seeded
	// from the query string; handlers rewrite the URL imperatively (an effect would
	// trip the react-hooks/purity rule on synchronous setState).
	const [method, setMethod] = useState<string>(() => searchParams.get("method") ?? "all");
	const [status, setStatus] = useState<string>(() => searchParams.get("status") ?? "all");
	const [minDuration, setMinDuration] = useState<string>(() => searchParams.get("min") ?? "");
	// Feature 2 — free-text search over path / query-string / body text.
	const [q, setQ] = useState<string>(() => searchParams.get("q") ?? "");
	// Feature 4 — starred-only toggle (`?starred=true`).
	const [starredOnly, setStarredOnly] = useState<boolean>(() => searchParams.get("starred") === "true");
	// Feature 7 — environment filter chips (`?env=development|production`).
	const [env, setEnv] = useState<string>(() => searchParams.get("env") ?? "all");
	// Feature 3 — deep link from /telescope/users (`?userId=<id>`).
	const userIdParam: string | null = searchParams.get("userId");
	const [userIdFilter, setUserIdFilter] = useState<string | null>(userIdParam);
	// Improvement 11 — an explicit `?sort=` in the URL wins; otherwise the persisted pref (improvement 10).
	const [sort, setSort] = useState<string>(() => searchParams.get("sort") ?? loadTablePrefs().sort);
	const [correlationFilter, setCorrelationFilter] = useState<string | null>(correlationParam);
	const [page, setPage] = useState<number>(1);
	const [pageSize, setPageSize] = useState<number>(() => loadTablePrefs().pageSize);

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
		if (userIdFilter !== null) draft.userId = userIdFilter;
		if (env !== "all") draft.env = env;
		if (q.trim().length > 0) draft.q = q.trim();
		if (starredOnly) draft.starred = "true";
		return TelescopeRequestListQuerySchema.parse(draft);
	}, [page, pageSize, sort, method, status, minDuration, correlationFilter, userIdFilter, env, q, starredOnly]);

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
	const handleManualPaginationChange = useCallback(
		(nextPage: number, nextPageSize: number): void => {
			setPage(nextPage);
			setPageSize(nextPageSize);
			// Improvement 10 — persist the chosen page size for next time.
			saveTablePrefs({ pageSize: nextPageSize, sort });
			setNewRequestCount(0);
		},
		[sort],
	);

	// Improvement 11 — imperatively mirror the active filter into the URL so a
	// filtered view is shareable + refresh-safe (the correlation param survives).
	const syncUrl = useCallback(
		(next: {
			readonly method?: string;
			readonly status?: string;
			readonly minDuration?: string;
			readonly sort?: string;
			readonly q?: string;
			readonly starredOnly?: boolean;
			readonly env?: string;
			readonly userId?: string | null;
		}): void => {
			const params: URLSearchParams = new URLSearchParams();
			const effectiveMethod: string = next.method ?? method;
			const effectiveStatus: string = next.status ?? status;
			const effectiveMin: string = next.minDuration ?? minDuration;
			const effectiveSort: string = next.sort ?? sort;
			const effectiveQ: string = next.q ?? q;
			const effectiveStarred: boolean = next.starredOnly ?? starredOnly;
			const effectiveEnv: string = next.env ?? env;
			const effectiveUserId: string | null = next.userId === undefined ? userIdFilter : next.userId;

			if (effectiveMethod !== "all") params.set("method", effectiveMethod);
			if (effectiveStatus !== "all") params.set("status", effectiveStatus);
			if (effectiveMin !== "") params.set("min", effectiveMin);
			if (effectiveSort !== "newest") params.set("sort", effectiveSort);
			if (effectiveQ.trim().length > 0) params.set("q", effectiveQ.trim());
			if (effectiveStarred) params.set("starred", "true");
			if (effectiveEnv !== "all") params.set("env", effectiveEnv);
			if (effectiveUserId !== null && effectiveUserId.length > 0) params.set("userId", effectiveUserId);
			if (correlationFilter !== null) params.set("correlation", correlationFilter);
			const query: string = params.toString();
			router.replace(query.length > 0 ? `/telescope/requests?${query}` : "/telescope/requests", { scroll: false });
		},
		[router, method, status, minDuration, sort, correlationFilter, q, starredOnly, env, userIdFilter],
	);

	const handleRowClick = useCallback(
		(row: RequestLogSummary): void => {
			router.push(`/telescope/requests/${row.id}`);
		},
		[router],
	);

	// Improvement 6 — Compare: exactly two selected rows open the diff page.
	// Feature 5 — Export JSON: download the selected rows as a JSON file.
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
			{
				key: "export-json",
				label: "Export JSON",
				icon: <Download className="size-3.5" />,
				onClick: (rows: RequestLogSummary[]): void => {
					downloadJsonRows(rows);
					toast.success(`Exported ${String(rows.length)} request${rows.length === 1 ? "" : "s"} as JSON.`);
				},
			},
		],
		[router],
	);

	const clearCorrelation = useCallback((): void => {
		setCorrelationFilter(null);
		resetNewCount();
		syncUrl({});
	}, [resetNewCount, syncUrl]);

	// Feature 3 — clear the userId deep-link filter (from /telescope/users).
	const clearUserId = useCallback((): void => {
		setUserIdFilter(null);
		resetNewCount();
		syncUrl({ userId: null });
	}, [resetNewCount, syncUrl]);

	// Select's `onValueChange` passes `string | null` — narrow before writing.
	const handleMethodChange = useCallback(
		(value: string | null): void => {
			if (value === null) return;
			setMethod(value);
			resetNewCount();
			syncUrl({ method: value });
		},
		[resetNewCount, syncUrl],
	);
	const handleStatusChange = useCallback(
		(value: string | null): void => {
			if (value === null) return;
			setStatus(value);
			resetNewCount();
			syncUrl({ status: value });
		},
		[resetNewCount, syncUrl],
	);
	const handleSortChange = useCallback(
		(value: string | null): void => {
			if (value === null) return;
			setSort(value);
			resetNewCount();
			// Improvement 10 — remember the sort preference for next visit.
			saveTablePrefs({ pageSize, sort: value });
			syncUrl({ sort: value });
		},
		[resetNewCount, syncUrl, pageSize],
	);
	const handleMinDurationChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			setMinDuration(event.target.value);
			resetNewCount();
			syncUrl({ minDuration: event.target.value });
		},
		[resetNewCount, syncUrl],
	);
	// Feature 2 — free-text search box (debounce handled by the input; the
	// query rebuilds on every keystroke and the server filters cheaply).
	const handleQChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			setQ(event.target.value);
			setPage(1);
			resetNewCount();
			syncUrl({ q: event.target.value });
		},
		[resetNewCount, syncUrl],
	);
	// Feature 4 — starred-only toggle.
	const handleStarredToggle = useCallback((): void => {
		const next = !starredOnly;
		setStarredOnly(next);
		setPage(1);
		resetNewCount();
		syncUrl({ starredOnly: next });
	}, [starredOnly, resetNewCount, syncUrl]);
	// Feature 7 — environment filter chips.
	const handleEnvChange = useCallback(
		(value: string | null): void => {
			if (value === null) return;
			setEnv(value);
			setPage(1);
			resetNewCount();
			syncUrl({ env: value });
		},
		[resetNewCount, syncUrl],
	);

	// Feature 9 — apply a saved filter to the live filter state.
	const handleApplySavedFilter = useCallback(
		(filter: SavedFilterValue): void => {
			setMethod(filter.method);
			setStatus(filter.status);
			setMinDuration(filter.minDuration);
			setSort(filter.sort);
			resetNewCount();
			// Improvement 11 — applying a bookmark also makes the URL shareable.
			syncUrl({ method: filter.method, status: filter.status, minDuration: filter.minDuration, sort: filter.sort });
		},
		[resetNewCount, syncUrl],
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
				// Feature 14 (end-to-end) — inline star so starring happens in the
				// list, not just the detail page.
				id: "star",
				header: (): React.JSX.Element => <span className="sr-only">Star</span>,
				cell: ({ row }): React.JSX.Element => (
					<RowStarToggle
						request={row.original}
						onChanged={(): void => {
							void listQuery.refetch();
						}}
					/>
				),
			},
			{
				// Feature 3 (end-to-end) — the resolved email as its own toggleable
				// column; click to filter the list to that user.
				id: "email",
				header: "Email",
				cell: ({ row }): React.JSX.Element => {
					const userId: string | null = row.original.userId;
					const email: string | null = row.original.userEmail;
					if (userId === null) {
						return <span className="text-xs text-muted-foreground">—</span>;
					}
					if (email === null) {
						return <span className="font-mono text-xs text-muted-foreground">{userId.slice(0, 8)}…</span>;
					}
					return (
						<button
							type="button"
							onClick={(event: React.MouseEvent): void => {
								event.stopPropagation();
								setUserIdFilter(userId);
								resetNewCount();
								syncUrl({ userId });
							}}
							className="inline-flex max-w-[12rem] items-center rounded-md bg-muted/60 px-1.5 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
							title={`${email} — click to filter to this user`}>
							<span className="truncate">{email}</span>
						</button>
					);
				},
			},
			{
				// Feature 3 (end-to-end) — the opaque user id, toggleable separately
				// from the email column; click to filter the list to that user.
				id: "user",
				header: "User id",
				cell: ({ row }): React.JSX.Element => {
					const userId: string | null = row.original.userId;
					if (userId === null) {
						return <span className="text-xs text-muted-foreground">—</span>;
					}
					return (
						<button
							type="button"
							onClick={(event: React.MouseEvent): void => {
								event.stopPropagation();
								setUserIdFilter(userId);
								resetNewCount();
								syncUrl({ userId });
							}}
							className="inline-flex max-w-[9rem] items-center rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
							title={`${userId} — click to filter to this user`}>
							<span className="truncate">{userId}</span>
						</button>
					);
				},
			},
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
			{
				// Improvement 4 — N+1 surfaced on the list: a badge on requests whose
				// captured queries trip the detector (count lives in the summary).
				accessorKey: "n1WarningCount",
				header: "N+1",
				cell: ({ row }): React.JSX.Element =>
					row.original.n1WarningCount > 0 ? (
						<span
							title={`${String(row.original.n1WarningCount)} query pattern${row.original.n1WarningCount === 1 ? "" : "s"} flagged`}
							className="inline-flex items-center rounded-full border border-amber-300/60 bg-amber-500/10 px-2 py-0.5 font-mono text-xs font-medium text-amber-700 tabular-nums dark:border-amber-500/40 dark:text-amber-400">
							{String(row.original.n1WarningCount)}×
						</span>
					) : (
						<span className="text-xs text-muted-foreground">—</span>
					),
			},
		],
		[listQuery, setUserIdFilter, resetNewCount, syncUrl],
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
				{item.userId !== null ? <div className="mt-1.5 truncate font-mono text-[10px] text-muted-foreground/80">{item.userEmail ?? item.userId}</div> : null}
			</div>
		);
	}, []);

	// Filter bar — dumb controls; changing any filter remounts the table (key)
	// so its internal pager resets to page 1 instead of fetching a stale page.
	const filtersKey: string = useMemo(
		() => JSON.stringify({ method, status, minDuration, sort, correlationFilter, userIdFilter, env, q, starredOnly, page, pageSize }),
		[method, status, minDuration, sort, correlationFilter, userIdFilter, env, q, starredOnly, page, pageSize],
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

			{userIdFilter !== null ? (
				<div className="flex items-center gap-2 rounded-lg border border-violet-300/60 bg-violet-500/10 px-3 py-2 text-xs text-violet-700 dark:border-violet-500/40 dark:text-violet-400">
					<span className="font-medium">Filtered to user</span>
					{rows[0]?.userEmail !== null ? <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{rows[0]?.userEmail}</code> : null}
					<code className="rounded bg-muted px-1.5 py-0.5 font-mono">{userIdFilter}</code>
					<Button variant="ghost" size="sm" onClick={clearUserId} className="ml-auto h-6 px-2 text-xs">
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

				{/* Feature 2 — free-text search (path / query-string / body). */}
				<div className="flex flex-col gap-1.5">
					<label htmlFor="tel-q" className="text-xs font-medium text-muted-foreground">
						Search
					</label>
					<div className="relative">
						<SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
						<Input id="tel-q" type="search" placeholder="path, body, query, user id…" value={q} onChange={handleQChange} className="h-9 w-56 pl-8 text-sm" />
					</div>
				</div>

				{/* Feature 7 — environment filter chips. */}
				<div className="flex flex-col gap-1.5">
					<label htmlFor="tel-env" className="text-xs font-medium text-muted-foreground">
						Environment
					</label>
					<Select value={env} onValueChange={handleEnvChange} items={[{ value: "all", label: "All environments" }, ...ENV_OPTIONS]}>
						<SelectTrigger id="tel-env" className="h-9 w-40 text-sm">
							<SelectValue placeholder="Environment" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All environments</SelectItem>
							{ENV_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Feature 4 — starred-only toggle. */}
				<div className="flex flex-col gap-1.5">
					<span className="text-xs font-medium text-muted-foreground">&nbsp;</span>
					<Button
						type="button"
						variant={starredOnly ? "default" : "outline"}
						size="sm"
						onClick={handleStarredToggle}
						className={`h-9 ${starredOnly ? "" : "text-muted-foreground"}`}
						aria-pressed={starredOnly}>
						<Star className={`size-3.5 ${starredOnly ? "fill-current" : ""}`} />
						Starred only
					</Button>
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

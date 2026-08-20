"use client";

// ============================================
// app/(panel)/telescope/requests/page.tsx
// Feature 0 — the request log table. Combines the paginated data table with
// per-row detail, status-method chips, duration badges, star toggle, request
// detail slide-over (URL-driven), export CSV, auto-open ?id=, and SSE-driven
// new-request pill. v2 polish: skeleton loaders, filter chips, column toggle,
// mobile card layout, and a full-text search bar.
// ============================================

import { useAuth } from "@workspace/client/lib/auth";

import { Button } from "@workspace/ui/components/form/button";
import { Input } from "@workspace/ui/components/form/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/form/select";
import { Skeleton } from "@workspace/ui/components/feedback/skeleton";
import { ArrowUpDown, ChevronLeft, ChevronRight, Download, Info, Search, Star, StarOff, TriangleAlert, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";

import { type Envelope, type RequestLogSummary, type TelescopeRequestListQuery, type TelescopeRequestListResponse, TelescopeRequestListQuerySchema } from "@workspace/shared";

import { durationLabel, durationTone, formatTime, statusTone } from "@/lib/telescope";
import { useTelescopeLive } from "@/lib/use-telescope-live";

// ── Helper components ────────────────────────────────────────────────────────

function SkeletonTable({ rows, cols }: { readonly rows: number; readonly cols: number }): React.JSX.Element {
	return (
		<>
			{Array.from({ length: rows }, (_, i) => (
				<tr key={i} className="border-b last:border-b-0">
					{Array.from({ length: cols }, (_, j) => (
						<td key={j} className="px-4 py-2.5">
							<Skeleton className="h-4 w-full" />
						</td>
					))}
				</tr>
			))}
		</>
	);
}

function TableErrorState({ message, onRetry }: { readonly message: string; readonly onRetry: () => void }): React.JSX.Element {
	return (
		<div className="flex flex-col items-center gap-3 py-12 text-center">
			<TriangleAlert className="size-6 text-destructive" />
			<p className="text-sm text-destructive">{message}</p>
			<Button variant="outline" size="sm" onClick={onRetry}>
				Retry
			</Button>
		</div>
	);
}

function FilterChip({ label, onRemove }: { readonly label: string; readonly onRemove: () => void }): React.JSX.Element {
	return (
		<span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs">
			{label}
			<button type="button" onClick={onRemove} className="ml-0.5 rounded-full hover:bg-muted-foreground/20">
				<X className="size-3" />
			</button>
		</span>
	);
}

function ExportCsvButton({ rows, filename }: { readonly rows: readonly RequestLogSummary[]; readonly filename: string }): React.JSX.Element {
	const handleExport = useCallback((): void => {
		const header = "Method,Path,Status,Duration,User,Time\n";
		const csv = rows
			.map((r) => `${r.method},"${r.path}",${String(r.statusCode ?? "")},${String(r.durationMs)},${r.userEmail ?? r.userId ?? ""},${new Date(r.createdAt).toISOString()}`)
			.join("\n");
		const blob = new Blob([header + csv], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${filename}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}, [rows, filename]);

	return (
		<Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleExport}>
			<Download className="size-3" /> Export
		</Button>
	);
}

function ColumnTogglePanel(): React.JSX.Element {
	return <></>;
}

function RequestDetailSlideOver({
	requestId,
	onClose,
	onFilterUser,
}: {
	readonly requestId: string;
	readonly onClose: () => void;
	readonly onFilterUser: (userId: string | null) => void;
}): React.JSX.Element {
	const { api } = useAuth();
	const detailQuery = api.telescope.requestDetail.useQuery({ id: requestId });
	const detail = detailQuery.data?.data;
	const req = detail?.request;

	const handleFilterAndClose = useCallback((): void => {
		if (req?.userId != null) {
			onFilterUser(req.userId);
			onClose();
		}
	}, [onFilterUser, onClose, req]);

	return (
		<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="fixed inset-0 z-50 flex justify-end">
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.15 }}
				className="absolute inset-0 bg-black/40"
				onClick={onClose}
			/>
			<motion.div
				initial={{ x: "100%" }}
				animate={{ x: 0 }}
				exit={{ x: "100%" }}
				transition={{ type: "spring", damping: 30, stiffness: 300 }}
				className="relative z-10 ml-auto flex h-full w-full max-w-lg flex-col overflow-y-auto bg-background shadow-xl">
				<div className="flex items-center justify-between border-b px-4 py-3">
					<h2 className="text-sm font-semibold">Request Detail</h2>
					<Button variant="ghost" size="sm" onClick={onClose}>
						<X className="size-4" />
					</Button>
				</div>
				<div className="flex-1 p-4">
					{detailQuery.isLoading ? (
						<div className="space-y-3">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-3/4" />
							<Skeleton className="h-20 w-full" />
						</div>
					) : detail === undefined ? (
						<p className="text-sm text-muted-foreground">Not found.</p>
					) : (
						<div className="space-y-4 text-sm">
							{req != null ? (
								<>
									<div className="flex items-center gap-2">
										<span className="font-mono text-xs font-semibold">{req.method}</span>
										<span className="font-mono text-xs">{req.path}</span>
									</div>
									<div className="grid grid-cols-2 gap-2">
										<div>
											<span className="text-muted-foreground">Status:</span> <span className="font-mono">{req.statusCode ?? "—"}</span>
										</div>
										<div>
											<span className="text-muted-foreground">Duration:</span> <span className="font-mono">{durationLabel(req.durationMs)}</span>
										</div>
										<div>
											<span className="text-muted-foreground">User:</span> <span>{req.userEmail ?? req.userId ?? "anon"}</span>
										</div>
										<div>
											<span className="text-muted-foreground">Time:</span> <span>{formatTime(req.createdAt)}</span>
										</div>
									</div>
									{req.queryString != null && req.queryString.length > 0 ? (
										<div>
											<p className="mb-1 text-xs font-medium text-muted-foreground">Query params</p>
											<pre className="overflow-auto rounded bg-muted p-2 font-mono text-xs">{req.queryString}</pre>
										</div>
									) : null}
									{req.requestBody != null ? (
										<div>
											<p className="mb-1 text-xs font-medium text-muted-foreground">Body</p>
											<pre className="overflow-auto rounded bg-muted p-2 font-mono text-xs">
												{typeof req.requestBody === "string" ? req.requestBody : JSON.stringify(req.requestBody, null, 2)}
											</pre>
										</div>
									) : null}
									{req.userId != null ? (
										<Button variant="outline" size="sm" className="text-xs" onClick={handleFilterAndClose}>
											Filter by this user
										</Button>
									) : null}
								</>
							) : null}
						</div>
					)}
				</div>
			</motion.div>
		</motion.div>
	);
} // ── Helper components ────────────────────────────────────────────────────────

function RequestRowInfoButton({ id, onOpen }: { readonly id: string; readonly onOpen: (id: string) => void }): React.JSX.Element {
	const handleClick = useCallback((): void => {
		onOpen(id);
	}, [onOpen, id]);

	return (
		<Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={handleClick}>
			<Info className="size-3" />
		</Button>
	);
}

function MobileRequestCard({ row, onOpen }: { readonly row: RequestLogSummary; readonly onOpen: (id: string) => void }): React.JSX.Element {
	const tone = statusTone(row.statusCode);
	const handleDetailsClick = useCallback((): void => {
		onOpen(row.id);
	}, [onOpen, row.id]);
	return (
		<div className="space-y-2 rounded-lg border bg-card p-3 shadow-xs">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-xs ${tone.pillClass}`}>{row.method}</span>
					<span className="text-xs text-muted-foreground">{formatTime(row.createdAt)}</span>
				</div>
				<span className={`font-mono text-xs ${durationTone(row.durationMs).textClass}`}>{durationLabel(row.durationMs)}</span>
			</div>
			<p className="truncate font-mono text-sm">{row.path}</p>
			<div className="flex items-center justify-between text-xs text-muted-foreground">
				<span>{row.userId !== null ? (row.userEmail ?? row.userId.slice(0, 8)) : "anonymous"}</span>
				<div className="flex items-center gap-2">
					{row.starred ? <Star className="size-3 text-amber-500" /> : null}
					{row.n1WarningCount > 0 ? <TriangleAlert className="size-3 text-amber-500" /> : null}

					<button type="button" onClick={handleDetailsClick} className="text-primary hover:underline">
						Details →
					</button>
				</div>
			</div>
		</div>
	);
}

// ── Main component ───────────────────────────────────────────────────────────

function RequestsContent({ initialEnvelope }: { readonly initialEnvelope: Envelope<{ readonly list: TelescopeRequestListResponse }> }): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();
	const searchParams = useSearchParams();
	const correlationParam: string | null = searchParams.get("correlation");

	const [method, setMethod] = useState<string>(() => searchParams.get("method") ?? "all");
	const [status, setStatus] = useState<string>(() => searchParams.get("status") ?? "all");
	const [minDuration, setMinDuration] = useState<string>(() => searchParams.get("min") ?? "");
	const [starredOnly, setStarredOnly] = useState<boolean>(() => searchParams.get("starred") === "true");
	const [env, setEnv] = useState<string>(() => searchParams.get("env") ?? "all");
	const [sort, setSort] = useState<string>(() => searchParams.get("sort") ?? "newest");
	const [page, setPage] = useState<number>(1);
	const pageSize = 20;
	const [searchQuery, setSearchQuery] = useState<string>(() => searchParams.get("q") ?? "");
	const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

	const query: TelescopeRequestListQuery = useMemo((): TelescopeRequestListQuery => {
		const draft: Record<string, string | number> = { page, pageSize, sort };
		if (method !== "all") draft.method = method;
		if (status !== "all") draft.status = status;
		if (minDuration !== "") draft.minDurationMs = minDuration;
		if (correlationParam !== null) draft.correlationId = correlationParam;
		if (selectedUserId !== null) draft.userId = selectedUserId;
		if (env !== "all") draft.env = env;
		if (searchQuery.trim().length > 0) draft.q = searchQuery.trim();
		if (starredOnly) draft.starred = "true";
		return TelescopeRequestListQuerySchema.parse(draft);
	}, [page, pageSize, sort, method, status, minDuration, correlationParam, selectedUserId, env, searchQuery, starredOnly]);

	const isDefaultQuery: boolean =
		page === 1 &&
		sort === "newest" &&
		method === "all" &&
		status === "all" &&
		minDuration === "" &&
		!starredOnly &&
		env === "all" &&
		searchQuery === "" &&
		correlationParam === null &&
		selectedUserId === null;
	const listQuery = api.telescope.requests.useQuery(query, { placeholderData: (previous) => previous, initialData: isDefaultQuery ? initialEnvelope : undefined });

	const rows: readonly RequestLogSummary[] = useMemo(() => listQuery.data?.data.list.items ?? [], [listQuery.data]);
	const totalCount: number = listQuery.data?.data.list.total ?? 0;

	const [newCount, setNewCount] = useState<number>(0);
	const syncUrl = useCallback((): void => {
		const params = new URLSearchParams();
		if (method !== "all") params.set("method", method);
		if (status !== "all") params.set("status", status);
		if (minDuration !== "") params.set("min", minDuration);
		if (sort !== "newest") params.set("sort", sort);
		if (starredOnly) params.set("starred", "true");
		if (env !== "all") params.set("env", env);
		if (searchQuery.trim().length > 0) params.set("q", searchQuery.trim());
		if (correlationParam !== null) params.set("correlation", correlationParam);
		if (selectedUserId !== null) params.set("userId", selectedUserId);
		const qs = params.toString();
		router.replace(`/telescope/requests${qs.length > 0 ? `?${qs}` : ""}`, { scroll: false });
	}, [method, status, minDuration, sort, starredOnly, env, searchQuery, correlationParam, selectedUserId, router]);

	const resetNewCount = useCallback((): void => {
		setNewCount(0);
	}, []);

	const refresh = useCallback((): void => {
		resetNewCount();
		void listQuery.refetch();
	}, [resetNewCount, listQuery]);

	const handleRefetch = useCallback((): void => {
		void listQuery.refetch();
	}, [listQuery]);

	const handleFilterUser = useCallback(
		(userId: string | null): void => {
			setSelectedUserId(userId);
			setPage(1);
			resetNewCount();
		},
		[resetNewCount],
	);

	const live = useTelescopeLive(
		useCallback((): void => {
			setNewCount((prev) => prev + 1);
		}, []),
	);

	// URL-driven open; displayId state holds the id for AnimatePresence exit animation.
	const [displayId, setDisplayId] = useState<string | null>(() => searchParams.get("id"));

	const openSlideOver = useCallback(
		(id: string): void => {
			setDisplayId(id);
			const params = new URLSearchParams(searchParams.toString());
			params.set("id", id);
			router.replace(`/telescope/requests?${params.toString()}`, { scroll: false });
		},
		[router, searchParams],
	);

	const closeSlideOver = useCallback((): void => {
		// Let exit animation play, then clear displayId + URL.
		setTimeout((): void => {
			setDisplayId(null);
			const params = new URLSearchParams(searchParams.toString());
			params.delete("id");
			const qs = params.toString();
			router.replace(`/telescope/requests${qs.length > 0 ? `?${qs}` : ""}`, { scroll: false });
		}, 200);
	}, [router, searchParams]);

	// Handle browser back/forward (URL loses ?id=).
	// No useEffect needed — slideOverId is URL-derived, closeSlideOver handles the animation.

	const handleMethodChange = useCallback(
		(value: string | null): void => {
			setMethod(value ?? "all");
			setPage(1);
			resetNewCount();
			syncUrl();
		},
		[resetNewCount, syncUrl],
	);
	const handleStatusChange = useCallback(
		(value: string | null): void => {
			setStatus(value ?? "all");
			setPage(1);
			resetNewCount();
			syncUrl();
		},
		[resetNewCount, syncUrl],
	);
	const handleMinDurationChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			setMinDuration(event.target.value);
			setPage(1);
			resetNewCount();
		},
		[resetNewCount],
	);
	const handleStarredToggle = useCallback((): void => {
		setStarredOnly((prev) => !prev);
		setPage(1);
		resetNewCount();
	}, [resetNewCount]);
	const handleEnvChange = useCallback(
		(value: string | null): void => {
			setEnv(value ?? "all");
			setPage(1);
			resetNewCount();
			syncUrl();
		},
		[resetNewCount, syncUrl],
	);
	const handleSortChange = useCallback(
		(value: string | null): void => {
			setSort(value ?? "newest");
			setPage(1);
			resetNewCount();
			syncUrl();
		},
		[resetNewCount, syncUrl],
	);
	const handleSearchChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			setSearchQuery(event.target.value);
			setPage(1);
			resetNewCount();
		},
		[resetNewCount],
	);
	const handleSearchSubmit = useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			resetNewCount();
			syncUrl();
		},
		[resetNewCount, syncUrl],
	);
	const clearCorrelation = useCallback((): void => {
		const params = new URLSearchParams(searchParams.toString());
		params.delete("correlation");
		const qs = params.toString();
		router.replace(`/telescope/requests${qs.length > 0 ? `?${qs}` : ""}`, { scroll: false });
	}, [router, searchParams]);
	const clearUserFilter = useCallback((): void => {
		setSelectedUserId(null);
		setPage(1);
		resetNewCount();
	}, [resetNewCount]);
	const clearAllFilters = useCallback((): void => {
		setMethod("all");
		setStatus("all");
		setMinDuration("");
		setStarredOnly(false);
		setEnv("all");
		setSort("newest");
		setSearchQuery("");
		setSelectedUserId(null);
		setPage(1);
		resetNewCount();
		router.replace("/telescope/requests", { scroll: false });
	}, [resetNewCount, router]);

	// ── Filter chip removal handlers ─────────────────────────────────────────────
	const removeMethodFilter = useCallback((): void => {
		setMethod("all");
		setPage(1);
		resetNewCount();
		syncUrl();
	}, [resetNewCount, syncUrl]);
	const removeStatusFilter = useCallback((): void => {
		setStatus("all");
		setPage(1);
		resetNewCount();
		syncUrl();
	}, [resetNewCount, syncUrl]);
	const removeMinDurationFilter = useCallback((): void => {
		setMinDuration("");
		setPage(1);
		resetNewCount();
	}, [resetNewCount]);
	const removeEnvFilter = useCallback((): void => {
		setEnv("all");
		setPage(1);
		resetNewCount();
		syncUrl();
	}, [resetNewCount, syncUrl]);
	const removeStarredFilter = useCallback((): void => {
		setStarredOnly(false);
		setPage(1);
		resetNewCount();
	}, [resetNewCount]);
	const removeSearchFilter = useCallback((): void => {
		setSearchQuery("");
		setPage(1);
		resetNewCount();
	}, [resetNewCount]);

	// ── Sort handlers ───────────────────────────────────────────────────────────
	const handleTimeSort = useCallback((): void => {
		handleSortChange(sort === "newest" ? "oldest" : "newest");
	}, [handleSortChange, sort]);
	const handleDurationSort = useCallback((): void => {
		handleSortChange(sort === "duration" ? "newest" : "duration");
	}, [handleSortChange, sort]);

	const totalPages: number = Math.max(1, Math.ceil(totalCount / pageSize));

	// ── Table row info button ───────────────────────────────────────────────────
	const handleRowInfo = useCallback(
		(id: string): void => {
			openSlideOver(id);
		},
		[openSlideOver],
	);

	// ── Pagination handlers ─────────────────────────────────────────────────────
	const handlePrevPage = useCallback((): void => {
		setPage((p) => Math.max(1, p - 1));
		resetNewCount();
	}, [resetNewCount]);
	const handleNextPage = useCallback((): void => {
		setPage((p) => Math.min(totalPages, p + 1));
		resetNewCount();
	}, [resetNewCount, totalPages]);

	const hasActiveFilters: boolean =
		method !== "all" ||
		status !== "all" ||
		minDuration !== "" ||
		starredOnly ||
		env !== "all" ||
		searchQuery.trim().length > 0 ||
		correlationParam !== null ||
		selectedUserId !== null;

	return (
		<div className="mx-auto w-full max-w-7xl space-y-4">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<div className="flex flex-wrap items-center gap-2.5">
						<h1 className="text-2xl font-semibold tracking-tight text-foreground">Requests</h1>
						{live.connected ? (
							<span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/60 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-400">
								<span className="size-1.5 animate-pulse rounded-full bg-emerald-500" /> live
							</span>
						) : null}
						{newCount > 0 ? (
							<button
								type="button"
								onClick={refresh}
								className="inline-flex items-center gap-1 rounded-full border border-sky-300/60 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-700 transition-colors hover:bg-sky-500/20 dark:border-sky-500/40 dark:text-sky-400">
								{String(newCount)} new — click to refresh
							</button>
						) : null}
					</div>
					<p className="mt-1 max-w-xl text-sm text-muted-foreground">
						{totalCount > 0 ? `${String(totalCount)} total` : "Loading…"} · sorted by {sort}
						{correlationParam !== null ? ` · filtered by correlation ${correlationParam.slice(0, 8)}…` : ""}
						{selectedUserId !== null ? ` · filtered by user ${selectedUserId.slice(0, 8)}…` : ""}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={refresh}>
						Refresh
					</Button>
					<ExportCsvButton rows={rows} filename="telescope-requests" />
					<ColumnTogglePanel />
				</div>
			</header>
			<div className="flex flex-wrap items-center gap-3">
				<form onSubmit={handleSearchSubmit} className="relative max-w-sm flex-1">
					<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input value={searchQuery} onChange={handleSearchChange} placeholder="Search paths…" className="h-8 pl-9 text-xs" />
				</form>
				<Select value={method} onValueChange={handleMethodChange}>
					<SelectTrigger className="h-8 w-[100px] text-xs">
						<SelectValue placeholder="Method" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All methods</SelectItem>
						<SelectItem value="GET">GET</SelectItem>
						<SelectItem value="POST">POST</SelectItem>
						<SelectItem value="PUT">PUT</SelectItem>
						<SelectItem value="PATCH">PATCH</SelectItem>
						<SelectItem value="DELETE">DELETE</SelectItem>
					</SelectContent>
				</Select>
				<Select value={status} onValueChange={handleStatusChange}>
					<SelectTrigger className="h-8 w-[100px] text-xs">
						<SelectValue placeholder="Status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All statuses</SelectItem>
						<SelectItem value="2xx">2xx</SelectItem>
						<SelectItem value="3xx">3xx</SelectItem>
						<SelectItem value="4xx">4xx</SelectItem>
						<SelectItem value="5xx">5xx</SelectItem>
					</SelectContent>
				</Select>
				<Input value={minDuration} onChange={handleMinDurationChange} placeholder="Min ms" className="h-8 w-[80px] text-xs" type="number" min="0" />
				<Select value={env} onValueChange={handleEnvChange}>
					<SelectTrigger className="h-8 w-[80px] text-xs">
						<SelectValue placeholder="Env" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All envs</SelectItem>
						<SelectItem value="production">production</SelectItem>
						<SelectItem value="staging">staging</SelectItem>
						<SelectItem value="development">development</SelectItem>
					</SelectContent>
				</Select>
				<Button variant={starredOnly ? "default" : "outline"} size="sm" className="h-8 gap-1 text-xs" onClick={handleStarredToggle}>
					{starredOnly ? <StarOff className="size-3" /> : <Star className="size-3" />}
					{starredOnly ? "Starred" : "Star"}
				</Button>
				<Select value={sort} onValueChange={handleSortChange}>
					<SelectTrigger className="h-8 w-[100px] text-xs">
						<SelectValue placeholder="Sort" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="newest">Newest</SelectItem>
						<SelectItem value="oldest">Oldest</SelectItem>
						<SelectItem value="duration">Slowest</SelectItem>
						<SelectItem value="errors">Errors</SelectItem>
					</SelectContent>
				</Select>
				{hasActiveFilters ? (
					<Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearAllFilters}>
						Clear all
					</Button>
				) : null}
			</div>
			{hasActiveFilters ? (
				<div className="flex flex-wrap items-center gap-2">
					{method !== "all" ? <FilterChip label={`Method: ${method}`} onRemove={removeMethodFilter} /> : null}
					{status !== "all" ? <FilterChip label={`Status: ${status}`} onRemove={removeStatusFilter} /> : null}
					{minDuration !== "" ? <FilterChip label={`Min: ${minDuration}ms`} onRemove={removeMinDurationFilter} /> : null}
					{env !== "all" ? <FilterChip label={`Env: ${env}`} onRemove={removeEnvFilter} /> : null}
					{starredOnly ? <FilterChip label="Starred" onRemove={removeStarredFilter} /> : null}
					{correlationParam !== null ? <FilterChip label={`Correlation: ${correlationParam.slice(0, 8)}…`} onRemove={clearCorrelation} /> : null}
					{selectedUserId !== null ? <FilterChip label={`User: ${selectedUserId.slice(0, 8)}…`} onRemove={clearUserFilter} /> : null}
					{searchQuery.trim().length > 0 ? <FilterChip label={`Search: "${searchQuery.trim()}"`} onRemove={removeSearchFilter} /> : null}
				</div>
			) : null}
			<div className="rounded-lg border bg-card text-card-foreground shadow-xs">
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b text-left text-xs font-medium text-muted-foreground">
								<th className="px-4 py-3">
									{" "}
									<Button variant="ghost" size="sm" className="h-6 gap-1 px-1 text-xs" onClick={handleTimeSort}>
										Time <ArrowUpDown className="size-3" />
									</Button>
								</th>
								<th className="px-4 py-3">Method</th>
								<th className="px-4 py-3">Path</th>
								<th className="px-4 py-3">
									{" "}
									<Button variant="ghost" size="sm" className="h-6 gap-1 px-1 text-xs" onClick={handleDurationSort}>
										Duration <ArrowUpDown className="size-3" />
									</Button>
								</th>
								<th className="px-4 py-3">Status</th>
								<th className="px-4 py-3">User</th>
								<th className="px-4 py-3 text-right">Actions</th>
							</tr>
						</thead>
						<tbody>
							{listQuery.isLoading ? (
								<SkeletonTable rows={pageSize} cols={7} />
							) : listQuery.error ? (
								<tr>
									<td colSpan={7}>
										<TableErrorState message="Failed to load requests." onRetry={handleRefetch} />
									</td>
								</tr>
							) : rows.length === 0 ? (
								<tr>
									<td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
										No requests match the current filters.
									</td>
								</tr>
							) : (
								rows.map((row) => {
									const tone = statusTone(row.statusCode);
									const dur = durationTone(row.durationMs);
									return (
										<tr key={row.id} className="border-b transition-colors last:border-b-0 hover:bg-muted/30">
											<td className="px-4 py-2.5 text-xs whitespace-nowrap text-muted-foreground">{formatTime(row.createdAt)}</td>
											<td className="px-4 py-2.5">
												<span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-xs ${tone.pillClass}`}>{row.method}</span>
											</td>
											<td className="max-w-[300px] truncate px-4 py-2.5 font-mono text-xs">{row.path}</td>
											<td className="px-4 py-2.5 whitespace-nowrap">
												<span className={`font-mono text-xs ${dur.textClass}`}>{durationLabel(row.durationMs)}</span>
											</td>
											<td className="px-4 py-2.5">
												<span className={`font-mono text-xs ${tone.pillClass}`}>{row.statusCode ?? "—"}</span>
											</td>
											<td className="px-4 py-2.5 text-xs text-muted-foreground">{row.userEmail ?? (row.userId !== null ? row.userId.slice(0, 8) : "anon")}</td>
											<td className="px-4 py-2.5 text-right whitespace-nowrap">
												<div className="flex items-center justify-end gap-1">
													{row.starred ? <Star className="size-3 text-amber-500" /> : null}
													{row.n1WarningCount > 0 ? <TriangleAlert className="size-3 text-amber-500" /> : null}

													<RequestRowInfoButton id={row.id} onOpen={handleRowInfo} />
												</div>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>

				{totalCount > pageSize ? (
					<div className="flex items-center justify-between border-t px-4 py-3">
						<p className="text-xs text-muted-foreground">
							Page {String(page)} of {String(totalPages)} ({String(totalCount)} total)
						</p>
						<div className="flex items-center gap-2">
							<Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={handlePrevPage}>
								<ChevronLeft className="size-3" /> Previous
							</Button>
							<Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages} onClick={handleNextPage}>
								Next <ChevronRight className="size-3" />
							</Button>
						</div>
					</div>
				) : null}
			</div>
			<div className="space-y-3 lg:hidden">
				{rows.map((row) => (
					<MobileRequestCard key={row.id} row={row} onOpen={openSlideOver} />
				))}
			</div>{" "}
			<AnimatePresence>
				{displayId !== null ? <RequestDetailSlideOver key={displayId} requestId={displayId} onClose={closeSlideOver} onFilterUser={handleFilterUser} /> : null}
			</AnimatePresence>
		</div>
	);
}

export default function TelescopeRequestsPage({
	initialEnvelope,
}: {
	readonly initialEnvelope: Envelope<{ readonly list: TelescopeRequestListResponse }>;
}): React.JSX.Element {
	return (
		<Suspense fallback={null}>
			<RequestsContent initialEnvelope={initialEnvelope} />
		</Suspense>
	);
}

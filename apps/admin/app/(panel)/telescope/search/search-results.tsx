"use client";

// ============================================
// app/(panel)/telescope/search/page.tsx
// Feature 1 — global free-text search. One query scans every captured surface
// (requests, SQL, exceptions, console logs) and renders grouped results, each
// linking into its owning detail view. The search term lives in `?q=` so a
// result set is shareable and survives refresh.
// ============================================

import { useAuth } from "@workspace/client/lib/auth";

import { Button } from "@workspace/ui/components/form/button";
import { Input } from "@workspace/ui/components/form/input";
import { Search as SearchIcon, TriangleAlert } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";

import {
	TelescopeSearchQuerySchema,
	type TelescopeSearchExceptionMatch,
	type TelescopeSearchLogMatch,
	type TelescopeSearchRequestMatch,
	type TelescopeSearchResponse,
	type TelescopeSearchSqlMatch,
} from "@workspace/shared";
import type { Envelope } from "@workspace/shared";

import { durationLabel, durationTone, formatTime, statusTone } from "@/lib/telescope";

function SearchContent({ initialSearchData }: { readonly initialSearchData?: Envelope<TelescopeSearchResponse> }): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();
	const searchParams = useSearchParams();

	const initialQ: string = searchParams.get("q") ?? "";
	const [q, setQ] = useState<string>(initialQ);

	const query = useMemo(() => {
		const trimmed: string = q.trim();
		if (trimmed.length === 0) {
			return null;
		}
		const parsed = TelescopeSearchQuerySchema.safeParse({ q: trimmed, limit: 10 });
		return parsed.success ? parsed.data : null;
	}, [q]);

	// The input IS the query (`q` + `limit` fold into both the URL and the
	// react-query key, so a new search gets its own cache entry). When the box
	// is empty `query` is null and the fetch is disabled — no request is made.
	const searchQuery = api.telescope.search.useQuery(query ?? { q: "", limit: 1 }, {
		enabled: query !== null,
		placeholderData: (previous) => previous,
		initialData: initialSearchData,
	});

	const results: TelescopeSearchResponse | undefined = searchQuery.data?.data;

	const handleSubmit = useCallback(
		(event: React.SyntheticEvent<HTMLFormElement>): void => {
			event.preventDefault();
			const trimmed: string = q.trim();
			if (trimmed.length === 0) {
				return;
			}
			router.replace(`/telescope/search?q=${encodeURIComponent(trimmed)}`, { scroll: false });
		},
		[q, router],
	);

	const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setQ(event.target.value);
	}, []);

	const handleOpenRequest = useCallback(
		(id: string): void => {
			router.push(`/telescope/requests/${id}`);
		},
		[router],
	);

	const handleOpenUser = useCallback(
		(userId: string): void => {
			router.push(`/telescope/requests?userId=${encodeURIComponent(userId)}`);
		},
		[router],
	);

	const handleOpenSql = useCallback(
		(row: TelescopeSearchSqlMatch): void => {
			router.push(`/telescope/requests?correlation=${row.correlationId}`);
		},
		[router],
	);

	const handleOpenException = useCallback(
		(row: TelescopeSearchExceptionMatch): void => {
			router.push(`/telescope/exceptions?group=${row.errorGroup}`);
		},
		[router],
	);

	const handleOpenLog = useCallback(
		(row: TelescopeSearchLogMatch): void => {
			router.push(`/telescope/requests/${row.requestId}`);
		},
		[router],
	);

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6">
			<header className="space-y-1">
				<h1 className="text-2xl font-bold tracking-tight">Search</h1>
				<p className="text-sm text-muted-foreground">One query across captured requests, SQL, exceptions and console output.</p>
			</header>

			<form onSubmit={handleSubmit} className="flex items-center gap-2">
				<div className="relative flex-1">
					<SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={q}
						onChange={handleChange}
						placeholder="Search paths, SQL, error messages, log lines…"
						className="pl-9"
						autoFocus
						aria-label="Search telescope captures"
					/>
				</div>
				<Button type="submit" disabled={q.trim().length === 0}>
					Search
				</Button>
			</form>

			{query === null ? (
				<p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Type a term above to search every captured surface.</p>
			) : searchQuery.isLoading ? (
				<p className="text-sm text-muted-foreground">Searching…</p>
			) : results === undefined ? (
				<p className="text-sm text-muted-foreground">Searching…</p>
			) : (
				<div className="space-y-6">
					{totalMatches(results) === 0 ? (
						<div className="rounded-lg border border-dashed p-8 text-center">
							<TriangleAlert className="mx-auto size-6 text-muted-foreground" />
							<p className="mt-2 text-sm font-medium">No matches for "{query.q}"</p>
							<p className="text-xs text-muted-foreground">Try a broader term — captures are limited to the retention window.</p>
						</div>
					) : (
						<>
							<RequestResults rows={results.requests} onOpen={handleOpenRequest} onOpenUser={handleOpenUser} />
							<SqlResults rows={results.sql} onOpen={handleOpenSql} />
							<ExceptionResults rows={results.exceptions} onOpen={handleOpenException} />
							<LogResults rows={results.logs} onOpen={handleOpenLog} />
						</>
					)}
				</div>
			)}
		</div>
	);
}

function totalMatches(results: TelescopeSearchResponse): number {
	return results.requests.length + results.sql.length + results.exceptions.length + results.logs.length;
}

/** A titled result group with shared row styling. */
function ResultGroup({ title, count, children }: { readonly title: string; readonly count: number; readonly children: React.ReactNode }): React.JSX.Element {
	if (count === 0) {
		return <></>;
	}
	return (
		<section className="space-y-2">
			<h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
				{title} <span className="ml-1 text-xs">({String(count)})</span>
			</h2>
			<div className="overflow-hidden rounded-lg border">{children}</div>
		</section>
	);
} /** Email/user deep-link inside a search result row. */
function SearchUserLink({ row, onOpenUser }: { readonly row: TelescopeSearchRequestMatch; readonly onOpenUser: (userId: string) => void }): React.JSX.Element {
	const userId: string | null = row.userId;

	const handleClick = useCallback(
		(event: React.MouseEvent): void => {
			event.stopPropagation();
			if (userId !== null) onOpenUser(userId);
		},
		[onOpenUser, userId],
	);

	if (userId === null) {
		return <span>anonymous</span>;
	}

	return (
		<button
			type="button"
			onClick={handleClick}
			className="font-medium text-primary underline-offset-4 hover:underline"
			title={`Filter requests to ${row.userEmail ?? userId}`}>
			{row.userEmail ?? userId}
		</button>
	);
}

function RequestResults({
	rows,
	onOpen,
	onOpenUser,
}: {
	readonly rows: readonly TelescopeSearchRequestMatch[];
	readonly onOpen: (id: string) => void;
	/** Email deep-link: filter the requests table to this user. */
	readonly onOpenUser: (userId: string) => void;
}): React.JSX.Element {
	return (
		<ResultGroup title="Requests" count={rows.length}>
			{rows.map((row) => (
				<SearchRequestRow key={row.id} row={row} onOpen={onOpen} onOpenUser={onOpenUser} />
			))}
		</ResultGroup>
	);
}

function SearchRequestRow({
	row,
	onOpen,
	onOpenUser,
}: {
	readonly row: TelescopeSearchRequestMatch;
	readonly onOpen: (id: string) => void;
	readonly onOpenUser: (userId: string) => void;
}): React.JSX.Element {
	const tone = statusTone(row.statusCode);
	const handleClick = useCallback((): void => {
		onOpen(row.id);
	}, [onOpen, row.id]);

	return (
		<button
			type="button"
			onClick={handleClick}
			className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 border-b px-4 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-muted/50">
			<span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-xs ${tone.pillClass}`}>{row.method}</span>
			<span className="min-w-0">
				<span className="block truncate font-medium">{row.path}</span>
				<span className="truncate text-xs text-muted-foreground">
					<SearchUserLink row={row} onOpenUser={onOpenUser} />
					{" · "}
					{formatTime(row.createdAt)}
				</span>
			</span>
			<span className={`font-mono text-xs ${durationTone(row.durationMs).textClass}`}>{durationLabel(row.durationMs)}</span>
		</button>
	);
}

function SqlResults({ rows, onOpen }: { readonly rows: readonly TelescopeSearchSqlMatch[]; readonly onOpen: (row: TelescopeSearchSqlMatch) => void }): React.JSX.Element {
	return (
		<ResultGroup title="SQL" count={rows.length}>
			{rows.map((row) => (
				<SearchSqlRow key={row.id} row={row} onOpen={onOpen} />
			))}
		</ResultGroup>
	);
}

function SearchSqlRow({ row, onOpen }: { readonly row: TelescopeSearchSqlMatch; readonly onOpen: (row: TelescopeSearchSqlMatch) => void }): React.JSX.Element {
	const handleClick = useCallback((): void => {
		onOpen(row);
	}, [onOpen, row]);

	return (
		<button type="button" onClick={handleClick} className="block w-full border-b px-4 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-muted/50">
			<span className="flex items-center gap-2">
				<span className="rounded border px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
					{row.model}.{row.operation}
				</span>
				<span className={`font-mono text-xs ${durationTone(row.durationMs).textClass}`}>{durationLabel(row.durationMs)}</span>
			</span>
			<span className="mt-1 block truncate font-mono text-xs text-foreground/80">{row.query}</span>
		</button>
	);
}

function ExceptionResults({
	rows,
	onOpen,
}: {
	readonly rows: readonly TelescopeSearchExceptionMatch[];
	readonly onOpen: (row: TelescopeSearchExceptionMatch) => void;
}): React.JSX.Element {
	return (
		<ResultGroup title="Exceptions" count={rows.length}>
			{rows.map((row) => (
				<SearchExceptionRow key={row.id} row={row} onOpen={onOpen} />
			))}
		</ResultGroup>
	);
}

function SearchExceptionRow({
	row,
	onOpen,
}: {
	readonly row: TelescopeSearchExceptionMatch;
	readonly onOpen: (row: TelescopeSearchExceptionMatch) => void;
}): React.JSX.Element {
	const handleClick = useCallback((): void => {
		onOpen(row);
	}, [onOpen, row]);

	return (
		<button type="button" onClick={handleClick} className="block w-full border-b px-4 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-muted/50">
			<span className="flex items-center gap-2">
				<span className="font-medium text-red-600 dark:text-red-400">{row.name}</span>
				<span className="text-xs text-muted-foreground">
					×{String(row.occurrences)} · {row.path ?? "—"}
				</span>
			</span>
			<span className="mt-0.5 block truncate text-xs text-muted-foreground">{row.message}</span>
		</button>
	);
}
function LogResults({ rows, onOpen }: { readonly rows: readonly TelescopeSearchLogMatch[]; readonly onOpen: (row: TelescopeSearchLogMatch) => void }): React.JSX.Element {
	return (
		<ResultGroup title="Console output" count={rows.length}>
			{rows.map((row) => (
				<SearchLogRow key={row.id} row={row} onOpen={onOpen} />
			))}
		</ResultGroup>
	);
}

function SearchLogRow({ row, onOpen }: { readonly row: TelescopeSearchLogMatch; readonly onOpen: (row: TelescopeSearchLogMatch) => void }): React.JSX.Element {
	const handleClick = useCallback((): void => {
		onOpen(row);
	}, [onOpen, row]);

	return (
		<button type="button" onClick={handleClick} className="block w-full border-b px-4 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-muted/50">
			<span className="flex items-center gap-2">
				<span className="rounded border px-1.5 py-0.5 font-mono text-xs text-muted-foreground uppercase">{row.level}</span>
				<span className="text-xs text-muted-foreground">{row.path ?? "—"}</span>
			</span>
			<span className="mt-0.5 block truncate font-mono text-xs text-foreground/80">{row.message}</span>
		</button>
	);
}

export default function TelescopeSearchPage({
	initialSearchData,
}: {
	readonly initialSearchData?: Envelope<TelescopeSearchResponse>;
}): React.JSX.Element {
	return (
		<Suspense fallback={null}>
			<SearchContent initialSearchData={initialSearchData} />
		</Suspense>
	);
}

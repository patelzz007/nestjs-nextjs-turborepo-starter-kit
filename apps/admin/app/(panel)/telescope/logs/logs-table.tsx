"use client";

// ============================================
// app/(panel)/telescope/logs/page.tsx
// Feature 20 — /telescope/logs. Console output flattened across every captured
// request, with level filters + text search, correlated back to the request it
// ran inside (row click → request detail).
// ============================================

import { useAuth } from "@workspace/client/lib/auth";

import type { ColumnDef } from "@tanstack/react-table";
import { ADMIN_DATA_TABLE_LABELS } from "@/lib/data-table-labels";
import { DataTable, type DataTableFeatures } from "@workspace/ui/components/display/data-table";
import { Input } from "@workspace/ui/components/form/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/form/select";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { TelescopeLogsListQuerySchema, type TelescopeLogRow, type TelescopeLogsListQuery, type TelescopeLogsListResponse, type Envelope } from "@workspace/shared";

import { formatTime } from "@/lib/telescope";

const PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50, 100];

const LEVEL_OPTIONS: readonly { readonly value: string; readonly label: string }[] = [
	{ value: "debug", label: "Debug" },
	{ value: "info", label: "Info" },
	{ value: "warn", label: "Warn" },
	{ value: "error", label: "Error" },
];

const LEVEL_TONE: Readonly<Record<string, string>> = {
	debug: "border-border text-muted-foreground",
	info: "border-sky-300/60 bg-sky-500/10 text-sky-700 dark:border-sky-500/40 dark:text-sky-400",
	warn: "border-amber-300/60 bg-amber-500/10 text-amber-700 dark:border-amber-500/40 dark:text-amber-400",
	error: "border-red-300/60 bg-red-500/10 text-red-700 dark:border-red-500/40 dark:text-red-400",
};

export default function TelescopeLogsPage({ initialEnvelope }: { readonly initialEnvelope: Envelope<{ readonly list: TelescopeLogsListResponse }> }): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();

	const [level, setLevel] = useState<string>("all");
	const [q, setQ] = useState<string>("");
	const [page, setPage] = useState<number>(1);
	const [pageSize, setPageSize] = useState<number>(20);

	const query: TelescopeLogsListQuery = useMemo((): TelescopeLogsListQuery => {
		const draft: Record<string, string | number> = { page, pageSize };
		if (level !== "all") draft.level = level;
		if (q.trim().length > 0) draft.q = q.trim();
		return TelescopeLogsListQuerySchema.parse(draft);
	}, [page, pageSize, level, q]);

	const isDefaultQuery: boolean = page === 1 && pageSize === 20 && level === "all" && q.trim().length === 0;
	const listQuery = api.telescope.logs.useQuery(query, { placeholderData: (previous) => previous, initialData: isDefaultQuery ? initialEnvelope : undefined });
	const rows: readonly TelescopeLogRow[] = useMemo(() => listQuery.data?.data.list.items ?? [], [listQuery.data]);
	const totalCount: number = listQuery.data?.data.list.total ?? 0;

	const handleManualPaginationChange = useCallback((nextPage: number, nextPageSize: number): void => {
		setPage(nextPage);
		setPageSize(nextPageSize);
	}, []);

	const handleLevelChange = useCallback((value: string | null): void => {
		if (value !== null) setLevel(value);
	}, []);

	const handleQChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setQ(event.target.value);
	}, []);

	const handleRowClick = useCallback(
		(row: TelescopeLogRow): void => {
			router.push(`/telescope/requests/${row.requestId}`);
		},
		[router],
	);

	const columns = useMemo<ColumnDef<DataTableFeatures, TelescopeLogRow>[]>(
		() => [
			{
				accessorKey: "level",
				header: "Level",
				cell: ({ row }): React.JSX.Element => (
					<span
						className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium uppercase ${LEVEL_TONE[row.original.level] ?? "border-border text-muted-foreground"}`}>
						{row.original.level}
					</span>
				),
			},
			{
				accessorKey: "message",
				header: "Message",
				cell: ({ row }): React.JSX.Element => <span className="block max-w-xl truncate font-mono text-xs text-foreground">{row.original.message}</span>,
			},
			{
				accessorKey: "method",
				header: "Request",
				cell: ({ row }): React.JSX.Element => (
					<span className="font-mono text-xs text-muted-foreground">
						{row.original.method ?? ""} {row.original.path ?? ""}
					</span>
				),
			},
			{
				accessorKey: "timestamp",
				header: "Time",
				cell: ({ row }): React.JSX.Element => <span className="text-xs text-muted-foreground tabular-nums">{formatTime(row.original.timestamp)}</span>,
			},
		],
		[],
	);

	const levelItems = useMemo(() => [{ value: "all", label: "All levels" }, ...LEVEL_OPTIONS], []);

	return (
		<div className="mx-auto w-full max-w-7xl space-y-6">
			<header>
				<h1 className="text-2xl font-semibold tracking-tight text-foreground">Logs</h1>
				<p className="mt-1 max-w-xl text-sm text-muted-foreground">
					Console output across every captured request, with level filters and request correlation. Click a row to open the request it ran inside.
				</p>
			</header>

			<div className="flex flex-wrap items-end gap-3">
				<div className="flex flex-col gap-1.5">
					<label htmlFor="tel-log-level" className="text-xs font-medium text-muted-foreground">
						Level
					</label>
					<Select value={level} onValueChange={handleLevelChange} items={levelItems}>
						<SelectTrigger id="tel-log-level" className="h-9 w-36 text-sm">
							<SelectValue placeholder="Level" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All levels</SelectItem>
							{LEVEL_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="flex flex-col gap-1.5">
					<label htmlFor="tel-log-q" className="text-xs font-medium text-muted-foreground">
						Search message
					</label>
					<Input id="tel-log-q" type="search" placeholder="e.g. auth failed" value={q} onChange={handleQChange} className="h-9 w-56 text-sm" />
				</div>
			</div>

			<DataTable
				labels={ADMIN_DATA_TABLE_LABELS}
				data={[...rows]}
				columns={columns}
				manual
				totalCount={totalCount}
				pageSize={pageSize}
				pageSizeOptions={PAGE_SIZE_OPTIONS}
				onManualPaginationChange={handleManualPaginationChange}
				onRowClick={handleRowClick}
				exportable
				exportFilename="telescope-logs"
				isLoading={listQuery.isLoading}
				error={listQuery.error !== null ? "Failed to load logs." : null}
			/>
		</div>
	);
}

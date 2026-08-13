"use client";

// ============================================
// app/(panel)/telescope/exceptions/page.tsx
// Exception log — deduped groups with an expandable stack panel. Clicking a
// row pins it as "selected" and shows the full stack trace in an
// ExceptionCard below the table (the detail already lives in the row).
// ============================================

import { useAuth } from "@workspace/client/lib/auth";
import { telescopeEndpoints } from "@workspace/client/lib/api/endpoints";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, type DataTableFeatures } from "@workspace/ui/components/display/data-table";
import { Input } from "@workspace/ui/components/form/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/form/select";
import { useCallback, useMemo, useState } from "react";

import { TelescopeExceptionListQuerySchema, type ExceptionLogEntry, type TelescopeExceptionListQuery } from "@workspace/shared";

import { ExceptionCard } from "@/components/telescope/exception-card";
import { formatTime, statusTone } from "@/lib/telescope";

const PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50, 100];

const STATUS_OPTIONS: readonly { readonly value: string; readonly label: string }[] = [400, 401, 403, 404, 422, 429, 500, 502, 503].map((code) => ({
	value: String(code),
	label: String(code),
}));

export default function TelescopeExceptionsPage(): React.JSX.Element {
	const { api } = useAuth();

	const [status, setStatus] = useState<string>("all");
	const [errorGroup, setErrorGroup] = useState<string>("");
	const [page, setPage] = useState<number>(1);
	const [pageSize, setPageSize] = useState<number>(20);
	const [selected, setSelected] = useState<ExceptionLogEntry | null>(null);

	const query: TelescopeExceptionListQuery = useMemo((): TelescopeExceptionListQuery => {
		const draft: Record<string, string | number> = { page, pageSize };
		if (status !== "all") draft.statusCode = status;
		if (errorGroup !== "") draft.errorGroup = errorGroup;
		return TelescopeExceptionListQuerySchema.parse(draft);
	}, [page, pageSize, status, errorGroup]);

	const listQuery = api.procedure(telescopeEndpoints.exceptions(query)).useQuery({ query }, { placeholderData: (previous) => previous });

	const rows: readonly ExceptionLogEntry[] = useMemo(() => listQuery.data?.data.list.items ?? [], [listQuery.data]);
	const totalCount: number = listQuery.data?.data.list.total ?? 0;

	const handleManualPaginationChange = useCallback((nextPage: number, nextPageSize: number): void => {
		setPage(nextPage);
		setPageSize(nextPageSize);
	}, []);

	const handleRowClick = useCallback((row: ExceptionLogEntry): void => {
		setSelected(row);
	}, []);

	const columns = useMemo<ColumnDef<DataTableFeatures, ExceptionLogEntry>[]>(
		() => [
			{
				accessorKey: "name",
				header: "Error",
				cell: ({ row }): React.JSX.Element => (
					<div className="min-w-0">
						<p className="truncate font-mono text-xs font-medium text-foreground">{row.original.name}</p>
						<p className="truncate text-xs text-muted-foreground">{row.original.message}</p>
					</div>
				),
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
				accessorKey: "occurrences",
				header: "Occurrences",
				cell: ({ row }): React.JSX.Element => <span className="text-xs text-muted-foreground tabular-nums">{row.original.occurrences}</span>,
			},
			{
				accessorKey: "path",
				header: "Path",
				cell: ({ row }): React.JSX.Element => (
					<span className="block max-w-md truncate font-mono text-xs text-muted-foreground">
						{row.original.method} {row.original.path}
					</span>
				),
			},
			{
				accessorKey: "lastSeenAt",
				header: "Last seen",
				cell: ({ row }): React.JSX.Element => (
					<div className="min-w-0">
						<p className="text-xs text-foreground tabular-nums">{formatTime(row.original.lastSeenAt)}</p>
						<p className="text-[11px] text-muted-foreground tabular-nums">first {formatTime(row.original.firstSeenAt)}</p>
					</div>
				),
			},
		],
		[],
	);

	const mobileCardRender = useCallback(
		(item: ExceptionLogEntry): React.ReactNode => (
			<div className="rounded-lg border bg-card p-3">
				<p className="truncate font-mono text-xs font-medium text-foreground">{item.name}</p>
				<p className="mt-0.5 truncate text-xs text-muted-foreground">{item.message}</p>
				<div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
					<span className="truncate font-mono">
						{item.method} {item.path}
					</span>
					<span className="shrink-0 tabular-nums">{formatTime(item.createdAt)}</span>
				</div>
			</div>
		),
		[],
	);

	// Select's `onValueChange` passes `string | null` — narrow before writing.
	const handleStatusChange = useCallback((value: string | null): void => {
		if (value !== null) setStatus(value);
	}, []);
	const handleGroupChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setErrorGroup(event.target.value);
	}, []);

	const filtersKey: string = useMemo(() => JSON.stringify({ status, errorGroup }), [status, errorGroup]);
	const statusItems = useMemo(() => STATUS_OPTIONS, []);

	return (
		<div className="mx-auto w-full max-w-7xl space-y-6">
			<header>
				<h1 className="text-2xl font-semibold tracking-tight text-foreground">Exceptions</h1>
				<p className="mt-1 max-w-xl text-sm text-muted-foreground">Every captured exception, grouped by stack signature. Click a row to inspect its full stack trace below.</p>
			</header>

			<div className="flex flex-wrap items-end gap-3">
				<div className="flex flex-col gap-1.5">
					<label htmlFor="tel-ex-status" className="text-xs font-medium text-muted-foreground">
						Status
					</label>
					<Select value={status} onValueChange={handleStatusChange} items={statusItems}>
						<SelectTrigger id="tel-ex-status" className="h-9 w-32 text-sm">
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
					<label htmlFor="tel-ex-group" className="text-xs font-medium text-muted-foreground">
						Error group
					</label>
					<Input id="tel-ex-group" placeholder="e.g. 3f2a91c4d0e5b7a1" value={errorGroup} onChange={handleGroupChange} className="h-9 w-52 font-mono text-sm" />
				</div>
			</div>

			{selected !== null ? (
				<section className="space-y-2">
					<h2 className="text-sm font-semibold text-foreground">Selected exception</h2>
					<ExceptionCard exception={selected} />
				</section>
			) : null}

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
				exportFilename="telescope-exceptions"
				isLoading={listQuery.isLoading}
				error={listQuery.error !== null ? "Failed to load exceptions." : null}
				mobileCardRender={mobileCardRender}
			/>
		</div>
	);
}

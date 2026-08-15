"use client";

// ============================================
// app/(panel)/telescope/users/page.tsx
// Feature 3 — per-user request aggregation. Groups captured requests by
// `userId` over a range and shows count / error rate / avg / p95 / last seen.
// Row click → the requests table pre-filtered to that user.
// ============================================

import { useAuth } from "@workspace/client/lib/auth";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable, type DataTableFeatures } from "@workspace/ui/components/display/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/form/select";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { TelescopeUsersQuerySchema, type TelescopeUserSummary, type TelescopeUsersQuery } from "@workspace/shared";

import { durationLabel, formatTime } from "@/lib/telescope";

const PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50, 100];

const RANGE_OPTIONS: readonly { readonly value: string; readonly label: string }[] = [
	{ value: "1h", label: "Last hour" },
	{ value: "6h", label: "Last 6 hours" },
	{ value: "24h", label: "Last 24 hours" },
];

const SORT_OPTIONS: readonly { readonly value: string; readonly label: string }[] = [
	{ value: "count", label: "Most requests" },
	{ value: "errors", label: "Most errors" },
	{ value: "duration", label: "Slowest p95" },
];

export default function TelescopeUsersPage(): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();

	const [range, setRange] = useState<string>("24h");
	const [sort, setSort] = useState<string>("count");
	const [page, setPage] = useState<number>(1);
	const [pageSize, setPageSize] = useState<number>(20);

	const query: TelescopeUsersQuery = useMemo((): TelescopeUsersQuery => {
		const draft: Record<string, string | number> = { page, pageSize, range, sort };
		return TelescopeUsersQuerySchema.parse(draft);
	}, [page, pageSize, range, sort]);

	const listQuery = api.telescope.users.useQuery(query, { placeholderData: (previous) => previous });

	const rows: readonly TelescopeUserSummary[] = useMemo(() => listQuery.data?.data.list.items ?? [], [listQuery.data]);
	const totalCount: number = listQuery.data?.data.list.total ?? 0;

	const handleManualPaginationChange = useCallback((nextPage: number, nextPageSize: number): void => {
		setPage(nextPage);
		setPageSize(nextPageSize);
	}, []);

	const handleRangeChange = useCallback((value: string | null): void => {
		if (value !== null) {
			setRange(value);
			setPage(1);
		}
	}, []);

	const handleSortChange = useCallback((value: string | null): void => {
		if (value !== null) {
			setSort(value);
			setPage(1);
		}
	}, []);

	const handleRowClick = useCallback(
		(row: TelescopeUserSummary): void => {
			router.push(`/telescope/requests?userId=${encodeURIComponent(row.userId)}`);
		},
		[router],
	);

	const columns = useMemo<ColumnDef<DataTableFeatures, TelescopeUserSummary>[]>(
		() => [
			{
				accessorKey: "userId",
				header: "User",
				cell: ({ row }): React.JSX.Element => (
					<div className="min-w-0">
						{row.original.email !== null ? (
							// Deep-link to the user's requests — mirrors the search-page
							// email link so the two surfaces behave identically.
							<button
								type="button"
								onClick={(event: React.MouseEvent): void => {
									event.stopPropagation();
									router.push(`/telescope/requests?userId=${encodeURIComponent(row.original.userId)}`);
								}}
								className="block max-w-full truncate text-sm font-medium text-primary underline-offset-4 hover:underline"
								title={`Open ${row.original.email}'s requests`}>
								{row.original.email}
							</button>
						) : null}
						<p
							className={`truncate font-mono ${row.original.email !== null ? "text-[11px] text-muted-foreground" : "text-sm text-muted-foreground"}`}
							title={row.original.userId}>
							{row.original.userId}
						</p>
					</div>
				),
			},
			{
				accessorKey: "count",
				header: "Requests",
				cell: ({ row }): React.JSX.Element => <span className="font-medium">{String(row.original.count)}</span>,
			},
			{
				accessorKey: "errorRatePct",
				header: "Error rate",
				cell: ({ row }): React.JSX.Element => {
					const rate: number = row.original.errorRatePct;
					const tone: string = rate === 0 ? "text-muted-foreground" : rate >= 25 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400";
					return <span className={`font-mono text-xs ${tone}`}>{rate.toFixed(1)}%</span>;
				},
			},
			{
				accessorKey: "avgDurationMs",
				header: "Avg",
				cell: ({ row }): React.JSX.Element => <span className="font-mono text-xs text-muted-foreground">{durationLabel(row.original.avgDurationMs)}</span>,
			},
			{
				accessorKey: "p95DurationMs",
				header: "P95",
				cell: ({ row }): React.JSX.Element => <span className="font-mono text-xs text-muted-foreground">{durationLabel(row.original.p95DurationMs)}</span>,
			},
			{
				accessorKey: "lastSeenAt",
				header: "Last seen",
				cell: ({ row }): React.JSX.Element => <span className="text-xs text-muted-foreground">{formatTime(row.original.lastSeenAt)}</span>,
			},
		],
		[router],
	);

	return (
		<div className="mx-auto w-full max-w-7xl space-y-6">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div className="space-y-1">
					<h1 className="text-2xl font-bold tracking-tight">Users</h1>
					<p className="text-sm text-muted-foreground">
						Request activity grouped by authenticated user. Search by email or user id, or click a row to see that user’s requests.
					</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<Select value={range} onValueChange={handleRangeChange}>
						<SelectTrigger className="w-40">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{RANGE_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select value={sort} onValueChange={handleSortChange}>
						<SelectTrigger className="w-44">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{SORT_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</header>

			<DataTable
				data={[...rows]}
				columns={columns}
				manual
				totalCount={totalCount}
				pageSize={pageSize}
				pageSizeOptions={PAGE_SIZE_OPTIONS}
				onManualPaginationChange={handleManualPaginationChange}
				onRowClick={handleRowClick}
				searchKeys={["email", "userId"]}
				exportable
				exportFilename="telescope-users"
				isLoading={listQuery.isLoading}
				error={listQuery.error !== null ? "Failed to load users." : null}
			/>
		</div>
	);
}

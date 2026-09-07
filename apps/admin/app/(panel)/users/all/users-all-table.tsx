"use client";

import type { AdminUserDetail } from "@workspace/shared";
import { z } from "zod";
import { createDataTableLabels } from "@/lib/data-table-labels";
import { buildReadOnlyTableCheckbox } from "@/lib/data-table-capabilities";
import { DataTableMobileCard } from "@/lib/data-table-mobile-card";
import { readPaginatedNextCursor, readPaginatedTotal, stubPaginatedMeta } from "@/lib/api-envelope";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useManualHybridPagination } from "@/lib/use-manual-cursor-pagination";
import { DataTableSearchToolbar } from "@/components/common/data-table-search-toolbar";
import { useAuth } from "@workspace/client/lib/auth";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { DataTable, type Action, type DataTableFeatures, type Filter } from "@workspace/ui/components/display/data-table";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { keepPreviousData } from "@tanstack/react-query";

export interface UsersAllTableProps {
	readonly initialUsers?: readonly AdminUserDetail[];
	readonly initialTotal?: number;
	readonly initialTotalPages?: number;
	readonly initialHasNext?: boolean;
	readonly heading?: string;
	readonly description?: string;
}

const PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50, 100];

const AdminUserStatusFilterSchema = z.enum(["active", "inactive", "locked"]);

function sortingToApiSort(sorting: SortingState): string | undefined {
	if (sorting.length === 0) {
		return undefined;
	}
	const first = sorting[0];
	if (first === undefined) {
		return undefined;
	}
	return first.desc ? `-${first.id}` : first.id;
}

export default function UsersAllTable({
	initialUsers,
	initialTotal,
	initialTotalPages,
	initialHasNext,
	heading = "Users",
	description = "Manage accounts, roles, and direct permissions.",
}: UsersAllTableProps): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();
	const [search, setSearch] = React.useState("");
	const [statusFilter, setStatusFilter] = React.useState<string>("all");
	const debouncedSearch = useDebouncedValue(search, 300);
	const [sorting, setSorting] = React.useState<SortingState>([]);

	const apiSort = React.useMemo(() => sortingToApiSort(sorting), [sorting]);
	const trimmedSearch = debouncedSearch.trim();
	const parsedStatus = statusFilter === "all" ? undefined : AdminUserStatusFilterSchema.safeParse(statusFilter).data;
	const isFiltered = trimmedSearch.length > 0 || statusFilter !== "all";

	const handleClearFilters = React.useCallback((): void => {
		setSearch("");
		setStatusFilter("all");
	}, []);

	const { pageIndex, pageSize, listQuery, handlePaginationChange, bindListMeta, pagination: basePagination } = useManualHybridPagination<AdminUserDetail>(
		20,
		[debouncedSearch, sorting, statusFilter],
		(user) => user.id,
		{
			onClearFilters: handleClearFilters,
			isFiltered,
		},
	);

	const initialQueryData = React.useMemo(
		() =>
			initialUsers !== undefined
				? {
						success: true as const,
						data: [...initialUsers],
						meta: stubPaginatedMeta(20, initialTotal ?? initialUsers.length, 1, initialTotalPages ?? 1, initialHasNext ?? false),
					}
				: undefined,
		[initialUsers, initialHasNext, initialTotal, initialTotalPages],
	);

	const usersQuery = api.auth.adminUsers.useQuery(
		{
			...listQuery,
			...(trimmedSearch.length > 0 ? { search: trimmedSearch } : {}),
			...(apiSort !== undefined ? { sort: apiSort } : {}),
			...(parsedStatus !== undefined ? { status: parsedStatus } : {}),
		},
		{
			placeholderData: keepPreviousData,
			initialData: pageIndex === 0 && pageSize === 20 && trimmedSearch.length === 0 && sorting.length === 0 && statusFilter === "all" ? initialQueryData : undefined,
		},
	);

	const rows: readonly AdminUserDetail[] = usersQuery.data?.data ?? [];
	const totalCount = readPaginatedTotal(usersQuery.data?.meta, initialTotal ?? initialUsers?.length ?? 0);
	const pagination = React.useMemo(() => ({ ...basePagination, totalCount }), [basePagination, totalCount]);

	React.useEffect((): void => {
		bindListMeta(readPaginatedNextCursor(usersQuery.data?.meta) ?? null);
	}, [bindListMeta, usersQuery.data?.meta]);
	const tableError: string | null = usersQuery.isError ? "Could not load users. Clear search or sort and try again." : null;

	const handleViewUser = React.useCallback(
		(user: AdminUserDetail): void => {
			router.push(`/users/${user.id}`);
		},
		[router],
	);

	const actions = React.useMemo((): Action<AdminUserDetail>[] => {
		return [
			{
				key: "manage",
				label: "Manage access",
				description: "View roles and direct permissions",
				icon: <Eye className="size-4" />,
				onClick: handleViewUser,
			},
		];
	}, [handleViewUser]);

	const mobileCardRender = React.useCallback(
		(user: AdminUserDetail, cardActions?: Action<AdminUserDetail>[]): React.ReactNode => (
			<DataTableMobileCard
				item={user}
				title={user.fullName}
				subtitle={user.email}
				fields={[
					{
						label: "Roles",
						value: user.roles.length > 0 ? user.roles.map((role) => role.name).join(", ") : "—",
					},
					{
						label: "Access",
						value: user.isSuperAdmin ? "Super admin" : user.hasAdminAccess ? "Admin panel" : "Standard",
					},
				]}
				actions={cardActions}
			/>
		),
		[],
	);

	const columns = React.useMemo((): ColumnDef<DataTableFeatures, AdminUserDetail>[] => {
		return [
			{
				accessorKey: "fullName",
				header: "Name",
				cell: ({ row }) => (
					<Link href={`/users/${row.original.id}`} className="font-medium text-primary hover:underline">
						{row.original.fullName}
					</Link>
				),
			},
			{
				accessorKey: "email",
				header: "Email",
				cell: ({ row }) => <span className="text-muted-foreground">{row.original.email}</span>,
			},
			{
				id: "roles",
				header: "Roles",
				enableSorting: false,
				cell: ({ row }) => (
					<div className="flex flex-wrap gap-1">
						{row.original.roles.map((role) => (
							<Badge key={role.id} variant="outline" className="text-xs">
								{role.name}
							</Badge>
						))}
					</div>
				),
			},
			{
				id: "access",
				header: "Access",
				enableSorting: false,
				cell: ({ row }) => (
					<div className="flex flex-wrap gap-1">
						{row.original.isSuperAdmin ? <Badge className="text-xs">Super</Badge> : null}
						{row.original.hasAdminAccess ? (
							<Badge variant="secondary" className="text-xs">
								Admin panel
							</Badge>
						) : null}
					</div>
				),
			},
		];
	}, []);

	const tableLabels = React.useMemo(
		() =>
			createDataTableLabels({
				actionsMenuTitle: "User actions",
				openRowMenu: "Open user row menu",
				searchPlaceholder: "Search name or email…",
			}),
		[],
	);

	const handleManualSortingChange = React.useCallback((nextSorting: SortingState): void => {
		setSorting(nextSorting);
	}, []);

	const handleManualColumnFilterChange = React.useCallback((filterKey: string, value: string | null): void => {
		if (filterKey === "status") {
			setStatusFilter(value === null || value === "all" ? "all" : value);
		}
	}, []);

	const manualColumnFilters = React.useMemo(
		(): Readonly<Record<string, string>> => ({
			status: statusFilter,
		}),
		[statusFilter],
	);

	const tableFilters = React.useMemo(
		(): Filter[] => [
			{
				key: "status",
				label: "Account status",
				options: [
					{ value: "active", label: "Active" },
					{ value: "inactive", label: "Inactive" },
					{ value: "locked", label: "Locked" },
				],
			},
		],
		[],
	);

	const checkbox = React.useMemo(() => buildReadOnlyTableCheckbox("users.csv", ["fullName", "email"]), []);

	const handleSearchChange = React.useCallback((value: string): void => {
		setSearch(value);
	}, []);

	const toolbarContent = React.useMemo(
		() => (
			<DataTableSearchToolbar
				value={search}
				onChange={handleSearchChange}
				placeholder={tableLabels.searchPlaceholder}
				ariaLabel={tableLabels.searchAriaLabel}
			/>
		),
		[handleSearchChange, search, tableLabels.searchAriaLabel, tableLabels.searchPlaceholder],
	);

	return (
		<div className="space-y-6">
			<header>
				<h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
				<p className="text-sm text-muted-foreground">{description}</p>
			</header>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">{rows.length > 0 ? `${String(rows.length)} users on this page` : "User directory"}</CardTitle>
				</CardHeader>
				<CardContent>
					<DataTable
						columns={columns}
						data={[...rows]}
						labels={tableLabels}
						actions={actions}
						checkbox={checkbox}
						enableColumnVisibility
						filters={tableFilters}
						manualColumnFilters={manualColumnFilters}
						onManualColumnFilterChange={handleManualColumnFilterChange}
						mobileCardRender={mobileCardRender}
						pagination={pagination}
						pageSizeOptions={PAGE_SIZE_OPTIONS}
						sorting={sorting}
						error={tableError}
						isLoading={usersQuery.isLoading}
						isRefetching={usersQuery.isFetching && !usersQuery.isLoading ? true : false}
						onManualSortingChange={handleManualSortingChange}
						toolbarContent={toolbarContent}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

"use client";

import type { AdminUserDetail } from "@workspace/shared";
import { createDataTableLabels } from "@/lib/data-table-labels";
import { readPaginatedTotal, stubPaginatedMeta } from "@/lib/api-envelope";
import { useAuth } from "@workspace/client/lib/auth";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { DataTable, type Action, type DataTableFeatures } from "@workspace/ui/components/display/data-table";
import { Input } from "@workspace/ui/components/form/input";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { Eye, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { keepPreviousData } from "@tanstack/react-query";

export interface UsersAllTableProps {
	readonly initialUsers?: readonly AdminUserDetail[];
	readonly initialTotal?: number;
	readonly heading?: string;
	readonly description?: string;
}

const PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50, 100];

function useDebounce<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = React.useState(value);
	React.useEffect((): (() => void) => {
		const handler = setTimeout(() => {
			setDebouncedValue(value);
		}, delay);
		return (): void => {
			clearTimeout(handler);
		};
	}, [value, delay]);
	return debouncedValue;
}

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
	heading = "Users",
	description = "Manage accounts, roles, and direct permissions.",
}: UsersAllTableProps): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();
	const [page, setPage] = React.useState(1);
	const [pageLimit, setPageLimit] = React.useState(20);
	const [search, setSearch] = React.useState("");
	const debouncedSearch = useDebounce(search, 300);
	const [sorting, setSorting] = React.useState<SortingState>([]);

	const prevSearchRef = React.useRef(debouncedSearch);
	const prevSortRef = React.useRef(sorting);
	React.useEffect((): void => {
		const searchChanged = debouncedSearch !== prevSearchRef.current;
		const sortChanged = sorting !== prevSortRef.current;
		if (searchChanged || sortChanged) {
			setPage(1);
		}
		prevSearchRef.current = debouncedSearch;
		prevSortRef.current = sorting;
	}, [debouncedSearch, sorting]);

	const apiSort = React.useMemo(() => sortingToApiSort(sorting), [sorting]);
	const trimmedSearch = debouncedSearch.trim();

	const initialQueryData = React.useMemo(
		() =>
			initialUsers !== undefined
				? {
						success: true as const,
						data: [...initialUsers],
						meta: stubPaginatedMeta(initialTotal ?? initialUsers.length, 1, 20),
					}
				: undefined,
		[initialUsers, initialTotal],
	);

	const usersQuery = api.auth.adminUsers.useQuery(
		{
			page,
			limit: pageLimit,
			...(trimmedSearch.length > 0 ? { search: trimmedSearch } : {}),
			...(apiSort !== undefined ? { sort: apiSort } : {}),
		},
		{
			placeholderData: keepPreviousData,
			initialData: page === 1 && pageLimit === 20 && trimmedSearch.length === 0 && sorting.length === 0 ? initialQueryData : undefined,
		},
	);

	const rows: readonly AdminUserDetail[] = usersQuery.data?.data ?? [];
	const total: number = readPaginatedTotal(usersQuery.data?.meta, initialTotal ?? rows.length);
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

	const handleManualPaginationChange = React.useCallback((nextPage: number, nextPageSize: number): void => {
		setPage(nextPage);
		setPageLimit(nextPageSize);
	}, []);

	const handleManualSortingChange = React.useCallback((nextSorting: SortingState): void => {
		setSorting(nextSorting);
	}, []);

	const handleSearchChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setSearch(event.target.value);
	}, []);

	const toolbarContent = React.useMemo(
		() => (
			<div className="relative w-full sm:max-w-xs">
				<Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
				<Input aria-label={tableLabels.searchAriaLabel} placeholder={tableLabels.searchPlaceholder} value={search} onChange={handleSearchChange} className="h-9 pl-8" />
			</div>
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
					<CardTitle className="text-base">{total.toLocaleString()} users</CardTitle>
				</CardHeader>
				<CardContent>
					<DataTable
						columns={columns}
						data={[...rows]}
						labels={tableLabels}
						actions={actions}
						manual
						totalCount={total}
						pageIndex={page - 1}
						pageSize={pageLimit}
						pageSizeOptions={PAGE_SIZE_OPTIONS}
						sorting={sorting}
						error={tableError}
						isLoading={usersQuery.isLoading}
						isRefetching={usersQuery.isFetching && !usersQuery.isLoading}
						onManualPaginationChange={handleManualPaginationChange}
						onManualSortingChange={handleManualSortingChange}
						toolbarContent={toolbarContent}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

"use client";

import { adminUserListQuery, AdminUserStatusSchema, type AdminUserDetail, type Envelope } from "@workspace/shared";
import { createDataTableLabels } from "@/lib/data-table/labels";
import { buildReadOnlyTableCheckbox } from "@/lib/data-table/capabilities";
import { DataTableMobileCard } from "@/lib/data-table/mobile-card";
import { initialDataOption, readPaginatedNextCursor, readPaginatedTotal } from "@workspace/client/lib/api/envelope";
import { ALL_FILTER_OPTION, parseFilterOption, toListSearch } from "@workspace/client/lib/api/list-query";
import { LIST_FIRST_PAGE } from "@workspace/client/lib/url-state/list-url-state";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import { prefetchedDataFor, type PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { useTableTextDraft } from "@/lib/data-table/use-table-text-draft";
import { useUrlListPaging } from "@/lib/data-table/use-url-list-paging";
import { toUsersListQuery, USERS_PAGE_SIZE_OPTIONS, USERS_TABLE_URL_STATE } from "@/lib/url-state/users";
import { DataTableSearchToolbar } from "@/components/common/data-table-search-toolbar";
import { useAuth } from "@workspace/client/lib/auth";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { DataTable, type Action, type DataTableFeatures, type Filter } from "@workspace/ui/components/display/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { ROUTES } from "@/lib/routes";
import { ADMIN_USER_STATUS_LABELS, enumFilterOptions } from "@/lib/data-table/enum-filter-options";

export interface UsersAllTableProps {
	/** The page the server prefetched for the URL it rendered. */
	readonly initialPage?: PrefetchedQuery<Envelope<AdminUserDetail[]>> | undefined;
	readonly heading?: string;
	readonly description?: string;
}

/**
 * `/users` table. Search, status filter, sort and page live in the URL
 * (lib/url-state/users) — shareable, refresh-safe and back/forward-aware; the
 * only local state is the search box's in-progress draft.
 */
export default function UsersAllTable({
	initialPage,
	heading = "Users",
	description = "Manage accounts, roles, and direct permissions.",
}: UsersAllTableProps): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();
	const [urlState, updateUrlState] = useUrlState(USERS_TABLE_URL_STATE);
	const isFiltered = urlState.search !== undefined || urlState.status !== undefined;

	const commitSearch = React.useCallback(
		(value: string): void => {
			updateUrlState({ search: toListSearch(value), page: LIST_FIRST_PAGE, cursor: undefined }, { history: "replace" });
		},
		[updateUrlState],
	);
	const [searchDraft, setSearchDraft] = useTableTextDraft(urlState.search, commitSearch);

	const handleClearFilters = React.useCallback((): void => {
		updateUrlState({ search: undefined, status: undefined, page: LIST_FIRST_PAGE, cursor: undefined });
	}, [updateUrlState]);

	const stateKey: string = USERS_TABLE_URL_STATE.serialize(urlState);
	const usersQuery = api.auth.adminUsers.useQuery(toUsersListQuery(urlState), {
		placeholderData: keepPreviousData,
		...initialDataOption(prefetchedDataFor(initialPage, stateKey)),
	});

	const rows: readonly AdminUserDetail[] = usersQuery.data?.data ?? [];
	// The server's count of every matching row — not just the rows on this page.
	const matchingTotal: number = readPaginatedTotal(usersQuery.data?.meta);
	const { pagination, sorting, handleSortingChange } = useUrlListPaging({
		state: urlState,
		update: updateUrlState,
		sortSpec: adminUserListQuery,
		totalCount: matchingTotal,
		nextCursor: readPaginatedNextCursor(usersQuery.data?.meta),
		resetKey: USERS_TABLE_URL_STATE.serialize({ ...urlState, page: LIST_FIRST_PAGE, cursor: undefined }),
		getRowId: getUserRowId,
		onClearFilters: handleClearFilters,
		isFiltered,
	});
	const tableError: string | null = usersQuery.isError ? "Could not load users. Clear search or sort and try again." : null;

	const handleViewUser = React.useCallback(
		(user: AdminUserDetail): void => {
			router.push(ROUTES.users.detail(user.id));
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
					<Link href={ROUTES.users.detail(row.original.id)} className="font-medium text-primary hover:underline">
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

	const handleManualColumnFilterChange = React.useCallback(
		(filterKey: string, value: string | null): void => {
			if (filterKey === "status") {
				updateUrlState({ status: parseFilterOption(value ?? "", AdminUserStatusSchema), page: LIST_FIRST_PAGE, cursor: undefined });
			}
		},
		[updateUrlState],
	);

	const manualColumnFilters = React.useMemo((): Readonly<Record<string, string>> => ({ status: urlState.status ?? ALL_FILTER_OPTION }), [urlState.status]);

	const tableFilters = React.useMemo(
		(): Filter[] => [
			{
				key: "status",
				label: "Account status",
				options: enumFilterOptions(AdminUserStatusSchema.options, ADMIN_USER_STATUS_LABELS),
			},
		],
		[],
	);

	const checkbox = React.useMemo(() => buildReadOnlyTableCheckbox("users.csv", ["fullName", "email"]), []);

	const toolbarContent = React.useMemo(
		() => <DataTableSearchToolbar value={searchDraft} onChange={setSearchDraft} placeholder={tableLabels.searchPlaceholder} ariaLabel={tableLabels.searchAriaLabel} />,
		[searchDraft, setSearchDraft, tableLabels.searchAriaLabel, tableLabels.searchPlaceholder],
	);

	return (
		<div className="space-y-6">
			<header>
				<h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
				<p className="text-sm text-muted-foreground">{description}</p>
			</header>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">{matchingTotal > 0 ? `${String(matchingTotal)} users` : "User directory"}</CardTitle>
				</CardHeader>
				<CardContent>
					<DataTable
						columns={columns}
						data={rows}
						labels={tableLabels}
						actions={actions}
						checkbox={checkbox}
						enableColumnVisibility
						filters={tableFilters}
						manualColumnFilters={manualColumnFilters}
						onManualColumnFilterChange={handleManualColumnFilterChange}
						mobileCardRender={mobileCardRender}
						pagination={pagination}
						pageSizeOptions={USERS_PAGE_SIZE_OPTIONS}
						sorting={sorting}
						error={tableError}
						isLoading={usersQuery.isLoading}
						isRefetching={usersQuery.isFetching && !usersQuery.isLoading ? true : false}
						onManualSortingChange={handleSortingChange}
						toolbarContent={toolbarContent}
					/>
				</CardContent>
			</Card>
		</div>
	);
}

function getUserRowId(user: AdminUserDetail): string {
	return user.id;
}

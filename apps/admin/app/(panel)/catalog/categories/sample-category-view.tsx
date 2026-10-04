"use client";

import { createDataTableLabels } from "@/lib/data-table/labels";
import { buildResourceTableCheckbox } from "@/lib/data-table/capabilities";
import { fetchAllListPages, resolveManualBulkSelectionRows } from "@/lib/data-table/resolve-manual-bulk-selection";
import { DisabledActionButton } from "@/components/common/disabled-action-button";
import { useResourceDeleteDialog } from "@/components/common/resource-delete-dialog";
import { DataTableMobileCard } from "@/lib/data-table/mobile-card";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { initialDataOption, readPaginatedHasNext, readPaginatedNextCursor, readPaginatedTotal } from "@workspace/client/lib/api/envelope";
import { prefetchedDataFor, type PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { useTableTextDraft } from "@/lib/data-table/use-table-text-draft";
import { useUrlListPaging } from "@/lib/data-table/use-url-list-paging";
import { CATEGORIES_PAGE_SIZE_OPTIONS, CATEGORIES_TABLE_URL_STATE, toCategoriesListQuery } from "@/lib/url-state/categories";
import { DataTableSearchToolbar } from "@/components/common/data-table-search-toolbar";
import { useAuth } from "@workspace/client/lib/auth";
import { useAuthorization } from "@workspace/client/lib/auth/can";
import { ALL_FILTER_OPTION, parseBooleanFilterOption, toListSearch } from "@workspace/client/lib/api/list-query";
import { LIST_FIRST_PAGE } from "@workspace/client/lib/url-state/list-url-state";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import { PERMISSION, sampleCategoryListQuery, type Envelope, type SampleCategory } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { DataTable, type Action, type DataTableFeatures, type Filter } from "@workspace/ui/components/display/data-table";
import { buttonVariants } from "@workspace/ui/components/form/button";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { toastMessage } from "@workspace/ui/components/feedback/toast";

import type { DataTableBulkSelectionContext } from "@workspace/ui/lib/data-table/checkbox";
import { ROUTES } from "@/lib/routes";
import { formatDateTime } from "@/lib/format/dates";

const labels = createDataTableLabels({
	actionsMenuTitle: "Category actions",
	openRowMenu: "Open category row menu",
	searchPlaceholder: "Search categories...",
	searchAriaLabel: "Search Categories",
});

export interface SampleCategoryViewProps {
	/** The page the server prefetched for the URL it rendered. */
	readonly initialPage?: PrefetchedQuery<Envelope<SampleCategory[]>> | undefined;
}

/** `/catalog/categories` table — search, active filter, sort and page live in the URL (lib/url-state/categories). */
export default function SampleCategoryView({ initialPage }: SampleCategoryViewProps): React.JSX.Element {
	const { api } = useAuth();
	// Each control mirrors its API route: GET /:id (READ), POST (CREATE), PATCH /:id (UPDATE), DELETE /:id + bulk-delete (DELETE).
	const { can } = useAuthorization();
	const canView = can(PERMISSION.SAMPLE_CATEGORY.READ);
	const canCreate = can(PERMISSION.SAMPLE_CATEGORY.CREATE);
	const canUpdate = can(PERMISSION.SAMPLE_CATEGORY.UPDATE);
	const canDelete = can(PERMISSION.SAMPLE_CATEGORY.DELETE);
	const { requestDelete, resourceDeleteDialog } = useResourceDeleteDialog();
	const router = useRouter();
	const queryClient = useQueryClient();
	const [urlState, updateUrlState] = useUrlState(CATEGORIES_TABLE_URL_STATE);
	const isFiltered = urlState.search !== undefined || urlState.isActive !== undefined;

	const commitSearch = useCallback(
		(value: string): void => {
			updateUrlState({ search: toListSearch(value), page: LIST_FIRST_PAGE, cursor: undefined }, { history: "replace" });
		},
		[updateUrlState],
	);
	const [searchDraft, setSearchDraft] = useTableTextDraft(urlState.search, commitSearch);

	const handleClearFilters = useCallback((): void => {
		updateUrlState({ search: undefined, isActive: undefined, page: LIST_FIRST_PAGE, cursor: undefined });
	}, [updateUrlState]);

	const fetchAllMatchingCategories = useCallback(async (): Promise<SampleCategory[]> => {
		const rows = await fetchAllListPages(async (listPage, limit) => {
			const response = await api.sampleCategory.list.fetchOrThrow(toCategoriesListQuery({ ...urlState, page: listPage, limit, cursor: undefined }));
			return {
				items: response.data,
				hasNext: readPaginatedHasNext(response.meta),
			};
		});
		return [...rows];
	}, [api.sampleCategory.list, urlState]);

	const stateKey: string = CATEGORIES_TABLE_URL_STATE.serialize(urlState);
	const resourceListQuery = api.sampleCategory.list.useQuery(toCategoriesListQuery(urlState), {
		placeholderData: keepPreviousData,
		...initialDataOption(prefetchedDataFor(initialPage, stateKey)),
	});
	const rows: SampleCategory[] = resourceListQuery.data?.data ?? [];
	// The server's count of every matching row — not just the rows on this page.
	const matchingTotal: number = readPaginatedTotal(resourceListQuery.data?.meta);
	const { pagination, sorting, handleSortingChange } = useUrlListPaging({
		state: urlState,
		update: updateUrlState,
		sortSpec: sampleCategoryListQuery,
		totalCount: matchingTotal,
		nextCursor: readPaginatedNextCursor(resourceListQuery.data?.meta),
		resetKey: CATEGORIES_TABLE_URL_STATE.serialize({ ...urlState, page: LIST_FIRST_PAGE, cursor: undefined }),
		getRowId: getCategoryRowId,
		onClearFilters: handleClearFilters,
		isFiltered,
		onFetchAllMatching: fetchAllMatchingCategories,
	});
	const tableError: string | null = resourceListQuery.isError ? "Could not load categories. Clear search or filters and try again." : null;

	const handleView = useCallback(
		(item: SampleCategory): void => {
			router.push(ROUTES.catalog.categories.detail(item.id));
		},
		[router],
	);

	const handleEdit = useCallback(
		(item: SampleCategory): void => {
			router.push(ROUTES.catalog.categories.edit(item.id));
		},
		[router],
	);

	const deleteMutation = api.sampleCategory.delete.useMutation({
		onSuccess: async () => {
			toastMessage.success({ title: "Category deleted", description: "The category was removed." });
			await queryClient.invalidateQueries({ queryKey: apiRouter.sampleCategory.list.scopeKey(undefined) });
			await queryClient.invalidateQueries({ queryKey: apiRouter.product.list.scopeKey(undefined) });
		},
		onError: (error) => {
			toastMessage.error({ title: "Delete failed", description: error.message });
		},
	});

	const bulkDeleteMutation = api.sampleCategory.bulkDelete.useMutation({
		onSuccess: async (result) => {
			const deletedCount = result.data.deletedCount;
			toastMessage.success({
				title: `${String(deletedCount)} ${deletedCount === 1 ? "category" : "categories"} deleted`,
				description: "The selected categories were removed.",
			});
			await queryClient.invalidateQueries({ queryKey: apiRouter.sampleCategory.list.scopeKey(undefined) });
			await queryClient.invalidateQueries({ queryKey: apiRouter.product.list.scopeKey(undefined) });
		},
		onError: (error) => {
			toastMessage.error({ title: "Bulk delete failed", description: error.message });
		},
	});

	const handleDelete = useCallback(
		(item: SampleCategory): void => {
			void requestDelete({
				title: `Delete "${item.name}"?`,
				description: "This action soft-deletes the category.",
				onConfirm: async (): Promise<void> => {
					await deleteMutation.mutateAsync({ id: item.id });
				},
			});
		},
		[deleteMutation, requestDelete],
	);

	const handleBulkDelete = useCallback(
		async (selected: SampleCategory[], context: DataTableBulkSelectionContext): Promise<void> => {
			const count = context.selectAllPages ? context.totalMatchingRows : selected.length;
			await requestDelete({
				title: `Delete ${String(count)} ${count === 1 ? "category" : "categories"}?`,
				description: "This action soft-deletes them.",
				count,
				onConfirm: async (): Promise<void> => {
					const rowsToDelete = await resolveManualBulkSelectionRows(selected, context, fetchAllMatchingCategories);
					if (rowsToDelete.length === 1) {
						const onlyRow = rowsToDelete[0];
						if (onlyRow !== undefined) {
							await deleteMutation.mutateAsync({ id: onlyRow.id });
						}
						return;
					}
					await bulkDeleteMutation.mutateAsync({ ids: rowsToDelete.map((row) => row.id) });
				},
			});
		},
		[bulkDeleteMutation, deleteMutation, fetchAllMatchingCategories, requestDelete],
	);

	const actions = useMemo((): Action<SampleCategory>[] => {
		const base: Action<SampleCategory>[] = [];
		if (canView) {
			base.push({
				key: "view",
				label: "View",
				description: "View category details",
				icon: <Eye className="size-4" />,
				onClick: handleView,
			});
		}
		if (canUpdate) {
			base.push({
				key: "edit",
				label: "Edit",
				description: "Edit category",
				icon: <Pencil className="size-4" />,
				onClick: handleEdit,
			});
		}
		if (canDelete) {
			base.push({
				key: "delete",
				label: "Delete",
				description: "Remove this category",
				icon: <Trash2 className="size-4" />,
				onClick: handleDelete,
				isDestructive: true,
				iconBgColor: "bg-destructive-soft",
			});
		}
		return base;
	}, [canDelete, canUpdate, canView, handleDelete, handleEdit, handleView]);

	const checkbox = useMemo(
		() =>
			buildResourceTableCheckbox<SampleCategory>({
				canDelete,
				exportFilename: "sample-category.csv",
				exportableColumns: ["name", "slug", "sortOrder", "isActive", "createdAt"],
				onDeleteAll: handleBulkDelete,
			}),
		[canDelete, handleBulkDelete],
	);

	const mobileCardRender = useCallback(
		(item: SampleCategory, cardActions?: Action<SampleCategory>[]): React.ReactNode => (
			<DataTableMobileCard
				item={item}
				title={item.name}
				subtitle={item.slug}
				badge={item.isActive ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
				fields={[
					{ label: "Sort Order", value: String(item.sortOrder) },
					{ label: "Created At", value: formatDateTime(item.createdAt) },
				]}
				actions={cardActions}
			/>
		),
		[],
	);

	const columns = useMemo<ColumnDef<DataTableFeatures, SampleCategory>[]>(
		() => [
			{
				accessorKey: "name",
				header: "Name",
				enableSorting: true,
				cell: ({ row }): React.JSX.Element => (
					<Link href={ROUTES.catalog.categories.detail(row.original.id)} className="font-medium text-primary hover:underline">
						{row.original.name}
					</Link>
				),
			},
			{
				accessorKey: "slug",
				header: "Slug",
				enableSorting: true,
			},
			{
				accessorKey: "sortOrder",
				header: "Sort Order",
				enableSorting: true,
			},
			{
				accessorKey: "isActive",
				header: "Is Active",
				cell: ({ row }): React.JSX.Element => (row.original.isActive ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>),
			},
			{
				accessorKey: "createdAt",
				header: "Created At",
				enableSorting: true,
				cell: ({ row }): React.JSX.Element => {
					return <span>{formatDateTime(row.original.createdAt)}</span>;
				},
			},
		],
		[],
	);

	const handleManualColumnFilterChange = useCallback(
		(filterKey: string, value: string | null): void => {
			if (filterKey === "isActive") {
				updateUrlState({ isActive: parseBooleanFilterOption(value ?? ""), page: LIST_FIRST_PAGE, cursor: undefined });
			}
		},
		[updateUrlState],
	);

	const manualColumnFilters = useMemo(
		(): Readonly<Record<string, string>> => ({
			isActive: urlState.isActive === undefined ? ALL_FILTER_OPTION : String(urlState.isActive),
		}),
		[urlState.isActive],
	);

	const tableFilters = useMemo(
		(): Filter[] => [
			{
				key: "isActive",
				label: "Is Active",
				options: [
					{ value: "true", label: "Active" },
					{ value: "false", label: "Inactive" },
				],
			},
		],
		[],
	);

	const searchToolbar = useMemo(
		(): React.JSX.Element => (
			<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
				<DataTableSearchToolbar value={searchDraft} onChange={setSearchDraft} placeholder={labels.searchPlaceholder} ariaLabel={labels.searchAriaLabel} />
			</div>
		),
		[searchDraft, setSearchDraft],
	);

	return (
		<div className="space-y-6">
			<header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
					<p className="text-sm text-muted-foreground">Browse and manage categories.</p>
				</div>
				{canCreate ? (
					<Link href={ROUTES.catalog.categories.create} className={buttonVariants()}>
						New category
					</Link>
				) : (
					<DisabledActionButton reason="Creating a category requires the category create permission.">New category</DisabledActionButton>
				)}
			</header>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">{matchingTotal > 0 ? `${String(matchingTotal)} categories` : "Categories"}</CardTitle>
				</CardHeader>
				<CardContent>
					<DataTable
						data={rows}
						columns={columns}
						labels={labels}
						actions={actions}
						checkbox={checkbox}
						enableColumnVisibility
						filters={tableFilters}
						manualColumnFilters={manualColumnFilters}
						onManualColumnFilterChange={handleManualColumnFilterChange}
						mobileCardRender={mobileCardRender}
						{...(canView ? { onRowClick: handleView } : {})}
						pagination={pagination}
						pageSizeOptions={CATEGORIES_PAGE_SIZE_OPTIONS}
						sorting={sorting}
						onManualSortingChange={handleSortingChange}
						isLoading={resourceListQuery.isLoading}
						isRefetching={resourceListQuery.isFetching && !resourceListQuery.isLoading ? true : false}
						error={tableError}
						searchKeys={[]}
						toolbarContent={searchToolbar}
						emptyState={{
							title: isFiltered ? "No matching categories" : "No categories yet",
							description: isFiltered ? "Clear search or filters to see more results." : "Create your first category to get started.",
						}}
					/>
				</CardContent>
			</Card>
			{resourceDeleteDialog}
		</div>
	);
}

function getCategoryRowId(category: SampleCategory): string {
	return category.id;
}

"use client";

import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { buildResourceTableBulk, TABLE_COLUMN_CONTROLS, toTableStatus } from "@/lib/data-table/capabilities";
import { fetchAllListPages, resolveManualBulkSelectionRows } from "@/lib/data-table/resolve-manual-bulk-selection";
import { DisabledActionButton } from "@/components/common/disabled-action-button";
import { useResourceDeleteDialog } from "@/components/common/resource-delete-dialog";
import { DataTableMobileCard } from "@/lib/data-table/mobile-card";
import { apiRouter } from "@workspace/client/lib/api/endpoints";
import { initialDataOption, readPaginatedHasNext, readPaginatedNextCursor, readPaginatedTotal } from "@workspace/client/lib/api/envelope";
import { prefetchedDataFor, type PrefetchedQuery } from "@workspace/client/lib/url-state/prefetched-query";
import { useTableTextDraft } from "@/lib/data-table/use-table-text-draft";
import { useUrlListPaging } from "@/lib/data-table/use-url-list-paging";
import { CATEGORIES_PAGE_SIZE_OPTIONS, CATEGORIES_TABLE_URL_STATE, toCategoriesListQuery } from "@/contexts/catalog/url-state/categories";
import { DataTableSearchToolbar } from "@/components/common/data-table-search-toolbar";
import { useAuth } from "@workspace/client/lib/contexts/identity";
import { useAbility } from "@workspace/client/lib/contexts/authorization";
import { ALL_FILTER_OPTION, parseBooleanFilterOption, toListSearch } from "@workspace/client/lib/api/list-query";
import { LIST_FIRST_PAGE } from "@workspace/client/lib/url-state/list-url-state";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import { LIST_SLOT_INDEX, sampleCategoryListQuery, type Envelope, type SampleCategory } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import {
	DataTable,
	type DataTableBulkSelectionContext,
	type DataTableEmptyState,
	type DataTableFeatures,
	type DataTableFilter,
	type DataTablePaging,
	type DataTableRowAction,
	type DataTableToolbar,
} from "@workspace/ui/components/data-table";
import { buttonVariants } from "@workspace/ui/components/button";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useProgressRouter } from "@workspace/client/lib/navigation/use-progress-router";
import { useCallback, useMemo } from "react";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { toastMessage } from "@workspace/ui/components/toast";

import { ROUTES } from "@/lib/routes";
import { formatDateTime } from "@/lib/format/dates";

const CATEGORY_SEARCH_PLACEHOLDER = "Search categories...";
const CATEGORY_SEARCH_ARIA_LABEL = "Search Categories";

/** Only the strings that differ from the kit pack's `dataTable` copy. */
const CATEGORY_TABLE_LABELS: UiKitLabelsOverride<"dataTable"> = {
	actionsMenuTitle: "Category actions",
	openRowMenu: "Open category row menu",
	searchPlaceholder: CATEGORY_SEARCH_PLACEHOLDER,
	searchAriaLabel: CATEGORY_SEARCH_ARIA_LABEL,
};

export interface SampleCategoryViewProps {
	/** The page the server prefetched for the URL it rendered. */
	readonly initialPage?: PrefetchedQuery<Envelope<SampleCategory[]>> | undefined;
}

/** `/catalog/categories` table — search, active filter, sort and page live in the URL (lib/url-state/categories). */
export default function SampleCategoryView({ initialPage }: SampleCategoryViewProps): React.JSX.Element {
	const { api } = useAuth();
	// Each control mirrors its API route: GET /:id (READ), POST (CREATE), PATCH /:id (UPDATE), DELETE /:id + bulk-delete (DELETE).
	const ability = useAbility();
	const canView = ability.can("READ", "SAMPLE_CATEGORY");
	const canCreate = ability.can("CREATE", "SAMPLE_CATEGORY");
	const canUpdate = ability.can("UPDATE", "SAMPLE_CATEGORY");
	const canDelete = ability.can("DELETE", "SAMPLE_CATEGORY");
	const { requestDelete, resourceDeleteDialog } = useResourceDeleteDialog();
	const router = useProgressRouter();
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
			const count = context.scope === "all-matching" ? context.totalMatchingRows : selected.length;
			await requestDelete({
				title: `Delete ${String(count)} ${count === 1 ? "category" : "categories"}?`,
				description: "This action soft-deletes them.",
				count,
				onConfirm: async (): Promise<void> => {
					const rowsToDelete = await resolveManualBulkSelectionRows(selected, context, fetchAllMatchingCategories);
					if (rowsToDelete.length === 1) {
						const onlyRow = rowsToDelete[LIST_SLOT_INDEX.first];
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

	const actions = useMemo((): DataTableRowAction<SampleCategory>[] => {
		const base: DataTableRowAction<SampleCategory>[] = [];
		if (canView) {
			base.push({
				key: "view",
				label: "View",
				description: "View category details",
				icon: <Eye className="size-4" />,
				onSelect: handleView,
			});
		}
		if (canUpdate) {
			base.push({
				key: "edit",
				label: "Edit",
				description: "Edit category",
				icon: <Pencil className="size-4" />,
				onSelect: handleEdit,
			});
		}
		if (canDelete) {
			base.push({
				key: "delete",
				label: "Delete",
				description: "Remove this category",
				icon: <Trash2 className="size-4" />,
				onSelect: handleDelete,
				tone: "destructive",
			});
		}
		return base;
	}, [canDelete, canUpdate, canView, handleDelete, handleEdit, handleView]);

	const bulk = useMemo(
		() =>
			buildResourceTableBulk<SampleCategory>({
				canDelete,
				exportFilename: "sample-category.csv",
				exportKeys: ["name", "slug", "sortOrder", "isActive", "createdAt"],
				onDelete: handleBulkDelete,
			}),
		[canDelete, handleBulkDelete],
	);

	const mobileCardRender = useCallback(
		(item: SampleCategory, cardActions: readonly DataTableRowAction<SampleCategory>[]): React.ReactNode => (
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
	const { source, getRowId } = useUrlListPaging({
		state: urlState,
		update: updateUrlState,
		sortSpec: sampleCategoryListQuery,
		totalCount: matchingTotal,
		nextCursor: readPaginatedNextCursor(resourceListQuery.data?.meta),
		getRowId: getCategoryRowId,
		filters: manualColumnFilters,
		onFilterChange: handleManualColumnFilterChange,
		isFiltered,
		onClearFilters: handleClearFilters,
		onFetchAllMatching: fetchAllMatchingCategories,
	});

	const tableFilters = useMemo(
		(): DataTableFilter[] => [
			{
				kind: "select",
				column: "isActive",
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
				<DataTableSearchToolbar value={searchDraft} onChange={setSearchDraft} placeholder={CATEGORY_SEARCH_PLACEHOLDER} ariaLabel={CATEGORY_SEARCH_ARIA_LABEL} />
			</div>
		),
		[searchDraft, setSearchDraft],
	);
	const toolbar = useMemo((): DataTableToolbar => ({ extra: searchToolbar }), [searchToolbar]);

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
						getRowId={getRowId}
						source={source}
						labels={CATEGORY_TABLE_LABELS}
						rowActions={actions}
						selection={bulk.selection}
						exporting={bulk.exporting}
						columnControls={TABLE_COLUMN_CONTROLS}
						filters={tableFilters}
						mobileCard={mobileCardRender}
						onRowClick={canView ? handleView : undefined}
						paging={CATEGORIES_PAGING}
						status={toTableStatus(resourceListQuery, tableError)}
						toolbar={toolbar}
						emptyState={CATEGORIES_EMPTY}
					/>
				</CardContent>
			</Card>
			{resourceDeleteDialog}
		</div>
	);
}

const CATEGORIES_PAGING: DataTablePaging = { pageSizeOptions: CATEGORIES_PAGE_SIZE_OPTIONS };
/** Shown when there are no categories at all; a search or a filter that matches nothing has the table's own "no results" state. */
const CATEGORIES_EMPTY: DataTableEmptyState = { title: "No categories yet", description: "Create your first category to get started." };

function getCategoryRowId(category: SampleCategory): string {
	return category.id;
}

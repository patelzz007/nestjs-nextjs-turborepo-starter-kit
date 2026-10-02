"use client";

import { createDataTableLabels } from "@/lib/data-table/labels";
import { buildResourceTableCheckbox } from "@/lib/data-table/capabilities";
import { fetchAllListPages, resolveManualBulkSelectionRows } from "@/lib/data-table/resolve-manual-bulk-selection";
import { DisabledActionButton } from "@/components/common/disabled-action-button";
import { useResourceDeleteDialog } from "@/components/common/resource-delete-dialog";
import { DataTableMobileCard } from "@/lib/data-table/mobile-card";
import { initialDataOption, readPaginatedHasNext, readPaginatedNextCursor, readPaginatedTotal, stubPaginatedMeta, successEnvelope } from "@workspace/client/lib/api/envelope";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useManualHybridPagination } from "@/lib/data-table/use-manual-cursor-pagination";
import { DataTableSearchToolbar } from "@/components/common/data-table-search-toolbar";
import { useAuth } from "@workspace/client/lib/auth";
import { useAuthorization } from "@workspace/client/lib/auth/can";
import { eqFilter, parseBooleanFilterOption, tableStateToListQuery } from "@workspace/client/lib/api/list-query";
import { PERMISSION, sampleCategoryListQuery, type SampleCategory } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { DataTable, type Action, type DataTableFeatures, type Filter } from "@workspace/ui/components/display/data-table";
import { buttonVariants } from "@workspace/ui/components/form/button";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { Eye, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { toastMessage } from "@workspace/ui/components/feedback/toast";

import type { DataTableBulkSelectionContext } from "@workspace/ui/lib/data-table/checkbox";
import { ROUTES } from "@/lib/routes";

const PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50, 100];

const labels = createDataTableLabels({
	actionsMenuTitle: "SampleCategory actions",
	openRowMenu: "Open samplecategory row menu",
	searchPlaceholder: "Search categories...",
	searchAriaLabel: "Search Categories",
});

export interface SampleCategoryViewProps {
	readonly initialRows?: readonly SampleCategory[] | undefined;
	readonly initialTotal?: number | undefined;
	readonly initialTotalPages?: number | undefined;
	readonly initialHasNext?: boolean | undefined;
}

export default function SampleCategoryView({ initialRows, initialTotal, initialTotalPages, initialHasNext }: SampleCategoryViewProps): React.JSX.Element {
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
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search, 300);
	const [sorting, setSorting] = useState<SortingState>([]);
	const [isActiveFilter, setIsActiveFilter] = useState<string>("all");
	const trimmedSearch = debouncedSearch.trim();
	const parsedIsActive = parseBooleanFilterOption(isActiveFilter);
	const isFiltered = trimmedSearch.length > 0 || isActiveFilter !== "all";

	const handleClearFilters = useCallback((): void => {
		setSearch("");
		setIsActiveFilter("all");
	}, []);

	const listFilter = useMemo(() => ({ isActive: eqFilter(parsedIsActive) }), [parsedIsActive]);

	const buildListQuery = useCallback(
		(listPage: number, limit: number) =>
			tableStateToListQuery(sampleCategoryListQuery, { pagination: { page: listPage, limit }, sorting, search: trimmedSearch, filter: listFilter }),
		[sorting, trimmedSearch, listFilter],
	);

	const fetchAllMatchingSampleCategorys = useCallback(async (): Promise<SampleCategory[]> => {
		const rows = await fetchAllListPages(async (listPage, limit) => {
			const response = await api.sampleCategory.list.fetchOrThrow(buildListQuery(listPage, limit));
			return {
				items: response.data,
				hasNext: readPaginatedHasNext(response.meta),
			};
		});
		return [...rows];
	}, [api.sampleCategory.list, buildListQuery]);

	const {
		pageIndex,
		pageSize,
		listQuery: paginationQuery,
		bindListMeta,
		pagination: basePagination,
	} = useManualHybridPagination<SampleCategory>(20, [debouncedSearch, sorting, isActiveFilter], (item) => item.id, {
		onClearFilters: handleClearFilters,
		isFiltered,
		onFetchAllMatching: fetchAllMatchingSampleCategorys,
	});
	const initialQueryData = useMemo(
		() =>
			initialRows !== undefined
				? successEnvelope([...initialRows], stubPaginatedMeta(20, initialTotal ?? initialRows.length, 1, initialTotalPages ?? 1, initialHasNext ?? false))
				: undefined,
		[initialRows, initialHasNext, initialTotal, initialTotalPages],
	);
	const resourceListQuery = api.sampleCategory.list.useQuery(
		tableStateToListQuery(sampleCategoryListQuery, { pagination: paginationQuery, sorting, search: trimmedSearch, filter: listFilter }),
		{
			placeholderData: keepPreviousData,
			...initialDataOption(
				pageIndex === 0 && pageSize === 20 && trimmedSearch.length === 0 && sorting.length === 0 && isActiveFilter === "all" ? initialQueryData : undefined,
			),
		},
	);
	const rows: SampleCategory[] = resourceListQuery.data?.data ?? [];
	const totalCount = readPaginatedTotal(resourceListQuery.data?.meta, initialTotal ?? initialRows?.length ?? 0);
	const pagination = useMemo(() => ({ ...basePagination, totalCount }), [basePagination, totalCount]);
	const tableError: string | null = resourceListQuery.isError ? "Could not load categories. Clear search or filters and try again." : null;

	useEffect((): void => {
		bindListMeta(readPaginatedNextCursor(resourceListQuery.data?.meta) ?? null);
	}, [bindListMeta, resourceListQuery.data?.meta]);

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
			toastMessage.success({ title: "SampleCategory deleted", description: "The samplecategory was removed." });
			await queryClient.invalidateQueries({ queryKey: ["sample-category", "list"] });
			await queryClient.invalidateQueries({ queryKey: ["product", "list"] });
		},
		onError: (error) => {
			toastMessage.error({ title: "Delete failed", description: error.message });
		},
	});

	const bulkDeleteMutation = api.sampleCategory.bulkDelete.useMutation({
		onSuccess: async (result) => {
			const deletedCount = result.data.deletedCount;
			toastMessage.success({
				title: `${String(deletedCount)} samplecategory${deletedCount === 1 ? "" : "s"} deleted`,
				description: "The selected samplecategories were removed.",
			});
			await queryClient.invalidateQueries({ queryKey: ["sample-category", "list"] });
			await queryClient.invalidateQueries({ queryKey: ["product", "list"] });
		},
		onError: (error) => {
			toastMessage.error({ title: "Bulk delete failed", description: error.message });
		},
	});

	const handleDelete = useCallback(
		(item: SampleCategory): void => {
			void requestDelete({
				title: `Delete "${item.name}"?`,
				description: "This action soft-deletes the samplecategory.",
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
				title: `Delete ${String(count)} samplecategory${count === 1 ? "" : "s"}?`,
				description: "This action soft-deletes them.",
				count,
				onConfirm: async (): Promise<void> => {
					const rowsToDelete = await resolveManualBulkSelectionRows(selected, context, fetchAllMatchingSampleCategorys);
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
		[bulkDeleteMutation, deleteMutation, fetchAllMatchingSampleCategorys, requestDelete],
	);

	const actions = useMemo((): Action<SampleCategory>[] => {
		const base: Action<SampleCategory>[] = [];
		if (canView) {
			base.push({
				key: "view",
				label: "View",
				description: "View samplecategory details",
				icon: <Eye className="size-4" />,
				onClick: handleView,
			});
		}
		if (canUpdate) {
			base.push({
				key: "edit",
				label: "Edit",
				description: "Edit samplecategory",
				icon: <Pencil className="size-4" />,
				onClick: handleEdit,
			});
		}
		if (canDelete) {
			base.push({
				key: "delete",
				label: "Delete",
				description: "Remove this samplecategory",
				icon: <Trash2 className="size-4" />,
				onClick: handleDelete,
				isDestructive: true,
				iconBgColor: "bg-red-100 dark:bg-red-900/40",
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
					{ label: "Created At", value: Number.isFinite(item.createdAt) ? new Date(item.createdAt).toLocaleString() : "—" },
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
					const value = row.original.createdAt;
					return <span>{Number.isFinite(value) ? new Date(value).toLocaleString() : "—"}</span>;
				},
			},
		],
		[],
	);

	const handleManualSortingChange = useCallback((nextSorting: SortingState): void => {
		setSorting(nextSorting);
	}, []);

	const handleSearchChange = useCallback((value: string): void => {
		setSearch(value);
	}, []);

	const handleManualColumnFilterChange = useCallback((filterKey: string, value: string | null): void => {
		if (filterKey === "isActive") {
			setIsActiveFilter(value === null || value === "all" ? "all" : value);
		}
	}, []);

	const manualColumnFilters = useMemo(
		(): Readonly<Record<string, string>> => ({
			isActive: isActiveFilter,
		}),
		[isActiveFilter],
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
				<DataTableSearchToolbar value={search} onChange={handleSearchChange} placeholder={labels.searchPlaceholder} ariaLabel={labels.searchAriaLabel} />
			</div>
		),
		[handleSearchChange, search],
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
						New SampleCategory
					</Link>
				) : (
					<DisabledActionButton reason="Creating a category requires the category create permission.">New SampleCategory</DisabledActionButton>
				)}
			</header>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">{rows.length > 0 ? `${String(rows.length)} categories on this page` : "Categories"}</CardTitle>
				</CardHeader>
				<CardContent>
					<DataTable
						data={[...rows]}
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
						pageSizeOptions={PAGE_SIZE_OPTIONS}
						sorting={sorting}
						onManualSortingChange={handleManualSortingChange}
						isLoading={resourceListQuery.isLoading}
						isRefetching={resourceListQuery.isFetching && !resourceListQuery.isLoading ? true : false}
						error={tableError}
						searchKeys={[]}
						toolbarContent={searchToolbar}
						emptyState={{
							title: isFiltered ? "No matching categories" : "No categories yet",
							description: isFiltered ? "Clear search or filters to see more results." : "Create your first samplecategory to get started.",
						}}
					/>
				</CardContent>
			</Card>
			{resourceDeleteDialog}
		</div>
	);
}

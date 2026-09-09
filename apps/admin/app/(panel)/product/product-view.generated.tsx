"use client";
import { z } from "zod";

import { createDataTableLabels } from "@/lib/data-table-labels";
import { buildResourceTableCheckbox, canDeletePlatformResource } from "@/lib/data-table-capabilities";
import { fetchAllListPages, resolveManualBulkSelectionRows } from "@/lib/resolve-manual-bulk-selection";
import { useSessionCapabilities } from "@/lib/session-capabilities";
import { useResourceDeleteDialog } from "@/components/common/resource-delete-dialog";
import { DataTableMobileCard } from "@/lib/data-table-mobile-card";
import { readPaginatedHasNext, readPaginatedNextCursor, readPaginatedTotal, stubPaginatedMeta } from "@/lib/api-envelope";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useManualHybridPagination } from "@/lib/use-manual-cursor-pagination";
import { DataTableSearchToolbar } from "@/components/common/data-table-search-toolbar";
import { useAuth } from "@workspace/client/lib/auth";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { DataTable, type Action, type DataTableFeatures, type Filter } from "@workspace/ui/components/display/data-table";
import { Button } from "@workspace/ui/components/form/button";
import { Input } from "@workspace/ui/components/form/input";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { Eye, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { toastMessage } from "@workspace/ui/components/feedback/toast";

import { ProductListSortBySchema, type Product, type ProductListSortBy } from "@workspace/shared/schemas/domain/product.generated";
import type { DataTableBulkSelectionContext } from "@workspace/ui/lib/data-table-checkbox";

function resolveListSortBy(columnId: string | undefined): ProductListSortBy | undefined {
	if (columnId === undefined) {
		return undefined;
	}
	const parsed = ProductListSortBySchema.safeParse(columnId);
	if (!parsed.success) {
		return undefined;
	}
	return parsed.data;
}

const BooleanColumnFilterSchema = z.enum(["true", "false"]);

const PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50, 100];

const labels = createDataTableLabels({
	actionsMenuTitle: "Product actions",
	openRowMenu: "Open product row menu",
	searchPlaceholder: "Search products...",
	searchAriaLabel: "Search Products",
});

export interface ProductViewProps {
	readonly initialRows?: readonly Product[];
	readonly initialTotal?: number;
	readonly initialTotalPages?: number;
	readonly initialHasNext?: boolean;
}

export default function ProductView({ initialRows, initialTotal, initialTotalPages, initialHasNext }: ProductViewProps): React.JSX.Element {
	const { api } = useAuth();
	const { hasCapability } = useSessionCapabilities();
	const canDelete = canDeletePlatformResource(hasCapability, "PRODUCT");
	const { requestDelete, resourceDeleteDialog } = useResourceDeleteDialog();
	const router = useRouter();
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search, 300);
	const [sorting, setSorting] = useState<SortingState>([]);
	const [isActiveFilter, setIsActiveFilter] = useState<string>("all");
	const [isFeaturedFilter, setIsFeaturedFilter] = useState<string>("all");
	const [categoryIdFilter, setCategoryIdFilter] = useState("");
	const [brandFilter, setBrandFilter] = useState("");
	const sort = sorting[0];
	const sortBy = resolveListSortBy(sort?.id);
	const trimmedSearch = debouncedSearch.trim();
	const parsedIsActive = isActiveFilter === "all" ? undefined : BooleanColumnFilterSchema.safeParse(isActiveFilter).success ? isActiveFilter === "true" : undefined;
	const parsedIsFeatured = isFeaturedFilter === "all" ? undefined : BooleanColumnFilterSchema.safeParse(isFeaturedFilter).success ? isFeaturedFilter === "true" : undefined;
	const debouncedCategoryIdFilter = useDebouncedValue(categoryIdFilter, 300);
	const parsedCategoryId = debouncedCategoryIdFilter.trim().length === 0 ? undefined : z.uuid().safeParse(debouncedCategoryIdFilter.trim()).data;
	const debouncedBrandFilter = useDebouncedValue(brandFilter, 300);
	const parsedBrand = debouncedBrandFilter.trim().length === 0 ? undefined : debouncedBrandFilter.trim();
	const isFiltered = trimmedSearch.length > 0 || isActiveFilter !== "all" || isFeaturedFilter !== "all" || categoryIdFilter.trim().length > 0 || brandFilter.trim().length > 0;

	const handleClearFilters = useCallback((): void => {
		setSearch("");
		setIsActiveFilter("all");
		setIsFeaturedFilter("all");
		setCategoryIdFilter("");
		setBrandFilter("");
	}, []);

	const buildListQuery = useCallback(
		(listPage: number, limit: number) => {
			const sortDirection: "asc" | "desc" = sort?.desc === true ? "desc" : "asc";
			return {
				page: listPage,
				limit,
				...(sortBy !== undefined ? { sortBy, sortDirection } : {}),
				...(trimmedSearch.length > 0 ? { search: trimmedSearch } : {}),
				...(parsedIsActive !== undefined ? { isActive: parsedIsActive } : {}),
				...(parsedIsFeatured !== undefined ? { isFeatured: parsedIsFeatured } : {}),
				...(parsedCategoryId !== undefined ? { categoryId: parsedCategoryId } : {}),
				...(parsedBrand !== undefined ? { brand: parsedBrand } : {}),
			};
		},
		[sortBy, sort?.desc, trimmedSearch, parsedIsActive, parsedIsFeatured, parsedCategoryId, parsedBrand],
	);

	const fetchAllMatchingProducts = useCallback(async (): Promise<Product[]> => {
		const rows = await fetchAllListPages(async (listPage, limit) => {
			const response = await api.product.list.fetchOrThrow(buildListQuery(listPage, limit));
			return {
				items: response.data,
				hasNext: readPaginatedHasNext(response.meta),
			};
		});
		return [...rows];
	}, [api.product.list, buildListQuery]);

	const {
		pageIndex,
		pageSize,
		listQuery: paginationQuery,
		bindListMeta,
		pagination: basePagination,
	} = useManualHybridPagination<Product>(20, [debouncedSearch, sorting, isActiveFilter, isFeaturedFilter, categoryIdFilter, brandFilter], (item) => item.id, {
		onClearFilters: handleClearFilters,
		isFiltered,
		onFetchAllMatching: fetchAllMatchingProducts,
	});
	const initialQueryData = useMemo(
		() =>
			initialRows !== undefined
				? {
						success: true as const,
						data: [...initialRows],
						meta: stubPaginatedMeta(20, initialTotal ?? initialRows.length, 1, initialTotalPages ?? 1, initialHasNext ?? false),
					}
				: undefined,
		[initialRows, initialHasNext, initialTotal, initialTotalPages],
	);
	const resourceListQuery = api.product.list.useQuery(
		{
			...paginationQuery,
			...(sortBy !== undefined ? { sortBy, sortDirection: sort?.desc === true ? "desc" : "asc" } : {}),
			...(trimmedSearch.length > 0 ? { search: trimmedSearch } : {}),
			...(parsedIsActive !== undefined ? { isActive: parsedIsActive } : {}),
			...(parsedIsFeatured !== undefined ? { isFeatured: parsedIsFeatured } : {}),
			...(parsedCategoryId !== undefined ? { categoryId: parsedCategoryId } : {}),
			...(parsedBrand !== undefined ? { brand: parsedBrand } : {}),
		},
		{
			placeholderData: keepPreviousData,
			initialData:
				pageIndex === 0 &&
				pageSize === 20 &&
				trimmedSearch.length === 0 &&
				sorting.length === 0 &&
				isActiveFilter === "all" &&
				isFeaturedFilter === "all" &&
				categoryIdFilter.trim().length === 0 &&
				brandFilter.trim().length === 0
					? initialQueryData
					: undefined,
		},
	);
	const rows: Product[] = resourceListQuery.data?.data ?? [];
	const totalCount = readPaginatedTotal(resourceListQuery.data?.meta, initialTotal ?? initialRows?.length ?? 0);
	const pagination = useMemo(() => ({ ...basePagination, totalCount }), [basePagination, totalCount]);
	const tableError: string | null = resourceListQuery.isError ? "Could not load products. Clear search or filters and try again." : null;

	useEffect((): void => {
		bindListMeta(readPaginatedNextCursor(resourceListQuery.data?.meta) ?? null);
	}, [bindListMeta, resourceListQuery.data?.meta]);

	const handleView = useCallback(
		(item: Product): void => {
			router.push(`/product/${item.id}`);
		},
		[router],
	);

	const handleEdit = useCallback(
		(item: Product): void => {
			router.push(`/product/${item.id}/edit`);
		},
		[router],
	);

	const deleteMutation = api.product.delete.useMutation({
		onSuccess: async () => {
			toastMessage.success({ title: "Product deleted", description: "The product was removed." });
			await queryClient.invalidateQueries({ queryKey: ["product", "list"] });
		},
		onError: (error) => {
			toastMessage.error({ title: "Delete failed", description: error.message });
		},
	});

	const bulkDeleteMutation = api.product.bulkDelete.useMutation({
		onSuccess: async (result) => {
			const deletedCount = result.data.deletedCount;
			toastMessage.success({
				title: `${String(deletedCount)} product${deletedCount === 1 ? "" : "s"} deleted`,
				description: "The selected products were removed.",
			});
			await queryClient.invalidateQueries({ queryKey: ["product", "list"] });
		},
		onError: (error) => {
			toastMessage.error({ title: "Bulk delete failed", description: error.message });
		},
	});

	const handleDelete = useCallback(
		(item: Product): void => {
			void requestDelete({
				title: `Delete "${item.name}"?`,
				description: "This action soft-deletes the product.",
				onConfirm: async (): Promise<void> => {
					await deleteMutation.mutateAsync({ id: item.id });
				},
			});
		},
		[deleteMutation, requestDelete],
	);

	const handleBulkDelete = useCallback(
		async (selected: Product[], context: DataTableBulkSelectionContext): Promise<void> => {
			const count = context.selectAllPages ? context.totalMatchingRows : selected.length;
			await requestDelete({
				title: `Delete ${String(count)} product${count === 1 ? "" : "s"}?`,
				description: "This action soft-deletes them.",
				count,
				onConfirm: async (): Promise<void> => {
					const rowsToDelete = await resolveManualBulkSelectionRows(selected, context, fetchAllMatchingProducts);
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
		[bulkDeleteMutation, deleteMutation, fetchAllMatchingProducts, requestDelete],
	);

	const actions = useMemo((): Action<Product>[] => {
		const base: Action<Product>[] = [
			{
				key: "view",
				label: "View",
				description: "View product details",
				icon: <Eye className="size-4" />,
				onClick: handleView,
			},
			{
				key: "edit",
				label: "Edit",
				description: "Edit product",
				icon: <Pencil className="size-4" />,
				onClick: handleEdit,
			},
		];
		if (canDelete) {
			base.push({
				key: "delete",
				label: "Delete",
				description: "Remove this product",
				icon: <Trash2 className="size-4" />,
				onClick: handleDelete,
				isDestructive: true,
				iconBgColor: "bg-red-100 dark:bg-red-900/40",
			});
		}
		return base;
	}, [canDelete, handleDelete, handleEdit, handleView]);

	const checkbox = useMemo(
		() =>
			buildResourceTableCheckbox<Product>({
				hasCapability,
				resource: "PRODUCT",
				exportFilename: "product.csv",
				exportableColumns: ["sku", "name", "price", "stockQuantity", "categoryId", "isActive", "isFeatured", "createdAt"],
				onDeleteAll: handleBulkDelete,
			}),
		[handleBulkDelete, hasCapability],
	);

	const mobileCardRender = useCallback(
		(item: Product, cardActions?: Action<Product>[]): React.ReactNode => (
			<DataTableMobileCard
				item={item}
				title={item.sku}
				subtitle={item.name}
				badge={item.isActive ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
				fields={[
					{ label: "Price", value: Number.isFinite(item.price) ? item.price.toFixed(2) : "—" },
					{ label: "Stock Quantity", value: String(item.stockQuantity) },
					{ label: "Category Id", value: item.categoryId },
					{ label: "Is Featured", value: item.isFeatured ? "Yes" : "No" },
					{ label: "Created At", value: Number.isFinite(item.createdAt) ? new Date(item.createdAt).toLocaleString() : "—" },
				]}
				actions={cardActions}
			/>
		),
		[],
	);

	const columns = useMemo<ColumnDef<DataTableFeatures, Product>[]>(
		() => [
			{
				accessorKey: "sku",
				header: "Sku",
				enableSorting: true,
			},
			{
				accessorKey: "name",
				header: "Name",
				enableSorting: true,
				cell: ({ row }): React.JSX.Element => (
					<Link href={`/product/${row.original.id}`} className="font-medium text-primary hover:underline">
						{row.original.name}
					</Link>
				),
			},
			{
				accessorKey: "price",
				header: "Price",
				enableSorting: true,
				cell: ({ row }): React.JSX.Element => {
					const value = row.original.price;
					return <span>{Number.isFinite(value) ? value.toFixed(2) : "—"}</span>;
				},
			},
			{
				accessorKey: "stockQuantity",
				header: "Stock Quantity",
				enableSorting: true,
			},
			{
				accessorKey: "categoryId",
				header: "Category Id",
			},
			{
				accessorKey: "isActive",
				header: "Is Active",
				cell: ({ row }): React.JSX.Element => (row.original.isActive ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>),
			},
			{
				accessorKey: "isFeatured",
				header: "Is Featured",
				cell: ({ row }): React.JSX.Element => (row.original.isFeatured ? <Badge variant="secondary">Featured</Badge> : <Badge variant="outline">Not featured</Badge>),
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
		if (filterKey === "isFeatured") {
			setIsFeaturedFilter(value === null || value === "all" ? "all" : value);
		}
		if (filterKey === "categoryId") {
			setCategoryIdFilter(value ?? "");
		}
		if (filterKey === "brand") {
			setBrandFilter(value ?? "");
		}
	}, []);

	const manualColumnFilters = useMemo(
		(): Readonly<Record<string, string>> => ({
			isActive: isActiveFilter,
			isFeatured: isFeaturedFilter,
			categoryId: categoryIdFilter,
			brand: brandFilter,
		}),
		[isActiveFilter, isFeaturedFilter, categoryIdFilter, brandFilter],
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
			{
				key: "isFeatured",
				label: "Is Featured",
				options: [
					{ value: "true", label: "Featured" },
					{ value: "false", label: "Not featured" },
				],
			},
		],
		[],
	);

	const handleCategoryIdTextFilterChange = useCallback(function handleCategoryIdTextFilterChange(event: React.ChangeEvent<HTMLInputElement>): void {
		setCategoryIdFilter(event.target.value);
	}, []);

	const handleBrandTextFilterChange = useCallback(function handleBrandTextFilterChange(event: React.ChangeEvent<HTMLInputElement>): void {
		setBrandFilter(event.target.value);
	}, []);

	const textFilterToolbar = useMemo(
		(): React.JSX.Element => (
			<div className="flex flex-wrap gap-2">
				<Input
					key="categoryId"
					aria-label="Category Id"
					placeholder="Filter by category id"
					value={categoryIdFilter}
					onChange={handleCategoryIdTextFilterChange}
					className="h-9 w-full text-sm sm:w-44"
				/>
				,
				<Input
					key="brand"
					aria-label="Brand"
					placeholder="Filter by brand"
					value={brandFilter}
					onChange={handleBrandTextFilterChange}
					className="h-9 w-full text-sm sm:w-44"
				/>
				,
			</div>
		),
		[brandFilter, categoryIdFilter, handleBrandTextFilterChange, handleCategoryIdTextFilterChange],
	);

	const searchToolbar = useMemo(
		(): React.JSX.Element => (
			<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
				<DataTableSearchToolbar value={search} onChange={handleSearchChange} placeholder={labels.searchPlaceholder} ariaLabel={labels.searchAriaLabel} />
				{textFilterToolbar}
			</div>
		),
		[handleSearchChange, search, textFilterToolbar],
	);

	return (
		<div className="space-y-6">
			<header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Products</h1>
					<p className="text-sm text-muted-foreground">Browse and manage products.</p>
				</div>
				<Button nativeButton={false} render={<Link href="/product/create" />}>
					New Product
				</Button>
			</header>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">{rows.length > 0 ? `${String(rows.length)} products on this page` : "Products"}</CardTitle>
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
						onRowClick={handleView}
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
							title: isFiltered ? "No matching products" : "No products yet",
							description: isFiltered ? "Clear search or filters to see more results." : "Create your first product to get started.",
						}}
					/>
				</CardContent>
			</Card>
			{resourceDeleteDialog}
		</div>
	);
}

"use client";

import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
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
import { PRODUCTS_PAGE_SIZE_OPTIONS, PRODUCTS_TABLE_URL_STATE, toProductsListQuery } from "@/lib/url-state/products";
import { DataTableSearchToolbar } from "@/components/common/data-table-search-toolbar";
import { useAuth } from "@workspace/client/lib/auth";
import { useAuthorization } from "@workspace/client/lib/auth/can";
import { ALL_FILTER_OPTION, parseBooleanFilterOption, toListSearch } from "@workspace/client/lib/api/list-query";
import { LIST_FIRST_PAGE } from "@workspace/client/lib/url-state/list-url-state";
import { useUrlState } from "@workspace/client/lib/url-state/use-url-state";
import { LIST_SLOT_INDEX, PERMISSION, productListQuery, type Envelope, type Product } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { DataTable, type Action, type DataTableFeatures, type Filter } from "@workspace/ui/components/data-table";
import { buttonVariants } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { toastMessage } from "@workspace/ui/components/toast";

import type { DataTableBulkSelectionContext } from "@workspace/ui/lib/data-table/checkbox";
import { ROUTES } from "@/lib/routes";
import { formatCatalogAmount } from "@/lib/format/numbers";
import { formatDateTime } from "@/lib/format/dates";

const PRODUCT_SEARCH_PLACEHOLDER = "Search products...";
const PRODUCT_SEARCH_ARIA_LABEL = "Search Products";

/** Only the strings that differ from the kit pack's `dataTable` copy. */
const PRODUCT_TABLE_LABELS: UiKitLabelsOverride<"dataTable"> = {
	actionsMenuTitle: "Product actions",
	openRowMenu: "Open product row menu",
	searchPlaceholder: PRODUCT_SEARCH_PLACEHOLDER,
	searchAriaLabel: PRODUCT_SEARCH_ARIA_LABEL,
};

export interface ProductViewProps {
	/** The page the server prefetched for the URL it rendered. */
	readonly initialPage?: PrefetchedQuery<Envelope<Product[]>> | undefined;
}

/**
 * `/catalog/products` table. Search, the active / featured selects, the
 * category-id and brand text filters, sort and page all live in the URL
 * (lib/url-state/products); the text inputs keep only their in-progress drafts.
 */
export default function ProductView({ initialPage }: ProductViewProps): React.JSX.Element {
	const { api } = useAuth();
	// Each control mirrors its API route: GET /:id (READ), POST (CREATE), PATCH /:id (UPDATE), DELETE /:id + bulk-delete (DELETE).
	const { can } = useAuthorization();
	const canView = can(PERMISSION.PRODUCT.READ);
	const canCreate = can(PERMISSION.PRODUCT.CREATE);
	const canUpdate = can(PERMISSION.PRODUCT.UPDATE);
	const canDelete = can(PERMISSION.PRODUCT.DELETE);
	const { requestDelete, resourceDeleteDialog } = useResourceDeleteDialog();
	const router = useRouter();
	const queryClient = useQueryClient();
	const [urlState, updateUrlState] = useUrlState(PRODUCTS_TABLE_URL_STATE);
	const isFiltered =
		urlState.search !== undefined || urlState.isActive !== undefined || urlState.isFeatured !== undefined || urlState.categoryId !== undefined || urlState.brand !== undefined;

	const commitSearch = useCallback(
		(value: string): void => {
			updateUrlState({ search: toListSearch(value), page: LIST_FIRST_PAGE, cursor: undefined }, { history: "replace" });
		},
		[updateUrlState],
	);
	const commitCategoryId = useCallback(
		(value: string): void => {
			updateUrlState({ categoryId: toListSearch(value), page: LIST_FIRST_PAGE, cursor: undefined }, { history: "replace" });
		},
		[updateUrlState],
	);
	const commitBrand = useCallback(
		(value: string): void => {
			updateUrlState({ brand: toListSearch(value), page: LIST_FIRST_PAGE, cursor: undefined }, { history: "replace" });
		},
		[updateUrlState],
	);
	const [searchDraft, setSearchDraft] = useTableTextDraft(urlState.search, commitSearch);
	const [categoryIdDraft, setCategoryIdDraft] = useTableTextDraft(urlState.categoryId, commitCategoryId);
	const [brandDraft, setBrandDraft] = useTableTextDraft(urlState.brand, commitBrand);

	const handleClearFilters = useCallback((): void => {
		updateUrlState({
			search: undefined,
			isActive: undefined,
			isFeatured: undefined,
			categoryId: undefined,
			brand: undefined,
			page: LIST_FIRST_PAGE,
			cursor: undefined,
		});
	}, [updateUrlState]);

	const fetchAllMatchingProducts = useCallback(async (): Promise<Product[]> => {
		const rows = await fetchAllListPages(async (listPage, limit) => {
			const response = await api.product.list.fetchOrThrow(toProductsListQuery({ ...urlState, page: listPage, limit, cursor: undefined }));
			return {
				items: response.data,
				hasNext: readPaginatedHasNext(response.meta),
			};
		});
		return [...rows];
	}, [api.product.list, urlState]);

	const stateKey: string = PRODUCTS_TABLE_URL_STATE.serialize(urlState);
	const resourceListQuery = api.product.list.useQuery(toProductsListQuery(urlState), {
		placeholderData: keepPreviousData,
		...initialDataOption(prefetchedDataFor(initialPage, stateKey)),
	});
	const rows: Product[] = resourceListQuery.data?.data ?? [];
	// The server's count of every matching row — not just the rows on this page.
	const matchingTotal: number = readPaginatedTotal(resourceListQuery.data?.meta);
	const { pagination, sorting, handleSortingChange } = useUrlListPaging({
		state: urlState,
		update: updateUrlState,
		sortSpec: productListQuery,
		totalCount: matchingTotal,
		nextCursor: readPaginatedNextCursor(resourceListQuery.data?.meta),
		resetKey: PRODUCTS_TABLE_URL_STATE.serialize({ ...urlState, page: LIST_FIRST_PAGE, cursor: undefined }),
		getRowId: getProductRowId,
		onClearFilters: handleClearFilters,
		isFiltered,
		onFetchAllMatching: fetchAllMatchingProducts,
	});
	const tableError: string | null = resourceListQuery.isError ? "Could not load products. Clear search or filters and try again." : null;

	const handleView = useCallback(
		(item: Product): void => {
			router.push(ROUTES.catalog.products.detail(item.id));
		},
		[router],
	);

	const handleEdit = useCallback(
		(item: Product): void => {
			router.push(ROUTES.catalog.products.edit(item.id));
		},
		[router],
	);

	const deleteMutation = api.product.delete.useMutation({
		onSuccess: async () => {
			toastMessage.success({ title: "Product deleted", description: "The product was removed." });
			await queryClient.invalidateQueries({ queryKey: apiRouter.product.list.scopeKey(undefined) });
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
			await queryClient.invalidateQueries({ queryKey: apiRouter.product.list.scopeKey(undefined) });
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
		[bulkDeleteMutation, deleteMutation, fetchAllMatchingProducts, requestDelete],
	);

	const actions = useMemo((): Action<Product>[] => {
		const base: Action<Product>[] = [];
		if (canView) {
			base.push({
				key: "view",
				label: "View",
				description: "View product details",
				icon: <Eye className="size-4" />,
				onClick: handleView,
			});
		}
		if (canUpdate) {
			base.push({
				key: "edit",
				label: "Edit",
				description: "Edit product",
				icon: <Pencil className="size-4" />,
				onClick: handleEdit,
			});
		}
		if (canDelete) {
			base.push({
				key: "delete",
				label: "Delete",
				description: "Remove this product",
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
			buildResourceTableCheckbox<Product>({
				canDelete,
				exportFilename: "product.csv",
				exportableColumns: ["sku", "name", "price", "stockQuantity", "categoryId", "isActive", "isFeatured", "createdAt"],
				onDeleteAll: handleBulkDelete,
			}),
		[canDelete, handleBulkDelete],
	);

	const mobileCardRender = useCallback(
		(item: Product, cardActions?: Action<Product>[]): React.ReactNode => (
			<DataTableMobileCard
				item={item}
				title={item.sku}
				subtitle={item.name}
				badge={item.isActive ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
				fields={[
					{ label: "Price", value: formatCatalogAmount(item.price) },
					{ label: "Stock Quantity", value: String(item.stockQuantity) },
					{ label: "Category Id", value: item.categoryId },
					{ label: "Is Featured", value: item.isFeatured ? "Yes" : "No" },
					{ label: "Created At", value: formatDateTime(item.createdAt) },
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
					<Link href={ROUTES.catalog.products.detail(row.original.id)} className="font-medium text-primary hover:underline">
						{row.original.name}
					</Link>
				),
			},
			{
				accessorKey: "price",
				header: "Price",
				enableSorting: true,
				cell: ({ row }): React.JSX.Element => {
					return <span>{formatCatalogAmount(row.original.price)}</span>;
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
			if (filterKey === "isFeatured") {
				updateUrlState({ isFeatured: parseBooleanFilterOption(value ?? ""), page: LIST_FIRST_PAGE, cursor: undefined });
			}
		},
		[updateUrlState],
	);

	const manualColumnFilters = useMemo(
		(): Readonly<Record<string, string>> => ({
			isActive: urlState.isActive === undefined ? ALL_FILTER_OPTION : String(urlState.isActive),
			isFeatured: urlState.isFeatured === undefined ? ALL_FILTER_OPTION : String(urlState.isFeatured),
		}),
		[urlState.isActive, urlState.isFeatured],
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

	const handleCategoryIdTextFilterChange = useCallback(
		function handleCategoryIdTextFilterChange(event: React.ChangeEvent<HTMLInputElement>): void {
			setCategoryIdDraft(event.target.value);
		},
		[setCategoryIdDraft],
	);

	const handleBrandTextFilterChange = useCallback(
		function handleBrandTextFilterChange(event: React.ChangeEvent<HTMLInputElement>): void {
			setBrandDraft(event.target.value);
		},
		[setBrandDraft],
	);

	const textFilterToolbar = useMemo(
		(): React.JSX.Element => (
			<div className="flex flex-wrap gap-2">
				<Input
					key="categoryId"
					aria-label="Category Id"
					placeholder="Filter by category id"
					value={categoryIdDraft}
					onChange={handleCategoryIdTextFilterChange}
					className="h-9 w-full text-sm sm:w-44"
				/>
				<Input key="brand" aria-label="Brand" placeholder="Filter by brand" value={brandDraft} onChange={handleBrandTextFilterChange} className="h-9 w-full text-sm sm:w-44" />
			</div>
		),
		[brandDraft, categoryIdDraft, handleBrandTextFilterChange, handleCategoryIdTextFilterChange],
	);

	const searchToolbar = useMemo(
		(): React.JSX.Element => (
			<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
				<DataTableSearchToolbar value={searchDraft} onChange={setSearchDraft} placeholder={PRODUCT_SEARCH_PLACEHOLDER} ariaLabel={PRODUCT_SEARCH_ARIA_LABEL} />
				{textFilterToolbar}
			</div>
		),
		[searchDraft, setSearchDraft, textFilterToolbar],
	);

	return (
		<div className="space-y-6">
			<header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Products</h1>
					<p className="text-sm text-muted-foreground">Browse and manage products.</p>
				</div>
				{canCreate ? (
					<Link href={ROUTES.catalog.products.create} className={buttonVariants()}>
						New Product
					</Link>
				) : (
					<DisabledActionButton reason="Creating a product requires the product create permission.">New Product</DisabledActionButton>
				)}
			</header>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">{matchingTotal > 0 ? `${String(matchingTotal)} products` : "Products"}</CardTitle>
				</CardHeader>
				<CardContent>
					<DataTable
						data={rows}
						columns={columns}
						labels={PRODUCT_TABLE_LABELS}
						actions={actions}
						checkbox={checkbox}
						enableColumnVisibility
						filters={tableFilters}
						manualColumnFilters={manualColumnFilters}
						onManualColumnFilterChange={handleManualColumnFilterChange}
						mobileCardRender={mobileCardRender}
						{...(canView ? { onRowClick: handleView } : {})}
						pagination={pagination}
						pageSizeOptions={PRODUCTS_PAGE_SIZE_OPTIONS}
						sorting={sorting}
						onManualSortingChange={handleSortingChange}
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

function getProductRowId(product: Product): string {
	return product.id;
}

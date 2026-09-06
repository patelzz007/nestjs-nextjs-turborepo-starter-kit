"use client";

import { createDataTableLabels } from "@/lib/data-table-labels";
import { DataTableMobileCard } from "@/lib/data-table-mobile-card";
import { readPaginatedTotal } from "@/lib/api-envelope";
import { useAuth } from "@workspace/client/lib/auth";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { DataTable, type Action, type DataTableFeatures } from "@workspace/ui/components/display/data-table";
import { Button } from "@workspace/ui/components/form/button";
import { Input } from "@workspace/ui/components/form/input";
import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { Eye, Pencil, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { toastMessage } from "@workspace/ui/components/feedback/toast";

import { ProductListSortBySchema, type Product, type ProductListSortBy } from "@workspace/shared/schemas/domain/product.generated";

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

const labels = createDataTableLabels({
	actionsMenuTitle: "Product actions",
	openRowMenu: "Open product row menu",
	searchPlaceholder: "Search products...",
	searchAriaLabel: "Search Products",
});

function useDebouncedValue<T>(value: T, delayMs: number): T {
	const [debouncedValue, setDebouncedValue] = useState(value);
	useEffect((): (() => void) => {
		const timer = setTimeout(() => {
			setDebouncedValue(value);
		}, delayMs);
		return (): void => {
			clearTimeout(timer);
		};
	}, [value, delayMs]);
	return debouncedValue;
}

export default function ProductView(): React.JSX.Element {
	const { api } = useAuth();
	const router = useRouter();
	const queryClient = useQueryClient();
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search, 300);
	const [sorting, setSorting] = useState<SortingState>([]);
	const sort = sorting[0];
	const sortBy = resolveListSortBy(sort?.id);
	const trimmedSearch = debouncedSearch.trim();
	const listQuery = api.product.list.useQuery(
		{
			page,
			limit: pageSize,
			...(sortBy !== undefined ? { sortBy, sortDirection: sort?.desc === true ? "desc" : "asc" } : {}),
			...(trimmedSearch.length > 0 ? { search: trimmedSearch } : {}),
		},
		{ placeholderData: keepPreviousData },
	);
	const rows: Product[] = listQuery.data?.data ?? [];
	const total = readPaginatedTotal(listQuery.data?.meta, rows.length);

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

	const handleDelete = useCallback(
		(item: Product): void => {
			const confirmed = window.confirm(`Delete "${item.name}"? This action soft-deletes the product.`);
			if (!confirmed) {
				return;
			}
			deleteMutation.mutate({ id: item.id });
		},
		[deleteMutation],
	);

	const actions = useMemo((): Action<Product>[] => {
		return [
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
			{
				key: "delete",
				label: "Delete",
				description: "Remove this product",
				icon: <Trash2 className="size-4" />,
				onClick: handleDelete,
				isDestructive: true,
				iconBgColor: "bg-red-100 dark:bg-red-900/40",
			},
		];
	}, [handleDelete, handleEdit, handleView]);

	const mobileCardRender = useCallback(
		(item: Product, cardActions?: Action<Product>[]): React.ReactNode => (
			<DataTableMobileCard
				item={item}
				title={item.sku}
				subtitle={item.name}
				badge={item.isActive ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
				fields={[
					{ label: "Price", value: Number.isFinite(item.price) ? item.price.toFixed(2) : "—" },
					{ label: "StockQuantity", value: String(item.stockQuantity) },
					{ label: "CategoryId", value: item.categoryId },
					{ label: "IsFeatured", value: item.isFeatured ? "Yes" : "No" },
					{ label: "CreatedAt", value: Number.isFinite(item.createdAt) ? new Date(item.createdAt).toLocaleString() : "—" },
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
				header: "StockQuantity",
				enableSorting: true,
			},
			{
				accessorKey: "categoryId",
				header: "CategoryId",
			},
			{
				accessorKey: "isActive",
				header: "IsActive",
			},
			{
				accessorKey: "isFeatured",
				header: "IsFeatured",
			},
			{
				accessorKey: "createdAt",
				header: "CreatedAt",
				enableSorting: true,
				cell: ({ row }): React.JSX.Element => {
					const value = row.original.createdAt;
					return <span>{Number.isFinite(value) ? new Date(value).toLocaleString() : "—"}</span>;
				},
			},
		],
		[],
	);

	const handleManualPaginationChange = useCallback((nextPage: number, nextPageSize: number): void => {
		setPage(nextPage);
		setPageSize(nextPageSize);
	}, []);

	const handleManualSortingChange = useCallback((nextSorting: SortingState): void => {
		setSorting(nextSorting);
		setPage(1);
	}, []);

	const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setSearch(event.target.value);
		setPage(1);
	}, []);

	const searchToolbar = useMemo(
		(): React.JSX.Element => (
			<div className="relative w-full sm:max-w-xs">
				<Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
				<Input aria-label={labels.searchAriaLabel} placeholder={labels.searchPlaceholder} value={search} onChange={handleSearchChange} className="h-9 pl-8" />
			</div>
		),
		[handleSearchChange, search],
	);

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold">Products</h1>
				<Button nativeButton={false} render={<Link href="/product/create" />}>
					New Product
				</Button>
			</div>
			<DataTable
				data={rows}
				columns={columns}
				labels={labels}
				actions={actions}
				mobileCardRender={mobileCardRender}
				manual
				totalCount={total}
				pageIndex={page - 1}
				pageSize={pageSize}
				sorting={sorting}
				onManualPaginationChange={handleManualPaginationChange}
				onManualSortingChange={handleManualSortingChange}
				isLoading={listQuery.isLoading}
				error={listQuery.error?.message ?? null}
				searchKeys={[]}
				toolbarContent={searchToolbar}
			/>
		</div>
	);
}

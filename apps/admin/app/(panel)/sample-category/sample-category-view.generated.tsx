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
import { Pencil, Eye, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { toastMessage } from "@workspace/ui/components/feedback/toast";

import { SampleCategoryListSortBySchema, type SampleCategory, type SampleCategoryListSortBy } from "@workspace/shared/schemas/domain/sample-category.generated";

function resolveListSortBy(columnId: string | undefined): SampleCategoryListSortBy | undefined {
	if (columnId === undefined) {
		return undefined;
	}
	const parsed = SampleCategoryListSortBySchema.safeParse(columnId);
	if (!parsed.success) {
		return undefined;
	}
	return parsed.data;
}

const labels = createDataTableLabels({
	actionsMenuTitle: "SampleCategory actions",
	openRowMenu: "Open samplecategory row menu",
	searchPlaceholder: "Search categories...",
	searchAriaLabel: "Search Categories",
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

export default function SampleCategoryView(): React.JSX.Element {
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
	const listQuery = api.sampleCategory.list.useQuery(
		{
			page,
			limit: pageSize,
			...(sortBy !== undefined ? { sortBy, sortDirection: sort?.desc === true ? "desc" : "asc" } : {}),
			...(trimmedSearch.length > 0 ? { search: trimmedSearch } : {}),
		},
		{ placeholderData: keepPreviousData },
	);
	const rows: SampleCategory[] = listQuery.data?.data ?? [];
	const total = readPaginatedTotal(listQuery.data?.meta, rows.length);

	const handleEdit = useCallback(
		(item: SampleCategory): void => {
			router.push(`/sample-category/${item.id}/edit`);
		},
		[router],
	);

	const handleView = useCallback(
		(item: SampleCategory): void => {
			router.push(`/sample-category/${item.id}`);
		},
		[router],
	);

	const deleteMutation = api.sampleCategory.delete.useMutation({
		onSuccess: async () => {
			toastMessage.success({ title: "Category deleted", description: "The category was removed from the catalog." });
			await queryClient.invalidateQueries({ queryKey: ["sample-category", "list"] });
		},
		onError: (error) => {
			toastMessage.error({ title: "Delete failed", description: error.message });
		},
	});

	const handleDelete = useCallback(
		(item: SampleCategory): void => {
			const confirmed = window.confirm(`Delete "${item.name}"? This action soft-deletes the category.`);
			if (!confirmed) {
				return;
			}
			deleteMutation.mutate({ id: item.id });
		},
		[deleteMutation],
	);

	const actions = useMemo((): Action<SampleCategory>[] => {
		return [
			{
				key: "view",
				label: "View",
				description: "View category details",
				icon: <Eye className="size-4" />,
				onClick: handleView,
			},
			{
				key: "edit",
				label: "Edit",
				description: "Edit samplecategory",
				icon: <Pencil className="size-4" />,
				onClick: handleEdit,
			},
			{
				key: "delete",
				label: "Delete",
				description: "Remove this category",
				icon: <Trash2 className="size-4" />,
				onClick: handleDelete,
				isDestructive: true,
				iconBgColor: "bg-red-100 dark:bg-red-900/40",
			},
		];
	}, [handleDelete, handleEdit, handleView]);

	const mobileCardRender = useCallback(
		(item: SampleCategory, cardActions?: Action<SampleCategory>[]): React.ReactNode => (
			<DataTableMobileCard
				item={item}
				title={item.name}
				subtitle={item.slug}
				badge={item.isActive ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
				fields={[
					{ label: "SortOrder", value: item.sortOrder },
					{ label: "CreatedAt", value: Number.isFinite(item.createdAt) ? new Date(item.createdAt).toLocaleString() : "—" },
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
			},
			{
				accessorKey: "slug",
				header: "Slug",
				enableSorting: true,
			},
			{
				accessorKey: "sortOrder",
				header: "SortOrder",
				enableSorting: true,
			},
			{
				accessorKey: "isActive",
				header: "IsActive",
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
				<h1 className="text-2xl font-semibold">SampleCategories</h1>
				<Button nativeButton={false} render={<Link href="/sample-category/create" />}>
					New SampleCategory
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

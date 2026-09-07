"use client";

import { createDataTableLabels } from "@/lib/data-table-labels";
import { buildResourceTableCheckbox, canDeletePlatformResource } from "@/lib/data-table-capabilities";
import { fetchAllPaginatedListPages, resolveManualBulkSelectionRows } from "@/lib/resolve-manual-bulk-selection";
import { useSessionCapabilities } from "@/lib/session-capabilities";
import { useResourceDeleteDialog } from "@/components/common/resource-delete-dialog";
import { DataTableMobileCard } from "@/lib/data-table-mobile-card";
import { readPaginatedTotal, stubPaginatedMeta } from "@/lib/api-envelope";
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

import {
	SampleCategoryListSortBySchema,
	type SampleCategory,
	type SampleCategoryListSortBy,
} from "@workspace/shared/schemas/domain/sample-category.generated";
import type { DataTableBulkSelectionContext } from "@workspace/ui/lib/data-table-checkbox";

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

export interface SampleCategoryViewProps {
	readonly initialRows?: readonly SampleCategory[];
	readonly initialTotal?: number;
}

export default function SampleCategoryView({ initialRows, initialTotal }: SampleCategoryViewProps): React.JSX.Element {
	const { api } = useAuth();
	const { hasCapability } = useSessionCapabilities();
	const canDelete = canDeletePlatformResource(hasCapability, "SAMPLE_CATEGORY");
	const { requestDelete, resourceDeleteDialog } = useResourceDeleteDialog();
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
	const initialQueryData = useMemo(
		() =>
			initialRows !== undefined
				? {
						success: true as const,
						data: [...initialRows],
						meta: stubPaginatedMeta(initialTotal ?? initialRows.length, 1, 20),
					}
				: undefined,
		[initialRows, initialTotal],
	);
	const listQuery = api.sampleCategory.list.useQuery(
		{
			page,
			limit: pageSize,
			...(sortBy !== undefined ? { sortBy, sortDirection: sort?.desc === true ? "desc" : "asc" } : {}),
			...(trimmedSearch.length > 0 ? { search: trimmedSearch } : {}),
		},
		{
			placeholderData: keepPreviousData,
			initialData:
				page === 1 && pageSize === 20 && trimmedSearch.length === 0 && sorting.length === 0 ? initialQueryData : undefined,
		},
	);
	const rows: SampleCategory[] = listQuery.data?.data ?? [];
	const total = readPaginatedTotal(listQuery.data?.meta, initialTotal ?? rows.length);

	const buildListQuery = useCallback(
		(pageNumber: number, limit: number) => {
			const sortDirection: "asc" | "desc" = sort?.desc === true ? "desc" : "asc";
			return {
				page: pageNumber,
				limit,
				...(sortBy !== undefined ? { sortBy, sortDirection } : {}),
				...(trimmedSearch.length > 0 ? { search: trimmedSearch } : {}),
			};
		},
		[sortBy, sort?.desc, trimmedSearch],
	);

	const fetchAllMatchingSampleCategorys = useCallback((): Promise<readonly SampleCategory[]> => {
		return fetchAllPaginatedListPages(total, async (pageNumber, limit) => {
			const response = await api.sampleCategory.list.fetchOrThrow(buildListQuery(pageNumber, limit));
			return response.data;
		});
	}, [api.sampleCategory.list, buildListQuery, total]);

	const handleView = useCallback(
		(item: SampleCategory): void => {
			router.push(`/sample-category/${item.id}`);
		},
		[router],
	);

	const handleEdit = useCallback(
		(item: SampleCategory): void => {
			router.push(`/sample-category/${item.id}/edit`);
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
		const base: Action<SampleCategory>[] = [
			{
				key: "view",
				label: "View",
				description: "View samplecategory details",
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
		];
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
	}, [canDelete, handleDelete, handleEdit, handleView]);

	const checkbox = useMemo(
		() =>
			buildResourceTableCheckbox<SampleCategory>({
				hasCapability,
				resource: "SAMPLE_CATEGORY",
				exportFilename: "sample-category.csv",
				exportableColumns: ["name","slug","sortOrder","isActive","createdAt"],
				onDeleteAll: handleBulkDelete,
			}),
		[handleBulkDelete, hasCapability],
	);

	const mobileCardRender = useCallback(
		(item: SampleCategory, cardActions?: Action<SampleCategory>[]): React.ReactNode => (
			<DataTableMobileCard
				item={item}
				title={item.name}
			subtitle={item.slug}
			badge={item.isActive ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
				fields={[
				{ label: "SortOrder", value: String(item.sortOrder) },
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
				<Input
					aria-label={labels.searchAriaLabel}
					placeholder={labels.searchPlaceholder}
					value={search}
					onChange={handleSearchChange}
					className="h-9 pl-8"
				/>
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
				checkbox={checkbox}
				enableColumnVisibility
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
			{resourceDeleteDialog}
		</div>
	);
}

import type { ResourceIR } from "../../ir/types";
import { renderGeneratedMobileCardBlock } from "./render-mobile-card";
import { resolveSearchableFieldNames, toSortableCamelNames } from "../nestjs/list-query";

function renderColumnDef(column: string, sortableColumns: ReadonlySet<string>, ir: ResourceIR): string {
	const field = ir.fields.find((item) => item.camelName === column);
	const enableSorting = sortableColumns.has(column);
	const sortingLine = enableSorting ? "\n\t\tenableSorting: true," : "";
	const header = `${column.charAt(0).toUpperCase()}${column.slice(1)}`;
	if (column === "createdAt" || column === "updatedAt") {
		return `\t{\n\t\taccessorKey: "${column}",\n\t\theader: "${header}",${sortingLine}\n\t\tcell: ({ row }): React.JSX.Element => {\n\t\t\tconst value = row.original.${column};\n\t\t\treturn <span>{Number.isFinite(value) ? new Date(value).toLocaleString() : "—"}</span>;\n\t\t},\n\t},`;
	}
	if (field?.type === "decimal") {
		return `\t{\n\t\taccessorKey: "${column}",\n\t\theader: "${header}",${sortingLine}\n\t\tcell: ({ row }): React.JSX.Element => {\n\t\t\tconst value = row.original.${column};\n\t\t\treturn <span>{Number.isFinite(value) ? value.toFixed(2) : "—"}</span>;\n\t\t},\n\t},`;
	}
	if (field?.type === "datetime") {
		return `\t{\n\t\taccessorKey: "${column}",\n\t\theader: "${header}",${sortingLine}\n\t\tcell: ({ row }): React.JSX.Element => {\n\t\t\tconst value = row.original.${column};\n\t\t\treturn <span>{Number.isFinite(value) ? new Date(value).toLocaleString() : "—"}</span>;\n\t\t},\n\t},`;
	}
	return `\t{\n\t\taccessorKey: "${column}",\n\t\theader: "${header}",${sortingLine}\n\t},`;
}

function resolveSearchLabel(ir: ResourceIR): string {
	return ir.admin?.navigation?.label ?? ir.resource.plural;
}

function renderCascadeListInvalidation(ir: ResourceIR): string {
	return ir.cascadeSoftDeleteChildren.map((child) => `\t\t\tawait queryClient.invalidateQueries({ queryKey: ["${child.childSlug}", "list"] });`).join("\n");
}

export function renderAdminView(ir: ResourceIR): string {
	const model = ir.resource.modelName;
	const slug = ir.resource.slug;
	const contractKey = ir.resource.contractKey;
	const searchLabel = resolveSearchLabel(ir);
	const columns = ir.admin?.list.columns ?? [];
	const sortableColumns = new Set(toSortableCamelNames(ir));
	const columnDefs = columns.map((column) => renderColumnDef(column, sortableColumns, ir)).join("\n");
	const searchableFields = resolveSearchableFieldNames(ir);
	const hasServerSearch = searchableFields.length > 0;
	const mobileCardBlock = renderGeneratedMobileCardBlock(ir, columns);
	const permissionResource = ir.resource.permissionResource;
	const exportableColumnsJson = JSON.stringify(columns);
	const cascadeListInvalidation = renderCascadeListInvalidation(ir);

	return `"use client";

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
	${model}ListSortBySchema,
	type ${model},
	type ${model}ListSortBy,
} from "@workspace/shared/schemas/domain/${slug}.generated";
import type { DataTableBulkSelectionContext } from "@workspace/ui/lib/data-table-checkbox";

function resolveListSortBy(columnId: string | undefined): ${model}ListSortBy | undefined {
	if (columnId === undefined) {
		return undefined;
	}
	const parsed = ${model}ListSortBySchema.safeParse(columnId);
	if (!parsed.success) {
		return undefined;
	}
	return parsed.data;
}

const labels = createDataTableLabels({
\tactionsMenuTitle: "${ir.resource.singular} actions",
\topenRowMenu: "Open ${ir.resource.singular.toLowerCase()} row menu",
\tsearchPlaceholder: "Search ${searchLabel.toLowerCase()}...",
\tsearchAriaLabel: "Search ${searchLabel}",
});

function useDebouncedValue<T>(value: T, delayMs: number): T {
\tconst [debouncedValue, setDebouncedValue] = useState(value);
\tuseEffect((): (() => void) => {
\t\tconst timer = setTimeout(() => {
\t\t\tsetDebouncedValue(value);
\t\t}, delayMs);
\t\treturn (): void => {
\t\t\tclearTimeout(timer);
\t\t};
\t}, [value, delayMs]);
\treturn debouncedValue;
}

export interface ${model}ViewProps {
\treadonly initialRows?: readonly ${model}[];
\treadonly initialTotal?: number;
}

export default function ${model}View({ initialRows, initialTotal }: ${model}ViewProps): React.JSX.Element {
\tconst { api } = useAuth();
\tconst { hasCapability } = useSessionCapabilities();
\tconst canDelete = canDeletePlatformResource(hasCapability, "${permissionResource}");
\tconst { requestDelete, resourceDeleteDialog } = useResourceDeleteDialog();
\tconst router = useRouter();
\tconst queryClient = useQueryClient();
\tconst [page, setPage] = useState(1);
\tconst [pageSize, setPageSize] = useState(20);
\tconst [search, setSearch] = useState("");
\tconst debouncedSearch = useDebouncedValue(search, 300);
\tconst [sorting, setSorting] = useState<SortingState>([]);
\tconst sort = sorting[0];
\tconst sortBy = resolveListSortBy(sort?.id);
\tconst trimmedSearch = debouncedSearch.trim();
\tconst initialQueryData = useMemo(
\t\t() =>
\t\t\tinitialRows !== undefined
\t\t\t\t? {
\t\t\t\t\t\tsuccess: true as const,
\t\t\t\t\t\tdata: [...initialRows],
\t\t\t\t\t\tmeta: stubPaginatedMeta(initialTotal ?? initialRows.length, 1, 20),
\t\t\t\t\t}
\t\t\t\t: undefined,
\t\t[initialRows, initialTotal],
\t);
\tconst listQuery = api.${contractKey}.list.useQuery(
\t\t{
\t\t\tpage,
\t\t\tlimit: pageSize,
\t\t\t...(sortBy !== undefined ? { sortBy, sortDirection: sort?.desc === true ? "desc" : "asc" } : {}),
\t\t\t...(trimmedSearch.length > 0 ? { search: trimmedSearch } : {}),
\t\t},
\t\t{
\t\t\tplaceholderData: keepPreviousData,
\t\t\tinitialData:
\t\t\t\tpage === 1 && pageSize === 20 && trimmedSearch.length === 0 && sorting.length === 0 ? initialQueryData : undefined,
\t\t},
\t);
\tconst rows: ${model}[] = listQuery.data?.data ?? [];
\tconst total = readPaginatedTotal(listQuery.data?.meta, initialTotal ?? rows.length);

\tconst buildListQuery = useCallback(
\t\t(pageNumber: number, limit: number) => {
\t\t\tconst sortDirection: "asc" | "desc" = sort?.desc === true ? "desc" : "asc";
\t\t\treturn {
\t\t\t\tpage: pageNumber,
\t\t\t\tlimit,
\t\t\t\t...(sortBy !== undefined ? { sortBy, sortDirection } : {}),
\t\t\t\t...(trimmedSearch.length > 0 ? { search: trimmedSearch } : {}),
\t\t\t};
\t\t},
\t\t[sortBy, sort?.desc, trimmedSearch],
\t);

\tconst fetchAllMatching${model}s = useCallback((): Promise<readonly ${model}[]> => {
\t\treturn fetchAllPaginatedListPages(total, async (pageNumber, limit) => {
\t\t\tconst response = await api.${contractKey}.list.fetchOrThrow(buildListQuery(pageNumber, limit));
\t\t\treturn response.data;
\t\t});
\t}, [api.${contractKey}.list, buildListQuery, total]);

\tconst handleView = useCallback(
\t\t(item: ${model}): void => {
\t\t\trouter.push(\`/${slug}/\${item.id}\`);
\t\t},
\t\t[router],
\t);

\tconst handleEdit = useCallback(
\t\t(item: ${model}): void => {
\t\t\trouter.push(\`/${slug}/\${item.id}/edit\`);
\t\t},
\t\t[router],
\t);

\tconst deleteMutation = api.${contractKey}.delete.useMutation({
\t\tonSuccess: async () => {
\t\t\ttoastMessage.success({ title: "${ir.resource.singular} deleted", description: "The ${ir.resource.singular.toLowerCase()} was removed." });
\t\t\tawait queryClient.invalidateQueries({ queryKey: ["${slug}", "list"] });
${cascadeListInvalidation}
\t\t},
\t\tonError: (error) => {
\t\t\ttoastMessage.error({ title: "Delete failed", description: error.message });
\t\t},
\t});

\tconst bulkDeleteMutation = api.${contractKey}.bulkDelete.useMutation({
\t\tonSuccess: async (result) => {
\t\t\tconst deletedCount = result.data.deletedCount;
\t\t\ttoastMessage.success({
\t\t\t\ttitle: \`\${String(deletedCount)} ${ir.resource.singular.toLowerCase()}\${deletedCount === 1 ? "" : "s"} deleted\`,
\t\t\t\tdescription: "The selected ${ir.resource.plural.toLowerCase()} were removed.",
\t\t\t});
\t\t\tawait queryClient.invalidateQueries({ queryKey: ["${slug}", "list"] });
${cascadeListInvalidation}
\t\t},
\t\tonError: (error) => {
\t\t\ttoastMessage.error({ title: "Bulk delete failed", description: error.message });
\t\t},
\t});

\tconst handleDelete = useCallback(
\t\t(item: ${model}): void => {
\t\t\tvoid requestDelete({
\t\t\t\ttitle: \`Delete "\${item.name}"?\`,
\t\t\t\tdescription: "This action soft-deletes the ${ir.resource.singular.toLowerCase()}.",
\t\t\t\tonConfirm: async (): Promise<void> => {
\t\t\t\t\tawait deleteMutation.mutateAsync({ id: item.id });
\t\t\t\t},
\t\t\t});
\t\t},
\t\t[deleteMutation, requestDelete],
\t);

\tconst handleBulkDelete = useCallback(
\t\tasync (selected: ${model}[], context: DataTableBulkSelectionContext): Promise<void> => {
\t\t\tconst count = context.selectAllPages ? context.totalMatchingRows : selected.length;
\t\t\tawait requestDelete({
\t\t\t\ttitle: \`Delete \${String(count)} ${ir.resource.singular.toLowerCase()}\${count === 1 ? "" : "s"}?\`,
\t\t\t\tdescription: "This action soft-deletes them.",
\t\t\t\tcount,
\t\t\t\tonConfirm: async (): Promise<void> => {
\t\t\t\t\tconst rowsToDelete = await resolveManualBulkSelectionRows(selected, context, fetchAllMatching${model}s);
\t\t\t\t\tif (rowsToDelete.length === 1) {
\t\t\t\t\t\tconst onlyRow = rowsToDelete[0];
\t\t\t\t\t\tif (onlyRow !== undefined) {
\t\t\t\t\t\t\tawait deleteMutation.mutateAsync({ id: onlyRow.id });
\t\t\t\t\t\t}
\t\t\t\t\t\treturn;
\t\t\t\t\t}
\t\t\t\t\tawait bulkDeleteMutation.mutateAsync({ ids: rowsToDelete.map((row) => row.id) });
\t\t\t\t},
\t\t\t});
\t\t},
\t\t[bulkDeleteMutation, deleteMutation, fetchAllMatching${model}s, requestDelete],
\t);

\tconst actions = useMemo((): Action<${model}>[] => {
\t\tconst base: Action<${model}>[] = [
\t\t\t{
\t\t\t\tkey: "view",
\t\t\t\tlabel: "View",
\t\t\t\tdescription: "View ${ir.resource.singular.toLowerCase()} details",
\t\t\t\ticon: <Eye className="size-4" />,
\t\t\t\tonClick: handleView,
\t\t\t},
\t\t\t{
\t\t\t\tkey: "edit",
\t\t\t\tlabel: "Edit",
\t\t\t\tdescription: "Edit ${ir.resource.singular.toLowerCase()}",
\t\t\t\ticon: <Pencil className="size-4" />,
\t\t\t\tonClick: handleEdit,
\t\t\t},
\t\t];
\t\tif (canDelete) {
\t\t\tbase.push({
\t\t\t\tkey: "delete",
\t\t\t\tlabel: "Delete",
\t\t\t\tdescription: "Remove this ${ir.resource.singular.toLowerCase()}",
\t\t\t\ticon: <Trash2 className="size-4" />,
\t\t\t\tonClick: handleDelete,
\t\t\t\tisDestructive: true,
\t\t\t\ticonBgColor: "bg-red-100 dark:bg-red-900/40",
\t\t\t});
\t\t}
\t\treturn base;
\t}, [canDelete, handleDelete, handleEdit, handleView]);

\tconst checkbox = useMemo(
\t\t() =>
\t\t\tbuildResourceTableCheckbox<${model}>({
\t\t\t\thasCapability,
\t\t\t\tresource: "${permissionResource}",
\t\t\t\texportFilename: "${slug}.csv",
\t\t\t\texportableColumns: ${exportableColumnsJson},
\t\t\t\tonDeleteAll: handleBulkDelete,
\t\t\t}),
\t\t[handleBulkDelete, hasCapability],
\t);

${mobileCardBlock}

\tconst columns = useMemo<ColumnDef<DataTableFeatures, ${model}>[]>(
\t\t() => [
${columnDefs}
\t\t],
\t\t[],
\t);

\tconst handleManualPaginationChange = useCallback((nextPage: number, nextPageSize: number): void => {
\t\tsetPage(nextPage);
\t\tsetPageSize(nextPageSize);
\t}, []);

\tconst handleManualSortingChange = useCallback((nextSorting: SortingState): void => {
\t\tsetSorting(nextSorting);
\t\tsetPage(1);
\t}, []);

\tconst handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
\t\tsetSearch(event.target.value);
\t\tsetPage(1);
\t}, []);

\tconst searchToolbar = ${
		hasServerSearch
			? `useMemo(
\t\t(): React.JSX.Element => (
\t\t\t<div className="relative w-full sm:max-w-xs">
\t\t\t\t<Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
\t\t\t\t<Input
\t\t\t\t\taria-label={labels.searchAriaLabel}
\t\t\t\t\tplaceholder={labels.searchPlaceholder}
\t\t\t\t\tvalue={search}
\t\t\t\t\tonChange={handleSearchChange}
\t\t\t\t\tclassName="h-9 pl-8"
\t\t\t\t/>
\t\t\t</div>
\t\t),
\t\t[handleSearchChange, search],
\t)`
			: "undefined"
	};

\treturn (
\t\t<div className="space-y-4">
\t\t\t<div className="flex items-center justify-between">
\t\t\t\t<h1 className="text-2xl font-semibold">${ir.resource.plural}</h1>
\t\t\t\t<Button nativeButton={false} render={<Link href="/${slug}/create" />}>
\t\t\t\t\tNew ${ir.resource.singular}
\t\t\t\t</Button>
\t\t\t</div>
\t\t\t<DataTable
\t\t\t\tdata={rows}
\t\t\t\tcolumns={columns}
\t\t\t\tlabels={labels}
\t\t\t\tactions={actions}
\t\t\t\tcheckbox={checkbox}
\t\t\t\tenableColumnVisibility
\t\t\t\tmobileCardRender={mobileCardRender}
\t\t\t\tmanual
\t\t\t\ttotalCount={total}
\t\t\t\tpageIndex={page - 1}
\t\t\t\tpageSize={pageSize}
\t\t\t\tsorting={sorting}
\t\t\t\tonManualPaginationChange={handleManualPaginationChange}
\t\t\t\tonManualSortingChange={handleManualSortingChange}
\t\t\t\tisLoading={listQuery.isLoading}
\t\t\t\terror={listQuery.error?.message ?? null}
\t\t\t\tsearchKeys={[]}
\t\t\t\ttoolbarContent={searchToolbar}
\t\t\t/>
\t\t\t{resourceDeleteDialog}
\t\t</div>
\t);
}
`;
}

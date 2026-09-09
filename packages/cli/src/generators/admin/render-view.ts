import { humanizeFieldLabel } from "../../core/humanize";
import { tsStringLiteral } from "../../core/ts-literal";
import type { FieldIR, ResourceIR } from "../../ir/types";
import { resolveUiResourceBasePath } from "../../ir/ui-context";
import {
	hasViewTableFilters,
	renderViewBuildListQueryFilterSpreads,
	renderViewApiQueryFilterSpreads,
	renderViewClearFiltersBody,
	renderViewDataTableFilterProps,
	renderViewFilterImports,
	renderViewFilterParsing,
	renderViewFilterSchemas,
	renderViewFilterState,
	renderViewHandleManualColumnFilterChange,
	renderViewInitialDataFilterGuard,
	renderViewIsFilteredExpression,
	renderViewManualColumnFilters,
	renderViewPaginationResetDeps,
	renderViewTableFilters,
	renderViewTextFilterParsing,
	renderViewTextFilterState,
	renderViewTextFilterHandlers,
	renderViewTextFilterToolbar,
	resolveTitleField,
	resolveViewBuildListQueryDeps,
} from "./list-filters";
import { renderGeneratedMobileCardBlock } from "./render-mobile-card";
import { resolveSearchableFieldNames, toSortableCamelNames } from "../nestjs/list-query";

function renderRowCellExpression(field: FieldIR | undefined, accessor: string): string {
	if (field?.type === "int" || field?.type === "decimal") {
		return `String(${accessor})`;
	}
	return accessor;
}

function renderColumnDef(column: string, sortableColumns: ReadonlySet<string>, ir: ResourceIR, basePath: string, titleField: string): string {
	const field = ir.fields.find((item) => item.camelName === column);
	const enableSorting = sortableColumns.has(column);
	const sortingLine = enableSorting ? "\n\t\tenableSorting: true," : "";
	const header = humanizeFieldLabel(column);
	if (column === titleField) {
		return `\t{\n\t\taccessorKey: "${column}",\n\t\theader: ${tsStringLiteral(header)},${sortingLine}\n\t\tcell: ({ row }): React.JSX.Element => (\n\t\t\t<Link href={\`${basePath}/\${row.original.id}\`} className="font-medium text-primary hover:underline">\n\t\t\t\t{${renderRowCellExpression(field, `row.original.${column}`)}}\n\t\t\t</Link>\n\t\t),\n\t},`;
	}
	if (field?.type === "boolean") {
		const labels =
			column === "isActive"
				? { trueLabel: "Active", falseLabel: "Inactive", trueVariant: "secondary", falseVariant: "outline" }
				: column === "isFeatured"
					? { trueLabel: "Featured", falseLabel: "Not featured", trueVariant: "secondary", falseVariant: "outline" }
					: { trueLabel: "Yes", falseLabel: "No", trueVariant: "secondary", falseVariant: "outline" };
		return `\t{\n\t\taccessorKey: "${column}",\n\t\theader: ${tsStringLiteral(header)},${sortingLine}\n\t\tcell: ({ row }): React.JSX.Element => (\n\t\t\trow.original.${column} ? <Badge variant="${labels.trueVariant}">${labels.trueLabel}</Badge> : <Badge variant="${labels.falseVariant}">${labels.falseLabel}</Badge>\n\t\t),\n\t},`;
	}
	if (field?.type === "enum") {
		return `\t{\n\t\taccessorKey: "${column}",\n\t\theader: ${tsStringLiteral(header)},${sortingLine}\n\t\tcell: ({ row }): React.JSX.Element => <Badge variant="outline">{row.original.${column}}</Badge>,\n\t},`;
	}
	if (column === "createdAt" || column === "updatedAt") {
		return `\t{\n\t\taccessorKey: "${column}",\n\t\theader: ${tsStringLiteral(header)},${sortingLine}\n\t\tcell: ({ row }): React.JSX.Element => {\n\t\t\tconst value = row.original.${column};\n\t\t\treturn <span>{Number.isFinite(value) ? new Date(value).toLocaleString() : "—"}</span>;\n\t\t},\n\t},`;
	}
	if (field?.type === "decimal") {
		return `\t{\n\t\taccessorKey: "${column}",\n\t\theader: ${tsStringLiteral(header)},${sortingLine}\n\t\tcell: ({ row }): React.JSX.Element => {\n\t\t\tconst value = row.original.${column};\n\t\t\treturn <span>{Number.isFinite(value) ? value.toFixed(2) : "—"}</span>;\n\t\t},\n\t},`;
	}
	if (field?.type === "datetime") {
		return `\t{\n\t\taccessorKey: "${column}",\n\t\theader: ${tsStringLiteral(header)},${sortingLine}\n\t\tcell: ({ row }): React.JSX.Element => {\n\t\t\tconst value = row.original.${column};\n\t\t\treturn <span>{Number.isFinite(value) ? new Date(value).toLocaleString() : "—"}</span>;\n\t\t},\n\t},`;
	}
	return `\t{\n\t\taccessorKey: "${column}",\n\t\theader: ${tsStringLiteral(header)},${sortingLine}\n\t},`;
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
	const basePath = resolveUiResourceBasePath(ir);
	const contractKey = ir.resource.contractKey;
	const searchLabel = resolveSearchLabel(ir);
	const titleField = resolveTitleField(ir);
	const columns = ir.admin?.list.columns ?? [];
	const sortableColumns = new Set(toSortableCamelNames(ir));
	const columnDefs = columns.map((column) => renderColumnDef(column, sortableColumns, ir, basePath, titleField)).join("\n");
	const searchableFields = resolveSearchableFieldNames(ir);
	const hasServerSearch = searchableFields.length > 0;
	const mobileCardBlock = renderGeneratedMobileCardBlock(ir, columns);
	const permissionResource = ir.resource.permissionResource;
	const exportableColumnsJson = JSON.stringify(columns);
	const cascadeListInvalidation = renderCascadeListInvalidation(ir);
	const navigationLabel = ir.admin?.navigation?.label ?? ir.resource.plural;
	const navigationLabelLower = navigationLabel.toLowerCase();
	const pageDescription = `Browse and manage ${navigationLabelLower}.`;
	const deleteDescription = ir.softDelete
		? `This action soft-deletes the ${ir.resource.singular.toLowerCase()}.`
		: `This permanently removes the ${ir.resource.singular.toLowerCase()}.`;
	const bulkDeleteDescription = ir.softDelete ? "This action soft-deletes them." : "This permanently removes them.";
	const filterImports = renderViewFilterImports(ir);
	const filterSchemas = renderViewFilterSchemas(ir);
	const filterState = renderViewFilterState(ir);
	const textFilterState = renderViewTextFilterState(ir);
	const filterParsing = renderViewFilterParsing(ir);
	const textFilterParsing = renderViewTextFilterParsing(ir);
	const isFilteredExpression = renderViewIsFilteredExpression(ir, "trimmedSearch.length > 0");
	const clearFiltersBody = renderViewClearFiltersBody(ir, '\t\tsetSearch("");');
	const paginationResetDeps = renderViewPaginationResetDeps(ir);
	const paginationResetSuffix = paginationResetDeps.length > 0 ? `, ${paginationResetDeps}` : "";
	const buildListQueryFilterSpreads = renderViewBuildListQueryFilterSpreads(ir);
	const apiQueryFilterSpreads = renderViewApiQueryFilterSpreads(ir);
	const initialDataFilterGuard = renderViewInitialDataFilterGuard(ir);
	const manualColumnFiltersBlock = renderViewManualColumnFilters(ir);
	const handleManualColumnFilterChangeBlock = renderViewHandleManualColumnFilterChange(ir);
	const tableFiltersBlock = renderViewTableFilters(ir);
	const textFilterHandlersBlock = renderViewTextFilterHandlers(ir);
	const textFilterToolbarBlock = renderViewTextFilterToolbar(ir);
	const dataTableFilterProps = renderViewDataTableFilterProps(ir);
	const hasTableFilters = hasViewTableFilters(ir);
	const hasTextFilters = textFilterToolbarBlock.length > 0;
	const buildListQueryDeps = ["sortBy", "sort?.desc", "trimmedSearch", ...resolveViewBuildListQueryDeps(ir)].join(", ");

	return `"use client";
${filterImports}
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
import { DataTable, type Action, type DataTableFeatures${hasTableFilters ? ", type Filter" : ""} } from "@workspace/ui/components/display/data-table";
import { Button } from "@workspace/ui/components/form/button";
${hasTextFilters ? 'import { Input } from "@workspace/ui/components/form/input";\n' : ""}import type { ColumnDef, SortingState } from "@tanstack/react-table";
import { Eye, Pencil, Trash2 } from "lucide-react";
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

${filterSchemas}const PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50, 100];

const labels = createDataTableLabels({
\tactionsMenuTitle: ${tsStringLiteral(`${ir.resource.singular} actions`)},
\topenRowMenu: ${tsStringLiteral(`Open ${ir.resource.singular.toLowerCase()} row menu`)},
\tsearchPlaceholder: ${tsStringLiteral(`Search ${searchLabel.toLowerCase()}...`)},
\tsearchAriaLabel: ${tsStringLiteral(`Search ${searchLabel}`)},
});

export interface ${model}ViewProps {
\treadonly initialRows?: readonly ${model}[];
\treadonly initialTotal?: number;
\treadonly initialTotalPages?: number;
\treadonly initialHasNext?: boolean;
}

export default function ${model}View({ initialRows, initialTotal, initialTotalPages, initialHasNext }: ${model}ViewProps): React.JSX.Element {
\tconst { api } = useAuth();
\tconst { hasCapability } = useSessionCapabilities();
\tconst canDelete = canDeletePlatformResource(hasCapability, "${permissionResource}");
\tconst { requestDelete, resourceDeleteDialog } = useResourceDeleteDialog();
\tconst router = useRouter();
\tconst queryClient = useQueryClient();
\tconst [search, setSearch] = useState("");
\tconst debouncedSearch = useDebouncedValue(search, 300);
\tconst [sorting, setSorting] = useState<SortingState>([]);
${filterState.length > 0 ? `${filterState}\n` : ""}${textFilterState.length > 0 ? `${textFilterState}\n` : ""}\tconst sort = sorting[0];
\tconst sortBy = resolveListSortBy(sort?.id);
\tconst trimmedSearch = debouncedSearch.trim();
${filterParsing.length > 0 ? `${filterParsing}\n` : ""}${textFilterParsing.length > 0 ? `${textFilterParsing}\n` : ""}\tconst isFiltered = ${isFilteredExpression};

\tconst handleClearFilters = useCallback((): void => {
${clearFiltersBody}
\t}, []);

\tconst buildListQuery = useCallback(
\t\t(listPage: number, limit: number) => {
\t\t\tconst sortDirection: "asc" | "desc" = sort?.desc === true ? "desc" : "asc";
\t\t\treturn {
\t\t\t\tpage: listPage,
\t\t\t\tlimit,
\t\t\t\t...(sortBy !== undefined ? { sortBy, sortDirection } : {}),
\t\t\t\t...(trimmedSearch.length > 0 ? { search: trimmedSearch } : {}),
${buildListQueryFilterSpreads.length > 0 ? `${buildListQueryFilterSpreads}\n` : ""}\t\t\t};
\t\t},
\t\t[${buildListQueryDeps}],
\t);

\tconst fetchAllMatching${model}s = useCallback(async (): Promise<${model}[]> => {
\t\tconst rows = await fetchAllListPages(async (listPage, limit) => {
\t\t\tconst response = await api.${contractKey}.list.fetchOrThrow(buildListQuery(listPage, limit));
\t\t\treturn {
\t\t\t\titems: response.data,
\t\t\t\thasNext: readPaginatedHasNext(response.meta),
\t\t\t};
\t\t});
\t\treturn [...rows];
\t}, [api.${contractKey}.list, buildListQuery]);

\tconst { pageIndex, pageSize, listQuery: paginationQuery, bindListMeta, pagination: basePagination } = useManualHybridPagination<${model}>(
\t\t20,
\t\t[debouncedSearch, sorting${paginationResetSuffix}],
\t\t(item) => item.id,
\t\t{
\t\t\tonClearFilters: handleClearFilters,
\t\t\tisFiltered,
\t\t\tonFetchAllMatching: fetchAllMatching${model}s,
\t\t},
\t);
\tconst initialQueryData = useMemo(
\t\t() =>
\t\t\tinitialRows !== undefined
\t\t\t\t? {
\t\t\t\t\t\tsuccess: true as const,
\t\t\t\t\t\tdata: [...initialRows],
\t\t\t\t\t\tmeta: stubPaginatedMeta(
\t\t\t\t\t\t\t20,
\t\t\t\t\t\t\tinitialTotal ?? initialRows.length,
\t\t\t\t\t\t\t1,
\t\t\t\t\t\t\tinitialTotalPages ?? 1,
\t\t\t\t\t\t\tinitialHasNext ?? false,
\t\t\t\t\t\t),
\t\t\t\t\t}
\t\t\t\t: undefined,
\t\t[initialRows, initialHasNext, initialTotal, initialTotalPages],
\t);
\tconst resourceListQuery = api.${contractKey}.list.useQuery(
\t\t{
\t\t\t...paginationQuery,
\t\t\t...(sortBy !== undefined ? { sortBy, sortDirection: sort?.desc === true ? "desc" : "asc" } : {}),
\t\t\t...(trimmedSearch.length > 0 ? { search: trimmedSearch } : {}),
${apiQueryFilterSpreads.length > 0 ? `${apiQueryFilterSpreads}\n` : ""}\t\t},
\t\t{
\t\t\tplaceholderData: keepPreviousData,
\t\t\tinitialData:
\t\t\t\tpageIndex === 0 && pageSize === 20 && trimmedSearch.length === 0 && sorting.length === 0${initialDataFilterGuard} ? initialQueryData : undefined,
\t\t},
\t);
\tconst rows: ${model}[] = resourceListQuery.data?.data ?? [];
\tconst totalCount = readPaginatedTotal(resourceListQuery.data?.meta, initialTotal ?? initialRows?.length ?? 0);
\tconst pagination = useMemo(() => ({ ...basePagination, totalCount }), [basePagination, totalCount]);
\tconst tableError: string | null = resourceListQuery.isError ? ${tsStringLiteral(`Could not load ${navigationLabelLower}. Clear search or filters and try again.`)} : null;

\tuseEffect((): void => {
\t\tbindListMeta(readPaginatedNextCursor(resourceListQuery.data?.meta) ?? null);
\t}, [bindListMeta, resourceListQuery.data?.meta]);

\tconst handleView = useCallback(
\t\t(item: ${model}): void => {
\t\t\trouter.push(\`${basePath}/\${item.id}\`);
\t\t},
\t\t[router],
\t);

\tconst handleEdit = useCallback(
\t\t(item: ${model}): void => {
\t\t\trouter.push(\`${basePath}/\${item.id}/edit\`);
\t\t},
\t\t[router],
\t);

\tconst deleteMutation = api.${contractKey}.delete.useMutation({
\t\tonSuccess: async () => {
\t\t\ttoastMessage.success({ title: ${tsStringLiteral(`${ir.resource.singular} deleted`)}, description: ${tsStringLiteral(`The ${ir.resource.singular.toLowerCase()} was removed.`)} });
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
\t\t\t\ttitle: \`Delete "\${item.${titleField}}"\` + "?",
\t\t\t\tdescription: ${tsStringLiteral(deleteDescription)},
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
\t\t\t\tdescription: ${tsStringLiteral(bulkDeleteDescription)},
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

\tconst handleManualSortingChange = useCallback((nextSorting: SortingState): void => {
\t\tsetSorting(nextSorting);
\t}, []);

\tconst handleSearchChange = useCallback((value: string): void => {
\t\tsetSearch(value);
\t}, []);

${handleManualColumnFilterChangeBlock.length > 0 ? `${handleManualColumnFilterChangeBlock}\n\n` : ""}${manualColumnFiltersBlock.length > 0 ? `${manualColumnFiltersBlock}\n\n` : ""}${tableFiltersBlock.length > 0 ? `${tableFiltersBlock}\n\n` : ""}${textFilterHandlersBlock.length > 0 ? `${textFilterHandlersBlock}\n\n` : ""}${textFilterToolbarBlock.length > 0 ? `${textFilterToolbarBlock}\n\n` : ""}\tconst searchToolbar = ${
		hasServerSearch || hasTextFilters
			? `useMemo(
\t\t(): React.JSX.Element => (
\t\t\t<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
${
	hasServerSearch
		? `\t\t\t\t<DataTableSearchToolbar
\t\t\t\t\tvalue={search}
\t\t\t\t\tonChange={handleSearchChange}
\t\t\t\t\tplaceholder={labels.searchPlaceholder}
\t\t\t\t\tariaLabel={labels.searchAriaLabel}
\t\t\t\t/>\n`
		: ""
}${hasTextFilters ? "\t\t\t\t{textFilterToolbar}\n" : ""}\t\t\t</div>
\t\t),
\t\t[${[hasServerSearch ? "handleSearchChange, search" : "", hasTextFilters ? "textFilterToolbar" : ""].filter((part) => part.length > 0).join(", ")}],
\t)`
			: "undefined"
	};

\treturn (
\t\t<div className="space-y-6">
\t\t\t<header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
\t\t\t\t<div>
\t\t\t\t\t<h1 className="text-2xl font-semibold tracking-tight">${navigationLabel}</h1>
\t\t\t\t\t<p className="text-sm text-muted-foreground">${pageDescription}</p>
\t\t\t\t</div>
\t\t\t\t<Button nativeButton={false} render={<Link href="${basePath}/create" />}>
\t\t\t\t\tNew ${ir.resource.singular}
\t\t\t\t</Button>
\t\t\t</header>

\t\t\t<Card>
\t\t\t\t<CardHeader>
\t\t\t\t\t<CardTitle className="text-base">
\t\t\t\t\t\t{rows.length > 0 ? \`\${String(rows.length)} ${navigationLabelLower} on this page\` : ${tsStringLiteral(navigationLabel)}}
\t\t\t\t\t</CardTitle>
\t\t\t\t</CardHeader>
\t\t\t\t<CardContent>
\t\t\t\t\t<DataTable
\t\t\t\t\t\tdata={[...rows]}
\t\t\t\t\t\tcolumns={columns}
\t\t\t\t\t\tlabels={labels}
\t\t\t\t\t\tactions={actions}
\t\t\t\t\t\tcheckbox={checkbox}
\t\t\t\t\t\tenableColumnVisibility
${dataTableFilterProps.length > 0 ? `${dataTableFilterProps}\n` : ""}\t\t\t\t\t\tmobileCardRender={mobileCardRender}
\t\t\t\t\t\tonRowClick={handleView}
\t\t\t\t\t\tpagination={pagination}
\t\t\t\t\t\tpageSizeOptions={PAGE_SIZE_OPTIONS}
\t\t\t\t\t\tsorting={sorting}
\t\t\t\t\t\tonManualSortingChange={handleManualSortingChange}
\t\t\t\t\t\tisLoading={resourceListQuery.isLoading}
\t\t\t\t\t\tisRefetching={resourceListQuery.isFetching && !resourceListQuery.isLoading ? true : false}
\t\t\t\t\t\terror={tableError}
\t\t\t\t\t\tsearchKeys={[]}
\t\t\t\t\t\ttoolbarContent={searchToolbar}
\t\t\t\t\t\temptyState={{
\t\t\t\t\t\t\ttitle: isFiltered ? ${tsStringLiteral(`No matching ${navigationLabelLower}`)} : ${tsStringLiteral(`No ${navigationLabelLower} yet`)},
\t\t\t\t\t\t\tdescription: isFiltered
\t\t\t\t\t\t\t\t? "Clear search or filters to see more results."
\t\t\t\t\t\t\t\t: ${tsStringLiteral(`Create your first ${ir.resource.singular.toLowerCase()} to get started.`)},
\t\t\t\t\t\t}}
\t\t\t\t\t/>
\t\t\t\t</CardContent>
\t\t\t</Card>
\t\t\t{resourceDeleteDialog}
\t\t</div>
\t);
}
`;
}

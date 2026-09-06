import type { ResourceIR } from "../../ir/types.js";
import { renderGeneratedMobileCardBlock } from "./render-mobile-card.js";
import { resolveSearchableFieldNames, toSortableCamelNames } from "../nestjs/list-query.js";

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

	return `"use client";

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

import {
	${model}ListSortBySchema,
	type ${model},
	type ${model}ListSortBy,
} from "@workspace/shared/schemas/domain/${slug}.generated";

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

export default function ${model}View(): React.JSX.Element {
\tconst { api } = useAuth();
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
\tconst listQuery = api.${contractKey}.list.useQuery(
\t\t{
\t\t\tpage,
\t\t\tlimit: pageSize,
\t\t\t...(sortBy !== undefined ? { sortBy, sortDirection: sort?.desc === true ? "desc" : "asc" } : {}),
\t\t\t...(trimmedSearch.length > 0 ? { search: trimmedSearch } : {}),
\t\t},
\t\t{ placeholderData: keepPreviousData },
\t);
\tconst rows: ${model}[] = listQuery.data?.data ?? [];
\tconst total = readPaginatedTotal(listQuery.data?.meta, rows.length);

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
\t\t},
\t\tonError: (error) => {
\t\t\ttoastMessage.error({ title: "Delete failed", description: error.message });
\t\t},
\t});

\tconst handleDelete = useCallback(
\t\t(item: ${model}): void => {
\t\t\tconst confirmed = window.confirm(\`Delete "\${item.name}"? This action soft-deletes the ${ir.resource.singular.toLowerCase()}.\`);
\t\t\tif (!confirmed) {
\t\t\t\treturn;
\t\t\t}
\t\t\tdeleteMutation.mutate({ id: item.id });
\t\t},
\t\t[deleteMutation],
\t);

\tconst actions = useMemo((): Action<${model}>[] => {
\t\treturn [
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
\t\t\t{
\t\t\t\tkey: "delete",
\t\t\t\tlabel: "Delete",
\t\t\t\tdescription: "Remove this ${ir.resource.singular.toLowerCase()}",
\t\t\t\ticon: <Trash2 className="size-4" />,
\t\t\t\tonClick: handleDelete,
\t\t\t\tisDestructive: true,
\t\t\t\ticonBgColor: "bg-red-100 dark:bg-red-900/40",
\t\t\t},
\t\t];
\t}, [handleDelete, handleEdit, handleView]);

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
\t\t</div>
\t);
}
`;
}

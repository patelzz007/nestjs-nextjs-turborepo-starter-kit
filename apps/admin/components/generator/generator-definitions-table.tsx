"use client";

import type { ResourceGeneratorListItem } from "@workspace/cli/generator";
import { createDataTableLabels } from "@/lib/data-table-labels";
import { buildReadOnlyTableCheckbox } from "@/lib/data-table-capabilities";
import { DataTableMobileCard } from "@/lib/data-table-mobile-card";
import { GeneratorRollbackDialog } from "@/components/generator/generator-rollback-dialog";
import { DataTable, type Action, type DataTableFeatures } from "@workspace/ui/components/display/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Undo2 } from "lucide-react";
import * as React from "react";

const TABLE_LABELS = createDataTableLabels({
	actionsMenuTitle: "Definition actions",
	openRowMenu: "Open definition row menu",
	searchPlaceholder: "Search definitions…",
	noDataTitle: "No definitions yet",
	noDataDescription: "Create your first resource to get started.",
	noResultsTitle: "No matching definitions",
	noResultsDescription: "Try a different slug, label, or contract key.",
});

const checkbox = buildReadOnlyTableCheckbox("generator-definitions.csv", ["slug", "label", "contractKey", "fieldCount"]);

const columns: ColumnDef<DataTableFeatures, ResourceGeneratorListItem>[] = [
	{
		accessorKey: "slug",
		header: "Slug",
		enableSorting: true,
		cell: ({ row }): React.JSX.Element => <span className="font-medium">{row.original.slug}</span>,
	},
	{
		accessorKey: "label",
		header: "Label",
		enableSorting: true,
	},
	{
		accessorKey: "contractKey",
		header: "Contract",
		enableSorting: true,
		cell: ({ row }): React.JSX.Element => <span className="font-mono text-xs">{row.original.contractKey}</span>,
	},
	{
		accessorKey: "fieldCount",
		header: "Fields",
		enableSorting: true,
		cell: ({ row }): React.JSX.Element => <span className="tabular-nums">{String(row.original.fieldCount)}</span>,
	},
];

export interface GeneratorDefinitionsTableProps {
	readonly resources: readonly ResourceGeneratorListItem[];
	readonly onRollbackSuccess?: () => void;
}

export function GeneratorDefinitionsTable({ resources, onRollbackSuccess }: GeneratorDefinitionsTableProps): React.JSX.Element {
	const rows = React.useMemo(() => [...resources], [resources]);
	const [rollbackTarget, setRollbackTarget] = React.useState<ResourceGeneratorListItem | null>(null);

	const handleRollback = React.useCallback((item: ResourceGeneratorListItem): void => {
		setRollbackTarget(item);
	}, []);

	const actions = React.useMemo((): Action<ResourceGeneratorListItem>[] => {
		return [
			{
				key: "rollback",
				label: "Rollback",
				description: "Remove generated artifacts",
				icon: <Undo2 className="size-4" />,
				onClick: handleRollback,
				isDestructive: true,
				iconBgColor: "bg-destructive/10",
			},
		];
	}, [handleRollback]);

	const mobileCardRender = React.useCallback((item: ResourceGeneratorListItem, cardActions?: Action<ResourceGeneratorListItem>[]): React.ReactNode => {
		return (
			<DataTableMobileCard
				item={item}
				title={item.slug}
				subtitle={item.label}
				fields={[
					{ label: "Contract", value: <span className="font-mono text-xs">{item.contractKey}</span> },
					{ label: "Fields", value: String(item.fieldCount) },
				]}
				actions={cardActions}
			/>
		);
	}, []);

	const handleRollbackOpenChange = React.useCallback((open: boolean): void => {
		if (!open) {
			setRollbackTarget(null);
		}
	}, []);

	return (
		<>
			<DataTable
				data={rows}
				columns={columns}
				labels={TABLE_LABELS}
				actions={actions}
				checkbox={checkbox}
				searchKeys={["slug", "label", "contractKey"]}
				enableColumnVisibility
				exportable
				exportFilename="generator-definitions.csv"
				mobileCardRender={mobileCardRender}
			/>

			{rollbackTarget !== null ? (
				<GeneratorRollbackDialog
					slug={rollbackTarget.slug}
					label={rollbackTarget.label}
					open
					onOpenChange={handleRollbackOpenChange}
					showTrigger={false}
					onSuccess={onRollbackSuccess}
				/>
			) : null}
		</>
	);
}

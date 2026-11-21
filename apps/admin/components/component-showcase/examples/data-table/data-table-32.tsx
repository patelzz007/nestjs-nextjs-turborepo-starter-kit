"use client";

import * as React from "react";
import { z } from "zod";

import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
import { DataTable, type DataTableColumns, type DataTableGrouping, type DataTableHeading } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, getSectionId, NUMERIC_COLUMN_META, SectionStatusBadge, type DocumentSection } from "./data-table-sample";

const groupBySchema = z.enum(["type", "reviewer", "none"]);
type GroupBy = z.output<typeof groupBySchema>;
const GROUP_BY_LABELS: Readonly<Record<GroupBy, string>> = { type: "Type", reviewer: "Reviewer", none: "No grouping" };

// `aggregationFn` names how a column's subtotal combines a group's rows: "sum", "count", "mean", "min" or "max".
// `aggregatedCell` draws the subtotal; without it, the column's own `cell` draws it.
const COLUMNS: DataTableColumns<DocumentSection> = [
	{ accessorKey: "header", header: "Section", size: 260, aggregationFn: "count", aggregatedCell: ({ getValue }): string => `${String(getValue())} sections` },
	{ accessorKey: "type", header: "Type", size: 170 },
	{ accessorKey: "reviewer", header: "Reviewer", size: 180 },
	{ accessorKey: "status", header: "Status", size: 140, cell: ({ row }): React.JSX.Element => <SectionStatusBadge status={row.original.status} /> },
	{ accessorKey: "target", header: "Target", size: 100, aggregationFn: "sum", meta: NUMERIC_COLUMN_META },
	{ accessorKey: "limit", header: "Limit", size: 100, aggregationFn: "sum", meta: NUMERIC_COLUMN_META },
];

/** The table's grouping for a choice: the column to group by, or none. */
export function groupingFor(groupBy: GroupBy): DataTableGrouping {
	return { by: groupBy === "none" ? [] : [groupBy] };
}

/**
 * Rows grouped by a column's value: each group is a row of its own with a toggle, the value, how many sections it
 * holds, and the page totals of its sections. Switch what the sections are grouped by in the heading.
 */
export function DataTable32Example(): React.JSX.Element {
	const [groupBy, setGroupBy] = React.useState<GroupBy>("type");
	const grouping = React.useMemo((): DataTableGrouping => groupingFor(groupBy), [groupBy]);

	const handleGroupByChange = React.useCallback((values: string[]): void => {
		const next = groupBySchema.safeParse(values.at(0));
		if (next.success) {
			setGroupBy(next.data);
		}
	}, []);

	const heading = React.useMemo(
		(): DataTableHeading => ({
			title: "Proposal sections",
			description: "Grouped, with the page budget of each group.",
			actions: (
				<ToggleGroup variant="outline" size="sm" value={[groupBy]} onValueChange={handleGroupByChange} aria-label="Group by">
					{groupBySchema.options.map((option) => (
						<ToggleGroupItem key={option} value={option}>
							{GROUP_BY_LABELS[option]}
						</ToggleGroupItem>
					))}
				</ToggleGroup>
			),
		}),
		[groupBy, handleGroupByChange],
	);

	return <DataTable data={DOCUMENT_SECTIONS} columns={COLUMNS} getRowId={getSectionId} heading={heading} grouping={grouping} />;
}

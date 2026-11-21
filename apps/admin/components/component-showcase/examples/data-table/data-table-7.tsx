"use client";

import * as React from "react";

import { DataTable, type DataTableRowMove, type DataTableRowReorder } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, getSectionId, SECTION_COLUMNS, type DocumentSection } from "./data-table-sample";

const SHOWN_SECTION_COUNT = 6;
const SECTIONS: readonly DocumentSection[] = DOCUMENT_SECTIONS.slice(0, SHOWN_SECTION_COUNT);

/**
 * The rows in the order a move left them. The table names rows by id, so the new order is read from `orderedIds`;
 * a row the table was not showing (hidden by a filter) keeps its place after the ones that were.
 */
export function reorderSections(sections: readonly DocumentSection[], orderedIds: readonly string[]): readonly DocumentSection[] {
	const byId = new Map(sections.map((section) => [section.id, section]));
	const shown = orderedIds.flatMap((id) => {
		const section = byId.get(id);
		return section === undefined ? [] : [section];
	});
	const shownIds = new Set(orderedIds);
	return [...shown, ...sections.filter((section) => !shownIds.has(section.id))];
}

/** Drag a row by its grip, or focus the grip and use Space and the arrow keys. */
export function DataTable7Example(): React.JSX.Element {
	const [sections, setSections] = React.useState<readonly DocumentSection[]>(SECTIONS);

	const rowReorder = React.useMemo(
		(): DataTableRowReorder => ({
			onReorder: (move: DataTableRowMove): void => {
				setSections((current) => reorderSections(current, move.orderedIds));
			},
		}),
		[],
	);

	return <DataTable data={sections} columns={SECTION_COLUMNS} getRowId={getSectionId} rowReorder={rowReorder} />;
}

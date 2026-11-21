"use client";

import { CircleCheck } from "lucide-react";
import * as React from "react";

import { DataTable, type DataTableSelection } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, getSectionId, SECTION_COLUMNS, SECTION_PAGING, type DocumentSection } from "./data-table-sample";

function idsOf(sections: readonly DocumentSection[]): ReadonlySet<string> {
	return new Set(sections.map(getSectionId));
}

/**
 * Row checkboxes open a bar with the bulk actions. A handler is given the ticked rows; rows are tracked by id, so a
 * tick follows its row through a sort or a page change.
 */
export function DataTable4Example(): React.JSX.Element {
	const [sections, setSections] = React.useState<readonly DocumentSection[]>(DOCUMENT_SECTIONS);

	const selection = React.useMemo(
		(): DataTableSelection<DocumentSection> => ({
			bulkActions: [
				{
					key: "mark-done",
					label: "Mark done",
					icon: <CircleCheck aria-hidden="true" />,
					onSelect: (selected: DocumentSection[]): void => {
						const ids = idsOf(selected);
						setSections((current) => current.map((section): DocumentSection => (ids.has(section.id) ? { ...section, status: "Done" } : section)));
					},
				},
			],
			// `onDelete` adds the destructive "Delete selected" action.
			onDelete: (selected: DocumentSection[]): void => {
				const ids = idsOf(selected);
				setSections((current) => current.filter((section) => !ids.has(section.id)));
			},
		}),
		[],
	);

	return <DataTable data={sections} columns={SECTION_COLUMNS} getRowId={getSectionId} selection={selection} paging={SECTION_PAGING} />;
}

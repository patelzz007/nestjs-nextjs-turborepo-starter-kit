"use client";

import type * as React from "react";

import {
	DataTable,
	type DataTableColumnControls,
	type DataTableExporting,
	type DataTableFilter,
	type DataTableLabelsOverride,
	type DataTableSearch,
} from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, getSectionId, SECTION_COLUMNS, SECTION_PAGING, STATUS_FILTER, type DocumentSection } from "./data-table-sample";

/**
 * Only the strings this table words differently. Everything else comes from the kit's language pack, which follows
 * the app's language, so a table needs no labels at all to be translated. Placeholders such as `{from}` are filled
 * in by the table. A module constant: a new object on every render would redraw the table.
 */
const LABELS: DataTableLabelsOverride = {
	searchPlaceholder: "Find a section or a reviewer",
	searchAriaLabel: "Search sections",
	resultsCount: "{filtered} of {total} sections",
	showingResults: "Sections {from} to {to} of {total}",
	showPerPage: "Sections",
	perPage: "a page",
	noResultsTitle: "No section matches",
	noResultsDescription: "Try another word, or clear the status filter.",
	clearFilters: "Show every section",
	columnsToggle: "Fields",
	export: "Download",
};

const SEARCH: DataTableSearch<DocumentSection> = { keys: ["header", "reviewer"] };
const FILTERS: readonly DataTableFilter[] = [STATUS_FILTER];
const COLUMN_CONTROLS: DataTableColumnControls = { visibility: true };
const EXPORTING: DataTableExporting<DocumentSection> = { filename: "proposal-sections" };

/** The same table with its own wording: the search box, the counts, the pager, the menus and the "no match" state. */
export function DataTable27Example(): React.JSX.Element {
	return (
		<DataTable
			data={DOCUMENT_SECTIONS}
			columns={SECTION_COLUMNS}
			getRowId={getSectionId}
			labels={LABELS}
			search={SEARCH}
			filters={FILTERS}
			columnControls={COLUMN_CONTROLS}
			exporting={EXPORTING}
			paging={SECTION_PAGING}
		/>
	);
}

"use client";

import type * as React from "react";

import { DataTable, type DataTableColumnControls, type DataTableHeading, type DataTablePreferences } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, getSectionId, SECTION_COLUMNS, SECTION_PAGING } from "./data-table-sample";

/**
 * A key unique to this table. With it the table remembers the hidden, pinned, moved and resized columns, the sort and
 * the page size, in the browser's local storage by default. Pass `storage` to keep them somewhere else (the account).
 */
const PREFERENCES: DataTablePreferences = { key: "showcase-proposal-sections" };

const COLUMN_CONTROLS: DataTableColumnControls = { visibility: true, pinning: true, resizing: true, reordering: true };

const HEADING: DataTableHeading = {
	title: "Proposal sections",
	description: "Hide a column, sort one, resize another, change the page size, then reload the page: the table comes back as you left it.",
};

export function DataTable28Example(): React.JSX.Element {
	return (
		<DataTable
			data={DOCUMENT_SECTIONS}
			columns={SECTION_COLUMNS}
			getRowId={getSectionId}
			preferences={PREFERENCES}
			columnControls={COLUMN_CONTROLS}
			heading={HEADING}
			paging={SECTION_PAGING}
		/>
	);
}

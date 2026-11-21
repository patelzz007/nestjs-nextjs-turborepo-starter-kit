"use client";

import type * as React from "react";

import { DataTable, type DataTableFilter, type DataTableSearch } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, getSectionId, SECTION_COLUMNS, SECTION_PAGING, STATUS_FILTER, TYPE_FILTER, type DocumentSection } from "./data-table-sample";

/** The search box matches these row fields, by key: any field of the row, shown as a column or not. */
const SEARCH: DataTableSearch<DocumentSection> = { keys: ["header", "reviewer"] };

/** A `select` filter picks one option; a `multi-select` filter picks any number from a searchable list. */
const FILTERS: readonly DataTableFilter[] = [STATUS_FILTER, TYPE_FILTER];

/** Search and filters work together, each option shows how many rows it has, and the toolbar counts the matches. */
export function DataTable2Example(): React.JSX.Element {
	return <DataTable data={DOCUMENT_SECTIONS} columns={SECTION_COLUMNS} getRowId={getSectionId} search={SEARCH} filters={FILTERS} paging={SECTION_PAGING} />;
}

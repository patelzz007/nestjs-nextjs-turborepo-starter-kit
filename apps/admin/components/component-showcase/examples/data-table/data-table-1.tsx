"use client";

import type * as React from "react";

import { DataTable, type DataTableHeading } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, getSectionId, SECTION_COLUMNS, SECTION_PAGING } from "./data-table-sample";

const HEADING: DataTableHeading = { title: "Proposal sections", description: "Every section of the proposal, with its page budget and reviewer." };

/** The three props every table needs (`data`, `columns`, `getRowId`), a heading and a pager. Click a header to sort. */
export function DataTable1Example(): React.JSX.Element {
	return <DataTable data={DOCUMENT_SECTIONS} columns={SECTION_COLUMNS} getRowId={getSectionId} heading={HEADING} paging={SECTION_PAGING} />;
}

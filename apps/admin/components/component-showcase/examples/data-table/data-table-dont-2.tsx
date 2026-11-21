"use client";

import type * as React from "react";

import { DataTable } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, getSectionId, SECTION_COLUMNS, type DocumentSection } from "./data-table-sample";

const SHOWN_SECTION_COUNT = 3;
const SECTIONS: readonly DocumentSection[] = DOCUMENT_SECTIONS.slice(0, SHOWN_SECTION_COUNT);

export function DataTableDont2Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-sm">
			<DataTable data={SECTIONS} columns={SECTION_COLUMNS} getRowId={getSectionId} />
		</div>
	);
}

"use client";

import type * as React from "react";

import { DataTable, type DataTableDetail } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, getSectionId, SECTION_COLUMNS, SECTION_PAGING, type DocumentSection } from "./data-table-sample";

/** The fields that do not earn a column: shown only for the row the reader opens. */
function renderSectionDetail(section: DocumentSection): React.JSX.Element {
	const remaining = section.limit - section.target;
	return (
		<dl className="grid gap-x-8 gap-y-2 p-4 text-sm sm:grid-cols-3">
			<div>
				<dt className="text-muted-foreground">Reviewer</dt>
				<dd className="font-medium">{section.reviewer}</dd>
			</div>
			<div>
				<dt className="text-muted-foreground">Page budget</dt>
				<dd className="font-medium tabular-nums">
					{section.target} planned of {section.limit} allowed
				</dd>
			</div>
			<div>
				<dt className="text-muted-foreground">{remaining < 0 ? "Over the limit by" : "Pages to spare"}</dt>
				<dd className="font-medium tabular-nums">{Math.abs(remaining)}</dd>
			</div>
		</dl>
	);
}

const DETAIL: DataTableDetail<DocumentSection> = { render: renderSectionDetail };

/** A toggle at the start of each row opens a full-width row under it. Any number of rows can be open at once. */
export function DataTable22Example(): React.JSX.Element {
	return <DataTable data={DOCUMENT_SECTIONS} columns={SECTION_COLUMNS} getRowId={getSectionId} detail={DETAIL} paging={SECTION_PAGING} />;
}

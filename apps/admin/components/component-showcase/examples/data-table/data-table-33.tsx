"use client";

import type * as React from "react";

import { DataTable, type DataTableDetail } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, getSectionId, SECTION_COLUMNS, SECTION_PAGING, SectionStatusBadge, type DocumentSection } from "./data-table-sample";

/** The panel's heading for a section. */
export function sectionPanelTitle(section: DocumentSection): string {
	return section.header;
}

/** Everything about one section, laid out for a narrow panel. */
function renderSectionPanel(section: DocumentSection): React.JSX.Element {
	const pagesToSpare = section.limit - section.target;
	return (
		<dl className="grid gap-4 text-sm">
			<div className="grid gap-1">
				<dt className="text-muted-foreground">Status</dt>
				<dd>
					<SectionStatusBadge status={section.status} />
				</dd>
			</div>
			<div className="grid gap-1">
				<dt className="text-muted-foreground">Type</dt>
				<dd className="font-medium">{section.type}</dd>
			</div>
			<div className="grid gap-1">
				<dt className="text-muted-foreground">Reviewer</dt>
				<dd className="font-medium">{section.reviewer}</dd>
			</div>
			<div className="grid gap-1">
				<dt className="text-muted-foreground">Page budget</dt>
				<dd className="font-medium tabular-nums">
					{section.target} planned of {section.limit} allowed ({pagesToSpare < 0 ? `${String(-pagesToSpare)} over` : `${String(pagesToSpare)} to spare`})
				</dd>
			</div>
		</dl>
	);
}

/** The panel shows the type and the reviewer, so the table hides those columns while it is open to make room. */
const DETAIL: DataTableDetail<DocumentSection> = {
	mode: "panel",
	render: renderSectionPanel,
	title: sectionPanelTitle,
	hideColumnsWhileOpen: ["type", "reviewer"],
};

/**
 * Click a row (or press Enter on it) to open its details beside the table. In the panel, ↑ and ↓ move to the previous
 * and next row and Escape closes it. On a narrow screen the panel is a sheet; a search that hides the row closes it.
 */
export function DataTable33Example(): React.JSX.Element {
	return <DataTable data={DOCUMENT_SECTIONS} columns={SECTION_COLUMNS} getRowId={getSectionId} detail={DETAIL} paging={SECTION_PAGING} />;
}

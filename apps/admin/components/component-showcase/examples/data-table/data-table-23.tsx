"use client";

import type * as React from "react";

import { DataTable, type DataTableColumns, type DataTableDetail, type DataTableLayout } from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, getSectionId, SECTION_COLUMNS, SECTION_PAGING, type DocumentSection } from "./data-table-sample";

/** One saved revision of a section. */
interface Revision {
	readonly id: string;
	readonly version: string;
	readonly author: string;
	readonly change: string;
}

const CHANGES: readonly string[] = ["First draft", "Reviewer comments addressed", "Shortened to fit the limit"];

/** Sample revisions: three per section, written by the section's reviewer. */
function revisionsOf(section: DocumentSection): readonly Revision[] {
	return CHANGES.map((change, index) => ({ id: `${section.id}-r${String(index + 1)}`, version: `v${String(index + 1)}`, author: section.reviewer, change }));
}

function getRevisionId(revision: Revision): string {
	return revision.id;
}

const REVISION_COLUMNS: DataTableColumns<Revision> = [
	{ accessorKey: "version", header: "Version", size: 100 },
	{ accessorKey: "change", header: "Change", size: 320 },
	{ accessorKey: "author", header: "Author", size: 200 },
];

const REVISION_LAYOUT: DataTableLayout = { density: "compact" };

/** The opened row holds a table of its own: the same component, given the child rows. */
function renderRevisions(section: DocumentSection): React.JSX.Element {
	return (
		<div className="p-3">
			<DataTable data={revisionsOf(section)} columns={REVISION_COLUMNS} getRowId={getRevisionId} layout={REVISION_LAYOUT} />
		</div>
	);
}

const DETAIL: DataTableDetail<DocumentSection> = { render: renderRevisions };

/** Open a section to see its revisions in a table of their own, with their own columns and sort. */
export function DataTable23Example(): React.JSX.Element {
	return <DataTable data={DOCUMENT_SECTIONS} columns={SECTION_COLUMNS} getRowId={getSectionId} detail={DETAIL} paging={SECTION_PAGING} />;
}

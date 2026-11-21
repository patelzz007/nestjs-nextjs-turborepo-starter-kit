"use client";

import { Eye } from "lucide-react";
import type * as React from "react";

import { DataTable, type DataTableRowAction } from "@workspace/ui/components/data-table";
import { toastMessage } from "@workspace/ui/components/toast";

import { DataTableMobileCard } from "@/lib/data-table/mobile-card";

import { DOCUMENT_SECTIONS, getSectionId, SECTION_COLUMNS, SECTION_PAGING, SectionStatusBadge, type DocumentSection } from "./data-table-sample";

function viewSection(section: DocumentSection): void {
	toastMessage.info({ title: `Viewing "${section.header}"` });
}

const ROW_ACTIONS: readonly DataTableRowAction<DocumentSection>[] = [
	{ key: "view", label: "View", description: "Open the whole section", icon: <Eye aria-hidden="true" />, onSelect: viewSection },
];

/** One row as a card. It is given the row and the row actions, and decides which fields a phone shows. */
function renderSectionCard(section: DocumentSection, rowActions: readonly DataTableRowAction<DocumentSection>[]): React.JSX.Element {
	return (
		<DataTableMobileCard
			item={section}
			title={section.header}
			subtitle={section.type}
			badge={<SectionStatusBadge status={section.status} />}
			fields={[
				{ label: "Target", value: section.target },
				{ label: "Limit", value: section.limit },
				{ label: "Reviewer", value: section.reviewer },
			]}
			actions={rowActions}
		/>
	);
}

/**
 * When the table is narrower than 640px each row is drawn by `mobileCard`. It is the table's own width that counts,
 * not the window's, so the cards also appear in a narrow side panel. Narrow the window to see them.
 */
export function DataTable14Example(): React.JSX.Element {
	return (
		<DataTable data={DOCUMENT_SECTIONS} columns={SECTION_COLUMNS} getRowId={getSectionId} mobileCard={renderSectionCard} rowActions={ROW_ACTIONS} paging={SECTION_PAGING} />
	);
}

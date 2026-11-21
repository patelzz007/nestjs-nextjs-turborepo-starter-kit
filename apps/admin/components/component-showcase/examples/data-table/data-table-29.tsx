"use client";

// The DataTable kitchen sink: every everyday feature at once, as the dashboard home page shows it.
//
// This file is the SMART layer. It owns the rows, the columns, the filters, the actions, the card a phone shows and
// every string. `DataTable` stays dumb: it is told everything through props and knows nothing about proposals.

import { CircleCheck, Copy, Eye, Plus, Trash2 } from "lucide-react";
import * as React from "react";

import { Button } from "@workspace/ui/components/button";
import {
	DataTable,
	type DataTableCellEdit,
	type DataTableColumnControls,
	type DataTableColumns,
	type DataTableEditing,
	type DataTableExporting,
	type DataTableFilter,
	type DataTableHeading,
	type DataTableLabelsOverride,
	type DataTablePreferences,
	type DataTableRowAction,
	type DataTableSearch,
	type DataTableSelection,
} from "@workspace/ui/components/data-table";
import { toastMessage } from "@workspace/ui/components/toast";

import { DataTableMobileCard } from "@/lib/data-table/mobile-card";

import {
	DOCUMENT_SECTIONS,
	getSectionId,
	NUMERIC_COLUMN_META,
	parsePageCount,
	SECTION_PAGING,
	SectionStatusBadge,
	STATUS_FILTER,
	TYPE_FILTER,
	withSectionValue,
	type DocumentSection,
} from "./data-table-sample";

// The section title, the page budget and the reviewer are edited in place.
const COLUMNS: DataTableColumns<DocumentSection> = [
	{
		accessorKey: "header",
		header: "Section",
		size: 260,
		enableHiding: false,
		meta: { cellEdit: {} },
		cell: ({ row }): React.JSX.Element => <span className="font-medium">{row.original.header}</span>,
	},
	{ accessorKey: "type", header: "Type", size: 170 },
	{ accessorKey: "status", header: "Status", size: 140, cell: ({ row }): React.JSX.Element => <SectionStatusBadge status={row.original.status} /> },
	{ accessorKey: "target", header: "Target", size: 100, meta: { ...NUMERIC_COLUMN_META, cellEdit: { parse: parsePageCount } } },
	{ accessorKey: "limit", header: "Limit", size: 100, meta: { ...NUMERIC_COLUMN_META, cellEdit: { parse: parsePageCount } } },
	{ accessorKey: "reviewer", header: "Reviewer", size: 180, meta: { cellEdit: {} } },
];

const SEARCH: DataTableSearch<DocumentSection> = { keys: ["header", "reviewer"] };
const FILTERS: readonly DataTableFilter[] = [STATUS_FILTER, TYPE_FILTER];
const COLUMN_CONTROLS: DataTableColumnControls = { visibility: true, pinning: true, resizing: true, reordering: true, density: true };
const EXPORTING: DataTableExporting<DocumentSection> = { filename: "proposal-sections" };
const PREFERENCES: DataTablePreferences = { key: "dashboard-proposal-sections" };

/** Only the strings that differ from the kit's own copy. */
const LABELS: DataTableLabelsOverride = { actionsMenuTitle: "Section actions", openRowMenu: "Open section row menu" };

function idsOf(sections: readonly DocumentSection[]): ReadonlySet<string> {
	return new Set(sections.map(getSectionId));
}

function viewSection(section: DocumentSection): void {
	toastMessage.info({ title: `Viewing "${section.header}"`, description: `Section type: ${section.type}` });
}

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

export function DataTable29Example(): React.JSX.Element {
	// Edits, copies and deletes change DATA, so the rows live here, not in the table.
	const [sections, setSections] = React.useState<readonly DocumentSection[]>(DOCUMENT_SECTIONS);

	const handleAdd = React.useCallback((): void => {
		setSections((current) => [
			{ id: `s-new-${String(current.length + 1)}`, header: "Untitled section", type: "Narrative", status: "In Process", target: 0, limit: 0, reviewer: "" },
			...current,
		]);
	}, []);

	const heading = React.useMemo(
		(): DataTableHeading => ({
			title: "Proposal sections",
			description: "Search, filter, sort, edit, select and export, in one table.",
			actions: (
				<Button size="sm" onClick={handleAdd}>
					<Plus aria-hidden="true" />
					Add section
				</Button>
			),
		}),
		[handleAdd],
	);

	const rowActions = React.useMemo(
		(): readonly DataTableRowAction<DocumentSection>[] => [
			{ key: "view", label: "View", description: "Open the whole section", icon: <Eye aria-hidden="true" />, onSelect: viewSection },
			{
				key: "duplicate",
				label: "Duplicate",
				description: "Adds a copy under this section",
				icon: <Copy aria-hidden="true" />,
				onSelect: (section: DocumentSection): void => {
					setSections((current) => {
						const copy: DocumentSection = { ...section, id: `${section.id}-copy-${String(current.length)}`, header: `${section.header} (copy)` };
						const position = current.findIndex((entry) => entry.id === section.id);
						return [...current.slice(0, position + 1), copy, ...current.slice(position + 1)];
					});
				},
			},
			{
				key: "delete",
				label: "Delete",
				description: "Remove this section from the proposal",
				icon: <Trash2 aria-hidden="true" />,
				tone: "destructive",
				onSelect: (section: DocumentSection): void => {
					setSections((current) => current.filter((entry) => entry.id !== section.id));
				},
			},
		],
		[],
	);

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
			onDelete: (selected: DocumentSection[]): void => {
				const ids = idsOf(selected);
				setSections((current) => current.filter((section) => !ids.has(section.id)));
			},
		}),
		[],
	);

	const editing = React.useMemo(
		(): DataTableEditing<DocumentSection> => ({
			onCellEdit: (edit: DataTableCellEdit<DocumentSection>): void => {
				setSections((current) => current.map((section) => (section.id === edit.rowId ? withSectionValue(section, edit.columnId, edit.value) : section)));
			},
		}),
		[],
	);

	return (
		<DataTable
			data={sections}
			columns={COLUMNS}
			getRowId={getSectionId}
			heading={heading}
			search={SEARCH}
			filters={FILTERS}
			paging={SECTION_PAGING}
			rowActions={rowActions}
			selection={selection}
			exporting={EXPORTING}
			columnControls={COLUMN_CONTROLS}
			editing={editing}
			mobileCard={renderSectionCard}
			preferences={PREFERENCES}
			labels={LABELS}
		/>
	);
}

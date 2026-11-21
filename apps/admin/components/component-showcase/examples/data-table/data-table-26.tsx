"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import * as React from "react";

import { Button } from "@workspace/ui/components/button";
import {
	DataTable,
	type DataTableCellEdit,
	type DataTableDraftRows,
	type DataTableColumns,
	type DataTableEditing,
	type DataTableHeading,
	type DataTableRowAction,
	type DataTableRowStatus,
} from "@workspace/ui/components/data-table";

import { DOCUMENT_SECTIONS, getSectionId, NUMERIC_COLUMN_META, parsePageCount, SectionStatusBadge, withSectionValue, type DocumentSection } from "./data-table-sample";

const SHOWN_SECTION_COUNT = 5;
const SAVED_SECTIONS: readonly DocumentSection[] = DOCUMENT_SECTIONS.slice(0, SHOWN_SECTION_COUNT);

/** Each unsaved row's mark, by row id. A row with no entry is as saved. */
type Marks = Readonly<Record<string, DataTableRowStatus>>;
const NO_MARKS: Marks = {};

/** The draft: the rows as edited, and what is unsaved about them. One object, so every change is one state update. */
export interface Draft {
	readonly sections: readonly DocumentSection[];
	readonly marks: Marks;
	/** How many sections were added, so each new one gets its own id. */
	readonly addedCount: number;
}

export const SAVED_DRAFT: Draft = { sections: SAVED_SECTIONS, marks: NO_MARKS, addedCount: 0 };

function withoutMark(marks: Marks, id: string): Marks {
	return Object.fromEntries(Object.entries(marks).filter(([key]) => key !== id));
}

export function addSection(draft: Draft): Draft {
	const id = `new-${String(draft.addedCount + 1)}`;
	const section: DocumentSection = { id, header: "Untitled section", type: "Narrative", status: "In Process", target: 0, limit: 0, reviewer: "" };
	return { sections: [...draft.sections, section], marks: { ...draft.marks, [id]: "new" }, addedCount: draft.addedCount + 1 };
}

/** An edit marks a saved row dirty. A new row stays new: it is unsaved either way. */
export function editSection(draft: Draft, edit: DataTableCellEdit<DocumentSection>): Draft {
	return {
		...draft,
		sections: draft.sections.map((section) => (section.id === edit.rowId ? withSectionValue(section, edit.columnId, edit.value) : section)),
		marks: draft.marks[edit.rowId] === undefined ? { ...draft.marks, [edit.rowId]: "dirty" } : draft.marks,
	};
}

/** A new row is dropped at once; a saved row is marked deleted until the save, and the same action restores it. */
export function toggleDeleted(draft: Draft, id: string): Draft {
	const mark = draft.marks[id];
	if (mark === "new") {
		return { ...draft, sections: draft.sections.filter((section) => section.id !== id), marks: withoutMark(draft.marks, id) };
	}
	return { ...draft, marks: mark === "deleted" ? withoutMark(draft.marks, id) : { ...draft.marks, [id]: "deleted" } };
}

/** Saving removes the rows marked deleted and clears every mark. */
export function saveDraft(draft: Draft): Draft {
	return { ...draft, sections: draft.sections.filter((section) => draft.marks[section.id] !== "deleted"), marks: NO_MARKS };
}

const COLUMNS: DataTableColumns<DocumentSection> = [
	{ accessorKey: "header", header: "Section", size: 260, meta: { cellEdit: {} } },
	{ accessorKey: "status", header: "Status", size: 140, cell: ({ row }): React.JSX.Element => <SectionStatusBadge status={row.original.status} /> },
	{ accessorKey: "target", header: "Target", size: 100, meta: { ...NUMERIC_COLUMN_META, cellEdit: { parse: parsePageCount } } },
	{ accessorKey: "limit", header: "Limit", size: 100, meta: { ...NUMERIC_COLUMN_META, cellEdit: { parse: parsePageCount } } },
	{ accessorKey: "reviewer", header: "Reviewer", size: 180, meta: { cellEdit: {} } },
];

/**
 * Create, edit and delete with nothing written until Save. `rowStatus` tells the table each row's mark: "new" and
 * "dirty" tint the row, "deleted" mutes and strikes it. What the marks mean, and when they clear, stays here.
 */
export function DataTable26Example(): React.JSX.Element {
	const [draft, setDraft] = React.useState<Draft>(SAVED_DRAFT);
	const [saved, setSaved] = React.useState<Draft>(SAVED_DRAFT);
	const unsavedCount = Object.keys(draft.marks).length;

	const handleAdd = React.useCallback((): void => {
		setDraft(addSection);
	}, []);
	const handleSave = React.useCallback((): void => {
		const next = saveDraft(draft);
		setDraft(next);
		setSaved(next);
	}, [draft]);
	const handleDiscard = React.useCallback((): void => {
		setDraft(saved);
	}, [saved]);

	const getRowStatus = React.useCallback((section: DocumentSection): DataTableRowStatus | undefined => draft.marks[section.id], [draft.marks]);

	const editing = React.useMemo(
		(): DataTableEditing<DocumentSection> => ({
			onCellEdit: (edit: DataTableCellEdit<DocumentSection>): void => {
				setDraft((current) => editSection(current, edit));
			},
		}),
		[],
	);

	const rowActions = React.useMemo(
		(): readonly DataTableRowAction<DocumentSection>[] => [
			{
				key: "delete",
				label: "Delete or restore",
				description: "Marks the section for deletion, or takes the mark off",
				icon: <Trash2 aria-hidden="true" />,
				tone: "destructive",
				onSelect: (section: DocumentSection): void => {
					setDraft((current) => toggleDeleted(current, section.id));
				},
			},
		],
		[],
	);

	const heading = React.useMemo(
		(): DataTableHeading => ({
			title: "Proposal sections",
			description: unsavedCount === 0 ? "Everything is saved." : `${String(unsavedCount)} unsaved ${unsavedCount === 1 ? "change" : "changes"}`,
			actions: (
				<div className="flex flex-wrap gap-2">
					<Button size="sm" variant="ghost" disabled={unsavedCount === 0} onClick={handleDiscard}>
						<RotateCcw aria-hidden="true" />
						Discard
					</Button>
					<Button size="sm" disabled={unsavedCount === 0} onClick={handleSave}>
						Save
					</Button>
				</div>
			),
		}),
		[unsavedCount, handleDiscard, handleSave],
	);

	// The "add row" button under the last row: the new section appears where the button was, marked new.
	const draftRows = React.useMemo((): DataTableDraftRows => ({ onCreate: handleAdd, label: "Add section" }), [handleAdd]);

	return (
		<DataTable
			data={draft.sections}
			columns={COLUMNS}
			getRowId={getSectionId}
			heading={heading}
			rowStatus={getRowStatus}
			draftRows={draftRows}
			editing={editing}
			rowActions={rowActions}
		/>
	);
}

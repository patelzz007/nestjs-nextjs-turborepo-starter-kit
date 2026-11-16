// The DataTable kitchen sink: every feature at once, as an app's screen uses it.
//
// The smart layer for the shared `DataTable` (rules/03, rules/04): it owns the rows, the columns, the filters, the
// row and bulk actions, the card and every string. The kit's `DataTable` stays presentational — it receives
// everything through props and knows nothing about the domain. A switch shows the same table as cards.

import type {
	DataTableBulkSelectionContext,
	DataTableCellScalar,
	DataTableCheckboxConfig,
	DataTablePersistedPrefs,
	DataTablePersistedPrefsPatch,
	DataTableStorageAdapter,
} from "@workspace/ui-kit-logic";
import { DataTable, type DataTableAction, type DataTableBoundAction, type DataTableEmptyState, type DataTableFilter } from "@workspace/ui-native/components/data-table";
import { DataTableCard, type DataTableCardField } from "@workspace/ui-native/components/data-table-card";
import type { LucideIcon } from "@workspace/ui-native/components/icon";
import { SegmentedControl, type SegmentedOption } from "@workspace/ui-native/components/segmented-control";
import type { NativeDataTableLabels } from "@workspace/ui-native/lib/data-table";
import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import CopyIcon from "lucide-react-native/icons/copy";
import EyeIcon from "lucide-react-native/icons/eye";
import PencilIcon from "lucide-react-native/icons/pencil";
import Trash2Icon from "lucide-react-native/icons/trash-2";
import * as React from "react";
import { View } from "react-native";

import { useToast } from "../../../toast/facade";
import { reorderSections } from "./data-table-7";
import { type DocumentSection, DOCUMENT_SECTIONS, SECTION_COLUMNS, SECTION_PAGINATION, SectionStatusBadge, STATUS_FILTER, TYPE_FILTER } from "./data-table-sample";

type Layout = "table" | "cards";

const LAYOUTS: readonly SegmentedOption<Layout>[] = [
	{ value: "table", label: "Table" },
	{ value: "cards", label: "Cards" },
];

const FILTERS: readonly DataTableFilter[] = [STATUS_FILTER, TYPE_FILTER];
const SEARCH_KEYS: readonly string[] = ["header", "reviewer"];
const EDITABLE_COLUMNS: readonly string[] = ["header", "target", "limit", "reviewer"];
const PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS: readonly number[] = [10, 20, 50];
const SEARCH_DEBOUNCE_MS = 200;
const PERSIST_KEY = "showcase-data-table-kitchen-sink";
const EMPTY: DataTableEmptyState = { title: "No sections found", description: "Try adjusting your search or filter criteria." };

/** Only the strings that differ from the kit's copy. */
const LABELS: Partial<NativeDataTableLabels> = { actionsMenuTitle: "Section actions", openRowMenu: "Open section row menu" };

/** Column labels for the edit toast (the table reports the column id). */
const COLUMN_LABELS: Readonly<Record<string, string>> = { header: "Section", target: "Target", limit: "Limit", reviewer: "Reviewer" };

/** Remembered for as long as the app runs (an app keeps them across launches in its key-value store). */
const saved = new Map<string, DataTablePersistedPrefs>();
const SESSION_STORAGE: DataTableStorageAdapter = {
	read: (key: string): DataTablePersistedPrefs | null => saved.get(key) ?? null,
	write: (key: string, patch: DataTablePersistedPrefsPatch): void => {
		saved.set(key, { ...saved.get(key), ...patch });
	},
};

function isSectionField(columnId: string): columnId is "header" | "target" | "limit" | "reviewer" {
	return EDITABLE_COLUMNS.includes(columnId);
}

function countOf(rows: readonly DocumentSection[], context: DataTableBulkSelectionContext): string {
	const count = context.selectAllPages ? context.totalMatchingRows : rows.length;
	return `${String(count)} section${count === 1 ? "" : "s"}`;
}

function fieldsOf(item: DocumentSection): readonly DataTableCardField[] {
	return [
		{ label: "Type", value: item.type },
		{ label: "Target", value: item.target },
		{ label: "Limit", value: item.limit },
	];
}

function renderSectionCard(item: DocumentSection, actions: readonly DataTableBoundAction[]): React.ReactNode {
	return <DataTableCard title={item.header} subtitle={item.reviewer} badge={<SectionStatusBadge status={item.status} />} fields={fieldsOf(item)} actions={actions} />;
}

export function DataTable14Example(): React.JSX.Element {
	const toast = useToast();
	const [layout, setLayout] = React.useState<Layout>("table");
	// Edits and reorders are data changes: the smart layer owns them, so the rows live in state.
	const [rows, setRows] = React.useState<readonly DocumentSection[]>(DOCUMENT_SECTIONS);

	const actions = React.useMemo(
		(): DataTableAction<DocumentSection>[] => [
			{
				key: "view",
				label: "View",
				description: "Open the section preview",
				icon: EyeIcon,
				onPress: (row: DocumentSection): void => {
					toast.info(`Section type: ${row.type}`, { title: `Viewing “${row.header}”` });
				},
			},
			{
				key: "edit",
				label: "Edit",
				description: "Edit section details",
				icon: PencilIcon,
				onPress: (row: DocumentSection): void => {
					toast.success(`Editing “${row.header}”`);
				},
			},
			{
				key: "duplicate",
				label: "Make a copy",
				description: "Duplicate this section",
				icon: CopyIcon,
				onPress: (row: DocumentSection): void => {
					toast.success(`Duplicated “${row.header}”`);
				},
			},
			{
				key: "delete",
				label: "Delete",
				description: "Remove this section permanently",
				icon: Trash2Icon,
				variant: "destructive",
				onPress: (row: DocumentSection): void => {
					toast.error("This is a demo: no data was removed.", { title: `Deleted “${row.header}”` });
				},
			},
		],
		[toast],
	);

	const checkbox = React.useMemo(
		(): DataTableCheckboxConfig<DocumentSection, LucideIcon> => ({
			onDeleteAll: (selected: DocumentSection[], context: DataTableBulkSelectionContext): void => {
				const ids = new Set(selected.map(({ id }): number => id));
				setRows((current): readonly DocumentSection[] => (context.selectAllPages ? [] : current.filter((row): boolean => !ids.has(row.id))));
				toast.success(`Removed ${countOf(selected, context)}`);
			},
			bulkActions: [
				{
					key: "mark-done",
					label: "Mark as done",
					icon: CircleCheckIcon,
					onClick: (selected: DocumentSection[], context: DataTableBulkSelectionContext): void => {
						const ids = new Set(selected.map(({ id }): number => id));
						setRows((current): readonly DocumentSection[] =>
							current.map((row): DocumentSection => (context.selectAllPages || ids.has(row.id) ? { ...row, status: "Done" } : row)),
						);
						toast.success(`Marked ${countOf(selected, context)} as done`);
					},
				},
			],
			export: true,
			exportFilename: "document-sections",
			exportableColumns: ["header", "type", "status", "target", "limit", "reviewer"],
		}),
		[toast],
	);

	const handleRowPress = React.useCallback(
		(row: DocumentSection): void => {
			toast.info("The ⋯ menu holds the row's actions.", { title: `Opened “${row.header}”` });
		},
		[toast],
	);
	// The table reports the column id and the row: the edit lands on the record by its id.
	const handleCellEdit = React.useCallback(
		(_rowIndex: number, columnId: string, value: DataTableCellScalar, row: DocumentSection): void => {
			if (!isSectionField(columnId)) {
				return;
			}
			const text = value === null ? "" : String(value);
			setRows((current): readonly DocumentSection[] => current.map((item): DocumentSection => (item.id === row.id ? { ...item, [columnId]: text } : item)));
			toast.success(`${COLUMN_LABELS[columnId] ?? columnId} → ${text}`, { title: `Updated “${row.header}”` });
		},
		[toast],
	);
	const handleRowReorder = React.useCallback(
		(fromIndex: number, toIndex: number, visibleRows: DocumentSection[]): void => {
			setRows((current): readonly DocumentSection[] => reorderSections(current, visibleRows, fromIndex, toIndex));
			const moved = visibleRows.at(fromIndex);
			if (moved !== undefined) {
				toast.success(`Reordered “${moved.header}”`);
			}
		},
		[toast],
	);

	return (
		<View className="w-full gap-4">
			<SegmentedControl label="Layout" options={LAYOUTS} value={layout} onChange={setLayout} />
			<DataTable
				data={rows}
				columns={SECTION_COLUMNS}
				pagination={SECTION_PAGINATION}
				title="Document sections"
				description="Every smart choice (columns, filters, actions, copy) is owned here; the shared table just renders it."
				searchKeys={SEARCH_KEYS}
				searchDebounceMs={SEARCH_DEBOUNCE_MS}
				filters={FILTERS}
				actions={actions}
				labels={LABELS}
				checkbox={checkbox}
				enableColumnVisibility
				enableColumnPinning
				persistKey={PERSIST_KEY}
				storage={SESSION_STORAGE}
				pageSize={PAGE_SIZE}
				pageSizeOptions={PAGE_SIZE_OPTIONS}
				sortCycle="asc-desc-none"
				onRowPress={handleRowPress}
				editable
				editableColumns={EDITABLE_COLUMNS}
				onCellEdit={handleCellEdit}
				draggable
				onRowReorder={handleRowReorder}
				renderCard={layout === "cards" ? renderSectionCard : undefined}
				emptyState={EMPTY}
			/>
		</View>
	);
}

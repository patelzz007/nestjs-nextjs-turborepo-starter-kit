import type { DataTablePersistedPrefs, DataTablePersistedPrefsPatch, DataTableStorageAdapter } from "@workspace/ui-kit-logic";
import { DataTable } from "@workspace/ui-native/components/data-table";
import * as React from "react";

import { DOCUMENT_SECTIONS, SECTION_COLUMNS, SECTION_PAGINATION } from "./data-table-sample";

const PAGE_SIZE = 5;
/** Where the hidden columns, the pinned columns and the page size are remembered for this table. */
const PERSIST_KEY = "showcase-data-table-columns";

/**
 * Preferences kept for as long as the app runs: leave the screen and come back, and the columns are as you left
 * them. An app keeps them across launches with a storage adapter over its key-value store.
 */
const saved = new Map<string, DataTablePersistedPrefs>();
const SESSION_STORAGE: DataTableStorageAdapter = {
	read: (key: string): DataTablePersistedPrefs | null => saved.get(key) ?? null,
	write: (key: string, patch: DataTablePersistedPrefsPatch): void => {
		saved.set(key, { ...saved.get(key), ...patch });
	},
};

export function DataTable8Example(): React.JSX.Element {
	return (
		<DataTable
			data={DOCUMENT_SECTIONS}
			columns={SECTION_COLUMNS}
			enableColumnVisibility
			enableColumnPinning
			persistKey={PERSIST_KEY}
			storage={SESSION_STORAGE}
			pagination={SECTION_PAGINATION}
			pageSize={PAGE_SIZE}
			title="Columns"
			description="Hide columns, pin them to the start, and find them the same way when you come back."
		/>
	);
}

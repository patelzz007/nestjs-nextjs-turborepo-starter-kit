import { isBrowserRuntime } from "@workspace/shared";
import {
	parseDataTablePersistedPrefs,
	parseDataTablePrefsPatch,
	type DataTablePersistedPrefs,
	type DataTablePersistedPrefsPatch,
	type DataTableStorageAdapter,
} from "@workspace/ui-kit-logic";

export type { DataTableStorageAdapter } from "@workspace/ui-kit-logic";

// v2: the saved shape gained column order, column widths and density, and the table's props were redesigned. A new
// prefix means an entry saved by the old table is never read back as if it were a new one.
const STORAGE_PREFIX = "datatable:v2:";

/** Default adapter backed by `window.localStorage` (browser only). */
export function createLocalStorageDataTableStorage(namespace = "default"): DataTableStorageAdapter {
	const prefix = `${STORAGE_PREFIX}${namespace}:`;

	return {
		read(key: string): DataTablePersistedPrefs | null {
			if (!isBrowserRuntime()) {
				return null;
			}
			const saved = window.localStorage.getItem(`${prefix}${key}`);
			if (saved === null) {
				return null;
			}
			return parseDataTablePersistedPrefs(saved);
		},
		write(key: string, patch: DataTablePersistedPrefsPatch): void {
			if (!isBrowserRuntime()) {
				return;
			}
			const validatedPatch = parseDataTablePrefsPatch(patch);
			if (validatedPatch === null) {
				return;
			}
			try {
				const storageKey = `${prefix}${key}`;
				const existing = window.localStorage.getItem(storageKey);
				const parsedPrefs = existing === null ? null : parseDataTablePersistedPrefs(existing);
				const current: DataTablePersistedPrefsPatch = parsedPrefs ?? {};
				window.localStorage.setItem(storageKey, JSON.stringify({ ...current, ...validatedPatch }));
			} catch (error) {
				console.warn("[DataTable] Failed to persist preferences:", error);
			}
		},
	};
}

import { parseDataTablePersistedPrefs, parseDataTablePrefsPatch, type DataTablePersistedPrefs, type DataTablePersistedPrefsPatch } from "./data-table-prefs";

/** Injectable persistence boundary — smart parents can supply memory, session, or custom storage. */
export interface DataTableStorageAdapter {
	read(key: string): DataTablePersistedPrefs | null;
	write(key: string, patch: DataTablePersistedPrefsPatch): void;
}

const STORAGE_PREFIX = "datatable:v1:";

function isBrowserEnvironment(): boolean {
	return globalThis.window !== undefined && globalThis.localStorage !== undefined;
}

/** Default adapter backed by `window.localStorage` (browser only). */
export function createLocalStorageDataTableStorage(namespace = "default"): DataTableStorageAdapter {
	const prefix = `${STORAGE_PREFIX}${namespace}:`;

	return {
		read(key: string): DataTablePersistedPrefs | null {
			if (!isBrowserEnvironment()) {
				return null;
			}
			const saved = globalThis.localStorage.getItem(`${prefix}${key}`);
			if (saved === null) {
				return null;
			}
			return parseDataTablePersistedPrefs(saved);
		},
		write(key: string, patch: DataTablePersistedPrefsPatch): void {
			if (!isBrowserEnvironment()) {
				return;
			}
			const validatedPatch = parseDataTablePrefsPatch(patch);
			if (validatedPatch === null) {
				return;
			}
			try {
				const storageKey = `${prefix}${key}`;
				const existing = globalThis.localStorage.getItem(storageKey);
				const parsedPrefs = existing === null ? null : parseDataTablePersistedPrefs(existing);
				const current: DataTablePersistedPrefsPatch = parsedPrefs ?? {};
				globalThis.localStorage.setItem(storageKey, JSON.stringify({ ...current, ...validatedPatch }));
			} catch (error) {
				console.warn("[DataTable] Failed to persist preferences:", error);
			}
		},
	};
}

import { parseDataTablePersistedPrefs, type DataTablePersistedPrefs, type DataTablePersistedPrefsPatch } from "./data-table-prefs";

/** Injectable persistence boundary — smart parents can supply memory, session, or custom storage. */
export interface DataTableStorageAdapter {
	read(key: string): DataTablePersistedPrefs | null;
	write(key: string, patch: DataTablePersistedPrefsPatch): void;
}

const STORAGE_PREFIX = "datatable:";

/** Default adapter backed by `window.localStorage` (browser only). */
export function createLocalStorageDataTableStorage(): DataTableStorageAdapter {
	return {
		read(key: string): DataTablePersistedPrefs | null {
		if (typeof window === "undefined") {
			return null;
		}
			const saved = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
			if (saved === null) {
				return null;
			}
			return parseDataTablePersistedPrefs(saved);
		},
		write(key: string, patch: DataTablePersistedPrefsPatch): void {
		if (typeof window === "undefined") {
			return;
		}
			try {
				const storageKey = `${STORAGE_PREFIX}${key}`;
				const existing = window.localStorage.getItem(storageKey);
				const parsedPrefs = existing === null ? null : parseDataTablePersistedPrefs(existing);
				const current: DataTablePersistedPrefsPatch = parsedPrefs ?? {};
				window.localStorage.setItem(storageKey, JSON.stringify({ ...current, ...patch }));
			} catch {
				/* noop */
			}
		},
	};
}

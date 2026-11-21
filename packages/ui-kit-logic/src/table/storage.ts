// Where a DataTable keeps its preferences: an adapter each platform supplies (the web's local storage, a native
// app's key-value store, memory in tests).

import type { DataTablePersistedPrefs, DataTablePersistedPrefsPatch } from "./prefs";

/** Injectable persistence boundary: smart parents can supply memory, session, or custom storage. */
export interface DataTableStorageAdapter {
	read(key: string): DataTablePersistedPrefs | null;
	write(key: string, patch: DataTablePersistedPrefsPatch): void;
}

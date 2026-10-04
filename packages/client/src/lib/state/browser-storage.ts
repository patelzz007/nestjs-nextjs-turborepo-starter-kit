// ============================================
// lib/state/browser-storage.ts - Web Storage that cannot crash a page
// ============================================
// `window.localStorage` / `sessionStorage` THROW in real browsers: reading the
// property throws a `SecurityError` when storage is blocked (privacy settings,
// sandboxed iframes), and `setItem` throws a `QuotaExceededError` when the
// quota is full (Safari private mode historically had a 0-byte quota). The
// app's preferences are conveniences, so a broken storage must degrade to
// "remembered for this page only", never break rendering. Browser-only: call
// from effects / event handlers.

/** The `Storage` methods the app uses. */
export type BrowserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type BrowserStorageKind = "local" | "session";

/** Reads `window.localStorage` / `window.sessionStorage`; `null` when the browser refuses access (SecurityError). */
function openNativeStorage(kind: BrowserStorageKind): Storage | null {
	try {
		return kind === "local" ? window.localStorage : window.sessionStorage;
	} catch (error) {
		if (error instanceof DOMException) {
			return null;
		}
		throw error;
	}
}

/**
 * Wraps a native storage: every read and write goes to it, and when it
 * refuses (blocked, quota full) the value lives in memory for the rest of the
 * page instead. The first refusal is reported once — it is never silent.
 */
export function createResilientStorage(native: Storage | null, report: (problem: string) => void): BrowserStorage {
	const memory = new Map<string, string>();
	let reported = false;
	const fallBack = (operation: string, error: DOMException): void => {
		if (!reported) {
			reported = true;
			report(`[storage] ${operation} failed (${error.name}); keeping values in memory for this page`);
		}
	};
	const attempt = <T>(operation: string, run: (storage: Storage) => T, fallback: () => T): T => {
		if (native === null) return fallback();
		try {
			return run(native);
		} catch (error) {
			if (error instanceof DOMException) {
				fallBack(operation, error);
				return fallback();
			}
			throw error;
		}
	};

	return {
		getItem: (key: string): string | null =>
			memory.has(key)
				? (memory.get(key) ?? null)
				: attempt(
						"read",
						(storage: Storage): string | null => storage.getItem(key),
						(): null => null,
					),
		setItem: (key: string, value: string): void => {
			attempt(
				"write",
				(storage: Storage): void => {
					storage.setItem(key, value);
					memory.delete(key);
				},
				(): void => {
					memory.set(key, value);
				},
			);
		},
		removeItem: (key: string): void => {
			memory.delete(key);
			attempt(
				"remove",
				(storage: Storage): void => {
					storage.removeItem(key);
				},
				(): void => undefined,
			);
		},
	};
}

const opened = new Map<BrowserStorageKind, BrowserStorage>();

function reportStorageProblem(problem: string): void {
	console.warn(problem);
}

/** The page's local / session storage, resilient to blocked storage and full quotas (one instance per kind). */
export function browserStorage(kind: BrowserStorageKind): BrowserStorage {
	const existing = opened.get(kind);
	if (existing !== undefined) return existing;
	const storage = createResilientStorage(openNativeStorage(kind), reportStorageProblem);
	opened.set(kind, storage);
	return storage;
}

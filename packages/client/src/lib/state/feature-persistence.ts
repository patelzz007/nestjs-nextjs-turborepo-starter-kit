import type { z } from "zod";

import type { FeatureAction, FeatureStore } from "./feature-store";

/** The `Storage` methods persistence needs (localStorage in the browser, a fake in tests). */
export type FeatureStorage = Pick<Storage, "getItem" | "setItem">;

export interface FeaturePersistenceOptions<TState, TAction extends FeatureAction, TPersisted> {
	/** Storage key (e.g. `admin-sidebar-state`). */
	readonly key: string;
	/** Validates what comes back from storage — anything else is ignored, never trusted. */
	readonly schema: z.ZodType<TPersisted>;
	/** The slice worth keeping across reloads (persist deliberately, never "everything"). */
	readonly select: (state: TState) => TPersisted;
	/** The action that restores a validated snapshot (e.g. `[ Sidebar ] Preferences Restored`). */
	readonly restore: (persisted: TPersisted) => TAction;
}

/**
 * Snapshots are JSON. A value that is not JSON goes to the schema as the raw
 * string instead: helpers older than the feature stores wrote some preferences
 * as a bare string (e.g. `list`), and only the schema may decide to upgrade
 * one. Anything the schema rejects, garbled text included, is ignored.
 */
function readPersisted<TPersisted>(storage: FeatureStorage, key: string, schema: z.ZodType<TPersisted>): TPersisted | null {
	const raw = storage.getItem(key);
	if (raw === null) {
		return null;
	}
	try {
		const parsed = schema.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : null;
	} catch {
		const parsedRaw = schema.safeParse(raw);
		return parsedRaw.success ? parsedRaw.data : null;
	}
}

/**
 * Connects a feature store to storage: restores a validated snapshot through
 * the feature's own restore action (so it shows in DevTools), then writes the
 * selected slice back whenever it changes. Call after mount — restoring during
 * render would make the client's first render differ from the server HTML.
 *
 * Returns the unsubscribe function.
 */
export function connectFeaturePersistence<TState, TAction extends FeatureAction, TPersisted>(
	store: FeatureStore<TState, TAction>,
	storage: FeatureStorage,
	options: FeaturePersistenceOptions<TState, TAction, TPersisted>,
): () => void {
	const persisted = readPersisted(storage, options.key, options.schema);
	if (persisted !== null) {
		store.dispatch(options.restore(persisted));
	}

	let lastWritten = JSON.stringify(options.select(store.getState()));
	return store.subscribe((state: TState): void => {
		const next = JSON.stringify(options.select(state));
		if (next !== lastWritten) {
			lastWritten = next;
			storage.setItem(options.key, next);
		}
	});
}

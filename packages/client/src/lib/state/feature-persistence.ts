import { z } from "zod";

import type { FeatureAction, FeatureStore } from "./feature-store";

/** The `Storage` methods persistence needs (localStorage in the browser, a fake in tests). */
export type FeatureStorage = Pick<Storage, "getItem" | "setItem">;

/** The stored-format version of anything written before snapshots carried one. */
export const UNVERSIONED_STORAGE_FORMAT = 0;

/**
 * One explicit upgrade step for data an older build wrote under the same key.
 * It reads the raw stored text of exactly one older format and returns the
 * CURRENT snapshot, or `null` when the text is not that format (it is then
 * ignored). Every step documents why it exists and when it can be deleted.
 */
export interface FeatureStorageMigration<TPersisted> {
	/** The stored format this step reads (`UNVERSIONED_STORAGE_FORMAT` for data written before versioning). */
	readonly fromVersion: number;
	readonly upgrade: (storedText: string) => TPersisted | null;
}

export interface FeaturePersistenceOptions<TState, TAction extends FeatureAction, TPersisted> {
	/** Storage key (e.g. `admin-sidebar-state`). */
	readonly key: string;
	/**
	 * The current snapshot format (a positive integer). Bump it whenever
	 * `schema` changes so that older snapshots no longer parse, and add a
	 * migration from the previous version.
	 */
	readonly version: number;
	/** Validates the current format's snapshot on the way back in — anything else is ignored, never trusted. */
	readonly schema: z.ZodType<TPersisted>;
	/** Upgrade steps for older formats still in users' browsers (empty when there are none). */
	readonly migrations: readonly FeatureStorageMigration<TPersisted>[];
	/** The slice worth keeping across reloads (persist deliberately, never "everything"). */
	readonly select: (state: TState) => TPersisted;
	/** The action that restores a validated snapshot (e.g. `[ Sidebar ] Preferences Restored`). */
	readonly restore: (persisted: TPersisted) => TAction;
}

/**
 * Parses stored text as JSON and validates it. `null` when the text is not
 * JSON or the value fails the schema — stored data is untrusted. Exported for
 * migrations that read an older JSON format.
 */
export function parseStoredJson<TValue>(storedText: string, schema: z.ZodType<TValue>): TValue | null {
	try {
		const parsed = schema.safeParse(JSON.parse(storedText));
		return parsed.success ? parsed.data : null;
	} catch (error) {
		if (error instanceof SyntaxError) {
			return null;
		}
		throw error;
	}
}

/** Only the version of a stored envelope — the snapshot is validated once the version is known. */
const StoredVersionSchema = z.object({ schemaVersion: z.number().int().positive() });

function storedEnvelopeSchema<TPersisted>(version: number, schema: z.ZodType<TPersisted>): z.ZodType<{ schemaVersion: number; snapshot: TPersisted }> {
	return z.object({ schemaVersion: z.literal(version), snapshot: schema });
}

type StoredSnapshot<TPersisted> =
	{ readonly kind: "none" } | { readonly kind: "current"; readonly snapshot: TPersisted } | { readonly kind: "migrated"; readonly snapshot: TPersisted };

function readStoredSnapshot<TState, TAction extends FeatureAction, TPersisted>(
	storage: FeatureStorage,
	options: FeaturePersistenceOptions<TState, TAction, TPersisted>,
): StoredSnapshot<TPersisted> {
	const storedText = storage.getItem(options.key);
	if (storedText === null) {
		return { kind: "none" };
	}
	const storedVersion = parseStoredJson(storedText, StoredVersionSchema)?.schemaVersion ?? UNVERSIONED_STORAGE_FORMAT;
	if (storedVersion === options.version) {
		const envelope = parseStoredJson(storedText, storedEnvelopeSchema(options.version, options.schema));
		return envelope === null ? { kind: "none" } : { kind: "current", snapshot: envelope.snapshot };
	}
	const migration = options.migrations.find((step) => step.fromVersion === storedVersion);
	const upgraded = migration?.upgrade(storedText) ?? null;
	return upgraded === null ? { kind: "none" } : { kind: "migrated", snapshot: upgraded };
}

/**
 * Connects a feature store to storage: restores a validated snapshot through
 * the feature's own restore action (so it shows in DevTools), then writes the
 * selected slice back whenever it changes. A snapshot in an older format is
 * upgraded by the feature's migration step for that version and rewritten in
 * the current format straight away, so the old format leaves storage. Call
 * after mount — restoring during render would make the client's first render
 * differ from the server HTML.
 *
 * Returns the unsubscribe function.
 */
export function connectFeaturePersistence<TState, TAction extends FeatureAction, TPersisted>(
	store: FeatureStore<TState, TAction>,
	storage: FeatureStorage,
	options: FeaturePersistenceOptions<TState, TAction, TPersisted>,
): () => void {
	/** What is written: `{ "schemaVersion": n, "snapshot": … }`. */
	const serialize = (snapshot: TPersisted): string => JSON.stringify({ schemaVersion: options.version, snapshot });
	const stored = readStoredSnapshot(storage, options);
	if (stored.kind !== "none") {
		store.dispatch(options.restore(stored.snapshot));
	}

	let lastWritten = serialize(options.select(store.getState()));
	if (stored.kind === "migrated") {
		storage.setItem(options.key, lastWritten);
	}
	return store.subscribe((state: TState): void => {
		const next = serialize(options.select(state));
		if (next !== lastWritten) {
			lastWritten = next;
			storage.setItem(options.key, next);
		}
	});
}

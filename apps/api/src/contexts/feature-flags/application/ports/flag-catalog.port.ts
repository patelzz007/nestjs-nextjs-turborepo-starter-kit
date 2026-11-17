import type { FlagCatalog } from "../../domain/catalog/flag-catalog";
import type { CatalogIndex } from "../../domain/catalog/catalog-index";

/** Loads the whole catalogue from storage (under `feature_flags.evaluate`). */
export interface FlagCatalogLoader {
	load(): Promise<FlagCatalog>;
}

/**
 * The catalogue as every decision reads it: cached (ADR 072), dropped everywhere after a change commits, and
 * indexed once per version.
 */
export interface FlagCatalogSource {
	current(): Promise<CatalogIndex>;
	/** After a change committed: drop every instance's copy and announce `version` on the live stream. */
	changed(version: number): Promise<void>;
}

/** "The catalogue is now at version N", on every API instance (Redis pub/sub), for the live streams. */
export interface CatalogVersionSignal {
	publish(version: number): Promise<void>;
	/** Listens for new versions; returns the unsubscribe function. */
	subscribe(listener: (version: number) => void): () => void;
}

export const FLAG_CATALOG_LOADER = Symbol("FLAG_CATALOG_LOADER");
export const FLAG_CATALOG_SOURCE = Symbol("FLAG_CATALOG_SOURCE");
export const CATALOG_VERSION_SIGNAL = Symbol("CATALOG_VERSION_SIGNAL");

import type {
	City,
	Country,
	CreateCityInput,
	CreateCountryInput,
	CreateRegionInput,
	CreateStateInput,
	CreateSubregionInput,
	EpochMs,
	Region,
	State,
	Subregion,
	UpdateCityInput,
	UpdateCountryInput,
	UpdateRegionInput,
	UpdateStateInput,
	UpdateSubregionInput,
} from "@workspace/shared";

import type { GeoChildLevel } from "../policies/geo-cascade.policy";
import type { GeoImportRow } from "../policies/geo-import.policy";
import type { GeoEntityKind, GeoParentKind } from "../value-objects/geo-entity-kind.value-object";

/** Who soft-deleted a row, and when. */
export interface GeoDeletionStamp {
	readonly deletedBy: string;
	readonly deletedAt: EpochMs;
}

/** A live row's natural-key parts: its name and the parent that scopes it (`null` for regions and countries). */
export interface GeoNamedRow {
	readonly id: number;
	readonly name: string;
	readonly parentId: number | null;
}

/**
 * Write side of the geography hierarchy, bound to ONE
 * `geo.reference_data.write` transaction. Rows are never hard-deleted. Every
 * update and soft delete is conditional on the row still being live
 * (`isDeleted = false`): `null` / `false` means it is missing or deleted.
 */
export interface GeographyRepository {
	/** Serialises concurrent imports for the rest of the transaction. Must be the import's first statement. */
	lockImports(): Promise<void>;
	/** Whether a parent row exists and is not soft-deleted. */
	isLive(entity: GeoParentKind, id: number): Promise<boolean>;

	/** Every `update*` stamps `updatedAt` (epoch ms, from the caller's clock) on the row it changes. */
	createRegion(input: CreateRegionInput): Promise<Region>;
	updateRegion(id: number, input: UpdateRegionInput, updatedAt: EpochMs): Promise<Region | null>;
	createSubregion(input: CreateSubregionInput): Promise<Subregion>;
	updateSubregion(id: number, input: UpdateSubregionInput, updatedAt: EpochMs): Promise<Subregion | null>;
	createCountry(input: CreateCountryInput): Promise<Country>;
	updateCountry(id: number, input: UpdateCountryInput, updatedAt: EpochMs): Promise<Country | null>;
	createState(input: CreateStateInput): Promise<State>;
	updateState(id: number, input: UpdateStateInput, updatedAt: EpochMs): Promise<State | null>;
	createCity(input: CreateCityInput): Promise<City>;
	updateCity(id: number, input: UpdateCityInput, updatedAt: EpochMs): Promise<City | null>;

	/** Soft-deletes one live row. `false` when it was missing or already deleted. */
	softDelete(entity: GeoEntityKind, id: number, stamp: GeoDeletionStamp): Promise<boolean>;
	/** Soft-deletes the live rows of one child level under `id` (see `GEO_CASCADE_LEVELS`). */
	softDeleteDescendants(entity: GeoParentKind, id: number, level: GeoChildLevel, stamp: GeoDeletionStamp): Promise<void>;

	/** Which of `ids` are live rows of `entity`. */
	liveIds(entity: GeoParentKind, ids: ReadonlySet<number>): Promise<ReadonlySet<number>>;
	/** The live rows of `entity` with one of `names`. */
	liveNamedRows(entity: GeoEntityKind, names: readonly string[]): Promise<readonly GeoNamedRow[]>;
	/** Stamps `updatedAt` on the live rows an upsert import matched. */
	touch(entity: GeoEntityKind, ids: readonly number[], at: EpochMs): Promise<void>;
	/** Inserts an import's new rows in bounded statements. */
	insertImportRows(rows: readonly GeoImportRow[]): Promise<void>;
}

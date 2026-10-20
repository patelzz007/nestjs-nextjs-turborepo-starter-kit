import type { GeoEntityKind } from "../value-objects/geo-entity-kind.value-object";

/** A child table a cascade reaches, named as the cascade preview reports it. */
export type GeoChildLevel = "subregions" | "countries" | "states" | "cities";

/**
 * What soft-deleting a row also soft-deletes, top-down — and exactly what the
 * cascade preview counts. A subregion's countries are those whose
 * `subregionId` names it; a region reaches its countries directly (`regionId`)
 * as well as through its subregions. A city has no children.
 */
export const GEO_CASCADE_LEVELS: Readonly<Record<GeoEntityKind, readonly GeoChildLevel[]>> = {
	region: ["subregions", "countries", "states", "cities"],
	subregion: ["countries", "states", "cities"],
	country: ["states", "cities"],
	state: ["cities"],
	city: [],
};

/** Child levels in the order a cascade soft-deletes them: bottom-up, so no live child is ever left under a deleted parent mid-transaction. */
export function cascadeDeleteOrder(entity: GeoEntityKind): readonly GeoChildLevel[] {
	return [...GEO_CASCADE_LEVELS[entity]].reverse();
}

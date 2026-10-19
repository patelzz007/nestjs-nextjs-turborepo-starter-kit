import type { Prisma } from "@prisma/client";

import type { GeoChildLevel } from "../../domain/policies/geo-cascade.policy";
import type { GeoParentKind } from "../../domain/value-objects/geo-entity-kind.value-object";

/**
 * How each child table is linked to a cascade root, per root level — the
 * Prisma side of `GEO_CASCADE_LEVELS` (which levels a delete reaches). The
 * filter is added to `isDeleted: false`. A level a root does not reach has no
 * entry here (a unit test pins the two tables together).
 */
export interface GeoCascadeWhere {
	readonly subregions?: (id: number) => Prisma.SubregionWhereInput;
	readonly countries?: (id: number) => Prisma.CountryWhereInput;
	readonly states?: (id: number) => Prisma.StateWhereInput;
	readonly cities?: (id: number) => Prisma.CityWhereInput;
}

export const GEO_CASCADE_WHERE: Readonly<Record<GeoParentKind, GeoCascadeWhere>> = {
	region: {
		subregions: (id) => ({ regionId: id }),
		countries: (id) => ({ regionId: id }),
		states: (id) => ({ country: { regionId: id } }),
		cities: (id) => ({ state: { country: { regionId: id } } }),
	},
	subregion: {
		countries: (id) => ({ subregionId: id }),
		states: (id) => ({ country: { subregionId: id } }),
		cities: (id) => ({ state: { country: { subregionId: id } } }),
	},
	country: {
		states: (id) => ({ countryId: id }),
		cities: (id) => ({ countryId: id }),
	},
	state: {
		cities: (id) => ({ stateId: id }),
	},
};

/** The child levels the Prisma table links for a root (to compare with the domain policy). */
export function linkedCascadeLevels(entity: GeoParentKind): readonly GeoChildLevel[] {
	const where = GEO_CASCADE_WHERE[entity];
	const levels: readonly GeoChildLevel[] = ["subregions", "countries", "states", "cities"];
	return levels.filter((level): boolean => where[level] !== undefined);
}

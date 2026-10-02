import { z } from "zod";

import { CitySchema } from "./geo-city";
import { CountrySchema } from "./geo-country";
import { RegionSchema } from "./geo-region";
import { StateSchema } from "./geo-state";
import { SubregionSchema } from "./geo-subregion";

// ── List items (entity + the relations `?include=` asked for) ───────────────
// Every geo list accepts `include` (comma-separated relation names) and the
// API embeds those relations ONE level deep in each item. Each relation is
// optional: it is present only when it was requested. The relation key names
// are the Prisma relation names the API has always sent (`regionRelation`,
// `subregionRelation` on countries — `region` / `subregion` there are the
// denormalised name columns). Open objects (no `.strict()`), like every
// response DTO: unknown keys are stripped, never rejected.

/** `GET /geo/regions` item — `include=subregions,countries`. */
export const RegionListItemSchema = RegionSchema.extend({
	subregions: z.array(SubregionSchema).optional(),
	countries: z.array(CountrySchema).optional(),
});

export type RegionListItem = z.output<typeof RegionListItemSchema>;

/** `GET /geo/subregions` item — `include=region,countries`. */
export const SubregionListItemSchema = SubregionSchema.extend({
	region: RegionSchema.optional(),
	countries: z.array(CountrySchema).optional(),
});

export type SubregionListItem = z.output<typeof SubregionListItemSchema>;

/** `GET /geo/countries` item — `include=region,subregion,states,cities`. */
export const CountryListItemSchema = CountrySchema.extend({
	regionRelation: RegionSchema.nullable().optional(),
	subregionRelation: SubregionSchema.nullable().optional(),
	states: z.array(StateSchema).optional(),
	cities: z.array(CitySchema).optional(),
});

export type CountryListItem = z.output<typeof CountryListItemSchema>;

/** `GET /geo/states` item — `include=country,cities`. */
export const StateListItemSchema = StateSchema.extend({
	country: CountrySchema.optional(),
	cities: z.array(CitySchema).optional(),
});

export type StateListItem = z.output<typeof StateListItemSchema>;

/** `GET /geo/cities` item — `include=state,country`. */
export const CityListItemSchema = CitySchema.extend({
	state: StateSchema.optional(),
	country: CountrySchema.optional(),
});

export type CityListItem = z.output<typeof CityListItemSchema>;

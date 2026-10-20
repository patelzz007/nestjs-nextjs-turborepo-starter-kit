import type {
	CascadePreviewResult,
	City,
	CityListItem,
	CityListQuery,
	Country,
	CountryListItem,
	CountryListQuery,
	GeoAutocompleteItem,
	GeoAutocompleteQuery,
	GeoExportQuery,
	GeoStats,
	PaginatedServiceResult,
	Region,
	RegionListItem,
	RegionListQuery,
	State,
	StateListItem,
	StateListQuery,
	Subregion,
	SubregionListItem,
	SubregionListQuery,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { GeoChildLevel } from "../../domain/policies/geo-cascade.policy";
import type { GeoParentKind } from "../../domain/value-objects/geo-entity-kind.value-object";

/**
 * Read side of the geography hierarchy, under the actor's RLS session. Every
 * read excludes soft-deleted rows; a `get*` answers `null` for a missing or
 * deleted row (the service turns that into a 404).
 */
export interface GeographyReadPort {
	stats(actor: ActorContext): Promise<GeoStats>;
	autocomplete(actor: ActorContext, query: GeoAutocompleteQuery): Promise<readonly GeoAutocompleteItem[]>;
	exportCities(actor: ActorContext, query: GeoExportQuery): Promise<readonly City[]>;
	/** The live root's name and the live-row count of each of `levels` under it; `null` when the root is missing or deleted. */
	cascadePreview(actor: ActorContext, entity: GeoParentKind, id: number, levels: readonly GeoChildLevel[]): Promise<CascadePreviewResult | null>;

	listRegions(actor: ActorContext, query: RegionListQuery): Promise<PaginatedServiceResult<RegionListItem>>;
	getRegion(actor: ActorContext, id: number): Promise<Region | null>;
	listSubregions(actor: ActorContext, query: SubregionListQuery): Promise<PaginatedServiceResult<SubregionListItem>>;
	getSubregion(actor: ActorContext, id: number): Promise<Subregion | null>;
	listCountries(actor: ActorContext, query: CountryListQuery): Promise<PaginatedServiceResult<CountryListItem>>;
	getCountry(actor: ActorContext, id: number): Promise<Country | null>;
	listStates(actor: ActorContext, query: StateListQuery): Promise<PaginatedServiceResult<StateListItem>>;
	getState(actor: ActorContext, id: number): Promise<State | null>;
	listCities(actor: ActorContext, query: CityListQuery): Promise<PaginatedServiceResult<CityListItem>>;
	getCity(actor: ActorContext, id: number): Promise<City | null>;
}

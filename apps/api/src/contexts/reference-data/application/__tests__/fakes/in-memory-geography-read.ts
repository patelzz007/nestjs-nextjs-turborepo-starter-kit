import type {
	CascadePreviewResult,
	City,
	CityListItem,
	Country,
	CountryListItem,
	GeoAutocompleteItem,
	GeoStats,
	PaginatedServiceResult,
	Region,
	RegionListItem,
	State,
	StateListItem,
	Subregion,
	SubregionListItem,
} from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { GeoChildLevel } from "../../../domain/policies/geo-cascade.policy";
import type { GeoEntityKind, GeoParentKind } from "../../../domain/value-objects/geo-entity-kind.value-object";
import type { GeographyReadPort } from "../../ports/geography-read.port";

/** Page size the fake reports for every (empty) list. */
const FAKE_PAGE_LIMIT = 20;

function emptyPage<TItem>(): PaginatedServiceResult<TItem> {
	return { items: [], limit: FAKE_PAGE_LIMIT, total: 0, page: 1, totalPages: 0, nextCursor: null, hasNext: false, hasPrevious: false };
}

/**
 * A real in-memory {@link GeographyReadPort}: `get*` answers the rows put in
 * `rows` (none → `null`, as a missing or soft-deleted row), lists are empty,
 * and every call records the actor it was asked as.
 */
export class InMemoryGeographyRead implements GeographyReadPort {
	public readonly actors: ActorContext[] = [];
	public readonly previews: { readonly entity: GeoParentKind; readonly id: number; readonly levels: readonly GeoChildLevel[] }[] = [];
	public readonly rows: {
		region: Map<number, Region>;
		subregion: Map<number, Subregion>;
		country: Map<number, Country>;
		state: Map<number, State>;
		city: Map<number, City>;
	} = { region: new Map(), subregion: new Map(), country: new Map(), state: new Map(), city: new Map() };
	/** Names of the live cascade roots, keyed `<entity>:<id>`. */
	public readonly cascadeRoots = new Map<string, string>();

	public stats(actor: ActorContext): Promise<GeoStats> {
		this.actors.push(actor);
		return Promise.resolve({
			regions: this.rows.region.size,
			subregions: this.rows.subregion.size,
			countries: this.rows.country.size,
			states: this.rows.state.size,
			cities: this.rows.city.size,
		});
	}

	public autocomplete(actor: ActorContext): Promise<readonly GeoAutocompleteItem[]> {
		this.actors.push(actor);
		return Promise.resolve([]);
	}

	public exportCities(actor: ActorContext): Promise<readonly City[]> {
		this.actors.push(actor);
		return Promise.resolve([...this.rows.city.values()]);
	}

	public cascadePreview(actor: ActorContext, entity: GeoParentKind, id: number, levels: readonly GeoChildLevel[]): Promise<CascadePreviewResult | null> {
		this.actors.push(actor);
		this.previews.push({ entity, id, levels });
		const name = this.cascadeRoots.get(rootKey(entity, id));
		return Promise.resolve(name === undefined ? null : { entity, id, name, willDelete: Object.fromEntries(levels.map((level): [GeoChildLevel, number] => [level, 0])) });
	}

	public listRegions(actor: ActorContext): Promise<PaginatedServiceResult<RegionListItem>> {
		this.actors.push(actor);
		return Promise.resolve(emptyPage());
	}

	public getRegion(actor: ActorContext, id: number): Promise<Region | null> {
		this.actors.push(actor);
		return Promise.resolve(this.rows.region.get(id) ?? null);
	}

	public listSubregions(actor: ActorContext): Promise<PaginatedServiceResult<SubregionListItem>> {
		this.actors.push(actor);
		return Promise.resolve(emptyPage());
	}

	public getSubregion(actor: ActorContext, id: number): Promise<Subregion | null> {
		this.actors.push(actor);
		return Promise.resolve(this.rows.subregion.get(id) ?? null);
	}

	public listCountries(actor: ActorContext): Promise<PaginatedServiceResult<CountryListItem>> {
		this.actors.push(actor);
		return Promise.resolve(emptyPage());
	}

	public getCountry(actor: ActorContext, id: number): Promise<Country | null> {
		this.actors.push(actor);
		return Promise.resolve(this.rows.country.get(id) ?? null);
	}

	public listStates(actor: ActorContext): Promise<PaginatedServiceResult<StateListItem>> {
		this.actors.push(actor);
		return Promise.resolve(emptyPage());
	}

	public getState(actor: ActorContext, id: number): Promise<State | null> {
		this.actors.push(actor);
		return Promise.resolve(this.rows.state.get(id) ?? null);
	}

	public listCities(actor: ActorContext): Promise<PaginatedServiceResult<CityListItem>> {
		this.actors.push(actor);
		return Promise.resolve(emptyPage());
	}

	public getCity(actor: ActorContext, id: number): Promise<City | null> {
		this.actors.push(actor);
		return Promise.resolve(this.rows.city.get(id) ?? null);
	}
}

export function rootKey(entity: GeoEntityKind, id: number): string {
	return `${entity}:${String(id)}`;
}

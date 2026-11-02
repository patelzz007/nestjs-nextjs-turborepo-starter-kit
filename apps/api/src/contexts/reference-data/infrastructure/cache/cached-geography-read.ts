// ============================================
// reference-data/infrastructure/cache/cached-geography-read.ts — geography reads through the cache (ADR 072)
// ============================================
// Geography is read on every address form and changes only when a SuperAdmin edits or imports it, so
// the hot reads (one entity by id, the stats, autocomplete) are kept in the shared cache. The data is
// the same for every reader (platform scope; reads never return deleted rows). Any write drops every
// geography cache after it commits; the TTL is only a safety net.

import { createHash } from "node:crypto";

import {
	CitySchema,
	CountrySchema,
	GeoAutocompleteItemSchema,
	GeoStatsSchema,
	RegionSchema,
	StateSchema,
	SubregionSchema,
	type CascadePreviewResult,
	type City,
	type CityListItem,
	type CityListQuery,
	type Country,
	type CountryListItem,
	type CountryListQuery,
	type GeoAutocompleteItem,
	type GeoAutocompleteQuery,
	type GeoExportQuery,
	type GeoStats,
	type PaginatedServiceResult,
	type Region,
	type RegionListItem,
	type RegionListQuery,
	type State,
	type StateListItem,
	type StateListQuery,
	type Subregion,
	type SubregionListItem,
	type SubregionListQuery,
} from "@workspace/shared";
import { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { defineCache, PLATFORM_SCOPE, type AppCache, type CacheDefinition, type CacheNamespaceControl } from "../../../../platform/application/ports/app-cache.port";
import type { GeoChildLevel } from "../../domain/policies/geo-cascade.policy";
import type { GeoParentKind } from "../../domain/value-objects/geo-entity-kind.value-object";
import type { GeographyCachePort } from "../../application/ports/geography-cache.port";
import type { GeographyReadPort } from "../../application/ports/geography-read.port";

const MS_PER_MINUTE = 60_000;
/** Safety net only: every write drops these caches after commit. */
const GEO_TTL_MS = 15 * MS_PER_MINUTE;
/** A slightly old geography answer is harmless while one refresh runs. */
const GEO_STALE_MS = 5 * MS_PER_MINUTE;
const GEO_LOCAL_ENTRIES = 5_000;
const GEO_SHARED_KEYS = 50_000;

function geoCache<T>(name: string, schema: z.ZodType<T>): CacheDefinition<T, "platform"> {
	return defineCache<T, "platform">({
		name: `reference-data.${name}`,
		version: 1,
		schema,
		scope: "platform",
		tier: "two-tier",
		ttlMs: GEO_TTL_MS,
		staleMs: GEO_STALE_MS,
		containsPersonalData: false,
		localMaxEntries: GEO_LOCAL_ENTRIES,
		sharedMaxKeys: GEO_SHARED_KEYS,
	});
}

/** A query's cache id: the SHA-256 of its JSON (stable for the same parsed query). */
function queryId(query: GeoAutocompleteQuery): string {
	return createHash("sha256").update(JSON.stringify(query)).digest("hex");
}

/** The geography read port with the hot reads served from the cache; everything else passes through. */
export class CachedGeographyRead implements GeographyReadPort, GeographyCachePort {
	private readonly regions = geoCache("geo-region", RegionSchema.nullable());
	private readonly subregions = geoCache("geo-subregion", SubregionSchema.nullable());
	private readonly countries = geoCache("geo-country", CountrySchema.nullable());
	private readonly states = geoCache("geo-state", StateSchema.nullable());
	private readonly cities = geoCache("geo-city", CitySchema.nullable());
	private readonly geoStats = geoCache("geo-stats", GeoStatsSchema);
	private readonly suggestions = geoCache("geo-autocomplete", z.array(GeoAutocompleteItemSchema));

	public constructor(
		private readonly source: GeographyReadPort,
		private readonly cache: AppCache,
	) {
		cache.register(...this.all());
	}

	public stats(actor: ActorContext): Promise<GeoStats> {
		return this.cache.getOrLoad(this.geoStats, PLATFORM_SCOPE, "all", async (): Promise<GeoStats> => this.source.stats(actor));
	}

	public autocomplete(actor: ActorContext, query: GeoAutocompleteQuery): Promise<readonly GeoAutocompleteItem[]> {
		return this.cache.getOrLoad(this.suggestions, PLATFORM_SCOPE, queryId(query), async (): Promise<GeoAutocompleteItem[]> => [
			...(await this.source.autocomplete(actor, query)),
		]);
	}

	public exportCities(actor: ActorContext, query: GeoExportQuery): Promise<readonly City[]> {
		return this.source.exportCities(actor, query);
	}

	public cascadePreview(actor: ActorContext, entity: GeoParentKind, id: number, levels: readonly GeoChildLevel[]): Promise<CascadePreviewResult | null> {
		return this.source.cascadePreview(actor, entity, id, levels);
	}

	public listRegions(actor: ActorContext, query: RegionListQuery): Promise<PaginatedServiceResult<RegionListItem>> {
		return this.source.listRegions(actor, query);
	}

	public getRegion(actor: ActorContext, id: number): Promise<Region | null> {
		return this.cache.getOrLoad(this.regions, PLATFORM_SCOPE, String(id), async (): Promise<Region | null> => this.source.getRegion(actor, id));
	}

	public listSubregions(actor: ActorContext, query: SubregionListQuery): Promise<PaginatedServiceResult<SubregionListItem>> {
		return this.source.listSubregions(actor, query);
	}

	public getSubregion(actor: ActorContext, id: number): Promise<Subregion | null> {
		return this.cache.getOrLoad(this.subregions, PLATFORM_SCOPE, String(id), async (): Promise<Subregion | null> => this.source.getSubregion(actor, id));
	}

	public listCountries(actor: ActorContext, query: CountryListQuery): Promise<PaginatedServiceResult<CountryListItem>> {
		return this.source.listCountries(actor, query);
	}

	public getCountry(actor: ActorContext, id: number): Promise<Country | null> {
		return this.cache.getOrLoad(this.countries, PLATFORM_SCOPE, String(id), async (): Promise<Country | null> => this.source.getCountry(actor, id));
	}

	public listStates(actor: ActorContext, query: StateListQuery): Promise<PaginatedServiceResult<StateListItem>> {
		return this.source.listStates(actor, query);
	}

	public getState(actor: ActorContext, id: number): Promise<State | null> {
		return this.cache.getOrLoad(this.states, PLATFORM_SCOPE, String(id), async (): Promise<State | null> => this.source.getState(actor, id));
	}

	public listCities(actor: ActorContext, query: CityListQuery): Promise<PaginatedServiceResult<CityListItem>> {
		return this.source.listCities(actor, query);
	}

	public getCity(actor: ActorContext, id: number): Promise<City | null> {
		return this.cache.getOrLoad(this.cities, PLATFORM_SCOPE, String(id), async (): Promise<City | null> => this.source.getCity(actor, id));
	}

	/** Drops every geography cache on every instance (call after a write commits). */
	public async invalidateAll(): Promise<void> {
		for (const cache of this.all()) {
			await this.cache.flushNamespace(cache.name);
		}
	}

	private all(): readonly CacheNamespaceControl[] {
		return [this.regions, this.subregions, this.countries, this.states, this.cities, this.geoStats, this.suggestions];
	}
}

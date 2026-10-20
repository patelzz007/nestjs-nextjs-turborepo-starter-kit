import { Inject, Injectable } from "@nestjs/common";
import type {
	CascadePreviewInput,
	CascadePreviewResult,
	City,
	CityListItem,
	CityListQuery,
	Country,
	CountryListItem,
	CountryListQuery,
	CreateCityInput,
	CreateCountryInput,
	CreateRegionInput,
	CreateStateInput,
	CreateSubregionInput,
	GeoAutocompleteItem,
	GeoAutocompleteQuery,
	GeoExportQuery,
	GeoImportInput,
	GeoImportResult,
	GeoImportValidateInput,
	GeoImportValidationResult,
	GeoStats,
	MessageResponse,
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
	UpdateCityInput,
	UpdateCountryInput,
	UpdateRegionInput,
	UpdateStateInput,
	UpdateSubregionInput,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CLOCK, type Clock } from "../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { cascadeDeleteOrder, GEO_CASCADE_LEVELS } from "../../domain/policies/geo-cascade.policy";
import {
	geoImportParentIds,
	geoNaturalKey,
	missingGeoImportParents,
	planGeoImport,
	splitGeoImportRows,
	validateGeoImport,
	type GeoImportPlan,
	type LiveGeoImportParents,
} from "../../domain/policies/geo-import.policy";
import { withSanitizedGeoName } from "../../domain/policies/geo-name.policy";
import type { GeoDeletionStamp, GeoNamedRow, GeographyRepository } from "../../domain/repositories/geography.repository";
import { GEO_ENTITY_LABEL, type GeoEntityKind, type GeoParentKind } from "../../domain/value-objects/geo-entity-kind.value-object";
import type { GeographyReadPort } from "../ports/geography-read.port";
import { GEO_WRITE_OPERATION, GEOGRAPHY_READ, REFERENCE_DATA_UNIT_OF_WORK } from "../ports/reference-data.tokens";
import type { ReferenceDataScope } from "../reference-data-scope";
import { geoMissingParent, geoNotFound, geoWriterMissing } from "./geography.errors";

/** A row the service read, or the 404 it answers when the row is missing or soft-deleted. */
function found<TRow>(row: TRow | null, entity: GeoEntityKind, id: number): TRow {
	if (row === null) {
		throw geoNotFound(entity, id);
	}
	return row;
}

/** The answer of a successful delete. */
function deletedMessage(entity: GeoEntityKind, id: number): MessageResponse {
	return { message: `${GEO_ENTITY_LABEL[entity]} #${String(id)} deleted` };
}

/**
 * Geography reference data (the simple path, plan §4.4): regions, subregions,
 * countries, states and cities.
 *
 * - Reads need `GEO:READ` (controller) and run as `geo.reference_data.read`;
 *   they never return soft-deleted rows.
 * - Every write is SuperAdmin-only (controller) and runs in ONE transaction
 *   under the `geo.reference_data.write` system operation, with the request's
 *   audit row appended in that same transaction — it commits or rolls back
 *   with the change.
 * - Nothing is hard-deleted: a delete soft-deletes the row and, in the same
 *   transaction, every live descendant the cascade preview reports.
 * - Imports are serialised by a transaction-scoped advisory lock, so two
 *   concurrent `upsert` imports can never both insert the same natural key.
 */
@Injectable()
export class GeographyApplicationService {
	public constructor(
		@Inject(REFERENCE_DATA_UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork<ReferenceDataScope>,
		@Inject(GEOGRAPHY_READ) private readonly reads: GeographyReadPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	// ── Reads ──────────────────────────────────────────────────────────

	public getStats(actor: ActorContext): Promise<GeoStats> {
		return this.reads.stats(actor);
	}

	public autocomplete(actor: ActorContext, query: GeoAutocompleteQuery): Promise<readonly GeoAutocompleteItem[]> {
		return this.reads.autocomplete(actor, query);
	}

	public exportData(actor: ActorContext, query: GeoExportQuery): Promise<readonly City[]> {
		return this.reads.exportCities(actor, query);
	}

	/** What a delete would soft-delete — exactly the levels {@link GEO_CASCADE_LEVELS} names for the entity. */
	public async cascadePreview(actor: ActorContext, input: CascadePreviewInput): Promise<CascadePreviewResult> {
		return found(await this.reads.cascadePreview(actor, input.entity, input.id, GEO_CASCADE_LEVELS[input.entity]), input.entity, input.id);
	}

	public validateImport(_actor: ActorContext, input: GeoImportValidateInput): GeoImportValidationResult {
		return validateGeoImport(input);
	}

	public listRegions(actor: ActorContext, query: RegionListQuery): Promise<PaginatedServiceResult<RegionListItem>> {
		return this.reads.listRegions(actor, query);
	}

	public async getRegion(actor: ActorContext, id: number): Promise<Region> {
		return found(await this.reads.getRegion(actor, id), "region", id);
	}

	public listSubregions(actor: ActorContext, query: SubregionListQuery): Promise<PaginatedServiceResult<SubregionListItem>> {
		return this.reads.listSubregions(actor, query);
	}

	public async getSubregion(actor: ActorContext, id: number): Promise<Subregion> {
		return found(await this.reads.getSubregion(actor, id), "subregion", id);
	}

	public listCountries(actor: ActorContext, query: CountryListQuery): Promise<PaginatedServiceResult<CountryListItem>> {
		return this.reads.listCountries(actor, query);
	}

	public async getCountry(actor: ActorContext, id: number): Promise<Country> {
		return found(await this.reads.getCountry(actor, id), "country", id);
	}

	public listStates(actor: ActorContext, query: StateListQuery): Promise<PaginatedServiceResult<StateListItem>> {
		return this.reads.listStates(actor, query);
	}

	public async getState(actor: ActorContext, id: number): Promise<State> {
		return found(await this.reads.getState(actor, id), "state", id);
	}

	public listCities(actor: ActorContext, query: CityListQuery): Promise<PaginatedServiceResult<CityListItem>> {
		return this.reads.listCities(actor, query);
	}

	public async getCity(actor: ActorContext, id: number): Promise<City> {
		return found(await this.reads.getCity(actor, id), "city", id);
	}

	// ── Writes ─────────────────────────────────────────────────────────

	public createRegion(actor: ActorContext, input: CreateRegionInput): Promise<Region> {
		return this.write(actor, ({ geography }) => geography.createRegion(withSanitizedGeoName(input)));
	}

	public updateRegion(actor: ActorContext, id: number, input: UpdateRegionInput): Promise<Region> {
		return this.write(actor, async ({ geography }) => found(await geography.updateRegion(id, withSanitizedGeoName(input), this.clock.now()), "region", id));
	}

	public deleteRegion(actor: ActorContext, id: number): Promise<MessageResponse> {
		return this.softDelete(actor, "region", id);
	}

	public createSubregion(actor: ActorContext, input: CreateSubregionInput): Promise<Subregion> {
		return this.write(actor, async ({ geography }) => {
			await assertLiveParent(geography, "region", "regionId", input.regionId);
			return geography.createSubregion(withSanitizedGeoName(input));
		});
	}

	public updateSubregion(actor: ActorContext, id: number, input: UpdateSubregionInput): Promise<Subregion> {
		return this.write(actor, async ({ geography }) => {
			await assertLiveParent(geography, "region", "regionId", input.regionId);
			return found(await geography.updateSubregion(id, withSanitizedGeoName(input), this.clock.now()), "subregion", id);
		});
	}

	public deleteSubregion(actor: ActorContext, id: number): Promise<MessageResponse> {
		return this.softDelete(actor, "subregion", id);
	}

	public createCountry(actor: ActorContext, input: CreateCountryInput): Promise<Country> {
		return this.write(actor, async ({ geography }) => {
			await assertCountryParents(geography, input.regionId, input.subregionId);
			return geography.createCountry(withSanitizedGeoName(input));
		});
	}

	public updateCountry(actor: ActorContext, id: number, input: UpdateCountryInput): Promise<Country> {
		return this.write(actor, async ({ geography }) => {
			await assertCountryParents(geography, input.regionId, input.subregionId);
			return found(await geography.updateCountry(id, withSanitizedGeoName(input), this.clock.now()), "country", id);
		});
	}

	public deleteCountry(actor: ActorContext, id: number): Promise<MessageResponse> {
		return this.softDelete(actor, "country", id);
	}

	public createState(actor: ActorContext, input: CreateStateInput): Promise<State> {
		return this.write(actor, async ({ geography }) => {
			await assertLiveParent(geography, "country", "countryId", input.countryId);
			return geography.createState(withSanitizedGeoName(input));
		});
	}

	public updateState(actor: ActorContext, id: number, input: UpdateStateInput): Promise<State> {
		return this.write(actor, async ({ geography }) => {
			await assertLiveParent(geography, "country", "countryId", input.countryId);
			return found(await geography.updateState(id, withSanitizedGeoName(input), this.clock.now()), "state", id);
		});
	}

	public deleteState(actor: ActorContext, id: number): Promise<MessageResponse> {
		return this.softDelete(actor, "state", id);
	}

	public createCity(actor: ActorContext, input: CreateCityInput): Promise<City> {
		return this.write(actor, async ({ geography }) => {
			await assertLiveParent(geography, "state", "stateId", input.stateId);
			await assertLiveParent(geography, "country", "countryId", input.countryId);
			return geography.createCity(withSanitizedGeoName(input));
		});
	}

	public updateCity(actor: ActorContext, id: number, input: UpdateCityInput): Promise<City> {
		return this.write(actor, async ({ geography }) => {
			await assertLiveParent(geography, "state", "stateId", input.stateId);
			await assertLiveParent(geography, "country", "countryId", input.countryId);
			return found(await geography.updateCity(id, withSanitizedGeoName(input), this.clock.now()), "city", id);
		});
	}

	public deleteCity(actor: ActorContext, id: number): Promise<MessageResponse> {
		return this.softDelete(actor, "city", id);
	}

	/**
	 * Bulk import inside ONE write transaction: the advisory lock first, then
	 * every row validated, its parents checked against live rows, and (with
	 * `upsert`) matched by natural key. Unexpected database errors are NOT row
	 * errors: they abort the whole import, so nothing is half-written.
	 */
	public importData(actor: ActorContext, input: GeoImportInput): Promise<GeoImportResult> {
		return this.write(actor, async ({ geography }) => {
			await geography.lockImports();
			const { valid, errors } = splitGeoImportRows(input.entity, input.data);
			const missingParents = missingGeoImportParents(valid, await liveImportParents(geography, geoImportParentIds(valid)));
			const existingKeys: ReadonlyMap<string, number> = input.upsert
				? await liveNaturalKeys(
						geography,
						input.entity,
						valid.map(({ value }) => value.row.name),
					)
				: new Map();
			const plan: GeoImportPlan = planGeoImport({ valid, invalid: errors, missingParents, existingKeys, upsert: input.upsert });
			await geography.touch(input.entity, plan.toTouch, this.clock.now());
			await geography.insertImportRows(plan.toCreate);
			return plan.result;
		});
	}

	/** Soft-deletes a live row, then every live descendant bottom-up, all stamped with the same actor and instant. */
	private softDelete(actor: ActorContext, entity: GeoEntityKind, id: number): Promise<MessageResponse> {
		return this.write(actor, async ({ geography }, stamp) => {
			if (!(await geography.softDelete(entity, id, stamp))) {
				throw geoNotFound(entity, id);
			}
			if (entity !== "city") {
				for (const level of cascadeDeleteOrder(entity)) {
					await geography.softDeleteDescendants(entity, id, level, stamp);
				}
			}
			return deletedMessage(entity, id);
		});
	}

	/** Run one geo write as the signed-in user, audited in the same transaction. */
	private async write<TResult extends object>(actor: ActorContext, work: (scope: ReferenceDataScope, stamp: GeoDeletionStamp) => Promise<TResult>): Promise<TResult> {
		if (actor.kind !== "user") {
			throw geoWriterMissing();
		}
		const stamp: GeoDeletionStamp = { deletedBy: actor.userId, deletedAt: this.clock.now() };
		return this.unitOfWork.runSystemOperation(GEO_WRITE_OPERATION, actor, async (scope: ReferenceDataScope): Promise<TResult> => {
			const result: TResult = await work(scope, stamp);
			await scope.requestAudit.recordInTransaction(result);
			return result;
		});
	}
}

/** A parent the body names (when it names one) must be live. */
async function assertLiveParent(geography: GeographyRepository, entity: GeoParentKind, field: string, id: number | undefined): Promise<void> {
	if (id !== undefined && !(await geography.isLive(entity, id))) {
		throw geoMissingParent(field, entity, id);
	}
}

/** A country's optional parents, when given (`null` detaches), must be live. */
async function assertCountryParents(geography: GeographyRepository, regionId: number | null | undefined, subregionId: number | null | undefined): Promise<void> {
	await assertLiveParent(geography, "region", "regionId", regionId ?? undefined);
	await assertLiveParent(geography, "subregion", "subregionId", subregionId ?? undefined);
}

/** Which parent ids of an import are live (one read per parent table that is referenced at all). */
async function liveImportParents(
	geography: GeographyRepository,
	ids: { readonly regionIds: ReadonlySet<number>; readonly countryIds: ReadonlySet<number>; readonly stateIds: ReadonlySet<number> },
): Promise<LiveGeoImportParents> {
	const live = async (entity: GeoParentKind, wanted: ReadonlySet<number>): Promise<ReadonlySet<number>> =>
		wanted.size === 0 ? new Set<number>() : geography.liveIds(entity, wanted);
	return {
		regions: await live("region", ids.regionIds),
		countries: await live("country", ids.countryIds),
		states: await live("state", ids.stateIds),
	};
}

/** Natural key → id of the live rows an `upsert` import may match. */
async function liveNaturalKeys(geography: GeographyRepository, entity: GeoEntityKind, names: readonly string[]): Promise<ReadonlyMap<string, number>> {
	const distinct: string[] = [...new Set(names)];
	if (distinct.length === 0) {
		return new Map<string, number>();
	}
	const rows: readonly GeoNamedRow[] = await geography.liveNamedRows(entity, distinct);
	return new Map(rows.map((row): [string, number] => [geoNaturalKey(entity, row.name, row.parentId), row.id]));
}

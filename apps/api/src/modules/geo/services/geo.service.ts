import { Injectable } from "@nestjs/common";
import { nowEpochMs } from "@workspace/shared";

import type {
	CascadePreviewResult,
	City,
	CityListItem,
	Country,
	CountryListItem,
	GeoAutocompleteItem,
	GeoImportResult,
	GeoImportValidationResult,
	GeoStats,
	MessageResponse,
	PaginatedServiceResult,
	Region,
	RegionListItem,
	State,
	StateListItem,
	Subregion,
	SubregionListItem,
	CityListQuery,
	CountryListQuery,
	CreateCityInput,
	CreateCountryInput,
	CreateRegionInput,
	CreateStateInput,
	CreateSubregionInput,
	GeoAutocompleteQuery,
	GeoExportQuery,
	GeoImportInput,
	GeoImportValidateInput,
	CascadePreviewInput,
	RegionListQuery,
	StateListQuery,
	SubregionListQuery,
	UpdateCityInput,
	UpdateCountryInput,
	UpdateRegionInput,
	UpdateStateInput,
	UpdateSubregionInput,
} from "@workspace/shared";

import { AuditTrailService } from "../../../common/audit/audit-trail.service";
import { RequestContextService } from "../../../common/context/request-context";
import { AuthenticationError } from "../../../common/errors/app-error";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";
import { GeoRepository, type GeoDeletionStamp, type GeoWriteTransaction } from "../repositories/geo.repository";

/** The one system operation geo writes run under — the only session the geo `*_write` RLS policies accept. */
export const GEO_WRITE_OPERATION = "geo.reference_data.write";

/**
 * Geo reference data. Reads are public-to-authenticated (`GEO:READ`); every
 * write is SuperAdmin-only (controller) and runs in ONE transaction under the
 * `geo.reference_data.write` system operation, with the request's audit row
 * appended in that same transaction (it commits or rolls back with the change).
 */
@Injectable()
export class GeoService {
	public constructor(
		private readonly repository: GeoRepository,
		private readonly tenantTx: TenantTransactionService,
		private readonly requestContext: RequestContextService,
		private readonly auditTrail: AuditTrailService,
	) {}

	/** Run one geo write as the verified actor, audited in the same transaction. */
	private async write<T extends object>(reason: string, work: (tx: GeoWriteTransaction, actorUserId: string) => Promise<T>): Promise<T> {
		const actorUserId: string | undefined = this.requestContext.current()?.principal?.userId;
		if (actorUserId === undefined) {
			throw new AuthenticationError({ message: "Geo writes require an authenticated SuperAdmin." });
		}
		return this.tenantTx.withSystemOperation({ operation: GEO_WRITE_OPERATION, reason, actorUserId }, async (tx): Promise<T> => {
			const result: T = await work(tx, actorUserId);
			await this.auditTrail.recordInTransaction(tx, result);
			return result;
		});
	}

	private static deletionStamp(actorUserId: string): GeoDeletionStamp {
		return { deletedBy: actorUserId, deletedAt: nowEpochMs() };
	}

	public getStats(): Promise<GeoStats> {
		return this.repository.getStats();
	}

	public autocomplete(query: GeoAutocompleteQuery): Promise<readonly GeoAutocompleteItem[]> {
		return this.repository.autocomplete(query);
	}

	public importData(input: GeoImportInput): Promise<GeoImportResult> {
		return this.write("Import geo reference data", async (tx) => this.repository.importData(tx, input));
	}

	public validateImport(input: GeoImportValidateInput): GeoImportValidationResult {
		return this.repository.validateImport(input);
	}

	public exportData(query: GeoExportQuery): Promise<readonly City[]> {
		return this.repository.exportData(query);
	}

	public cascadePreview(input: CascadePreviewInput): Promise<CascadePreviewResult> {
		return this.repository.cascadePreview(input);
	}

	public listRegions(query: RegionListQuery): Promise<PaginatedServiceResult<RegionListItem>> {
		return this.repository.listRegions(query);
	}

	public getRegion(id: number): Promise<Region> {
		return this.repository.getRegion(id);
	}

	public createRegion(input: CreateRegionInput): Promise<Region> {
		return this.write("Create region", async (tx) => this.repository.createRegion(tx, input));
	}

	public updateRegion(id: number, input: UpdateRegionInput): Promise<Region> {
		return this.write("Update region", async (tx) => this.repository.updateRegion(tx, id, input));
	}

	public deleteRegion(id: number): Promise<MessageResponse> {
		return this.write("Soft-delete region", async (tx, actorUserId) => this.repository.deleteRegion(tx, id, GeoService.deletionStamp(actorUserId)));
	}

	public listSubregions(query: SubregionListQuery): Promise<PaginatedServiceResult<SubregionListItem>> {
		return this.repository.listSubregions(query);
	}

	public getSubregion(id: number): Promise<Subregion> {
		return this.repository.getSubregion(id);
	}

	public createSubregion(input: CreateSubregionInput): Promise<Subregion> {
		return this.write("Create subregion", async (tx) => this.repository.createSubregion(tx, input));
	}

	public updateSubregion(id: number, input: UpdateSubregionInput): Promise<Subregion> {
		return this.write("Update subregion", async (tx) => this.repository.updateSubregion(tx, id, input));
	}

	public deleteSubregion(id: number): Promise<MessageResponse> {
		return this.write("Soft-delete subregion", async (tx, actorUserId) => this.repository.deleteSubregion(tx, id, GeoService.deletionStamp(actorUserId)));
	}

	public listCountries(query: CountryListQuery): Promise<PaginatedServiceResult<CountryListItem>> {
		return this.repository.listCountries(query);
	}

	public getCountry(id: number): Promise<Country> {
		return this.repository.getCountry(id);
	}

	public createCountry(input: CreateCountryInput): Promise<Country> {
		return this.write("Create country", async (tx) => this.repository.createCountry(tx, input));
	}

	public updateCountry(id: number, input: UpdateCountryInput): Promise<Country> {
		return this.write("Update country", async (tx) => this.repository.updateCountry(tx, id, input));
	}

	public deleteCountry(id: number): Promise<MessageResponse> {
		return this.write("Soft-delete country", async (tx, actorUserId) => this.repository.deleteCountry(tx, id, GeoService.deletionStamp(actorUserId)));
	}

	public listStates(query: StateListQuery): Promise<PaginatedServiceResult<StateListItem>> {
		return this.repository.listStates(query);
	}

	public getState(id: number): Promise<State> {
		return this.repository.getState(id);
	}

	public createState(input: CreateStateInput): Promise<State> {
		return this.write("Create state", async (tx) => this.repository.createState(tx, input));
	}

	public updateState(id: number, input: UpdateStateInput): Promise<State> {
		return this.write("Update state", async (tx) => this.repository.updateState(tx, id, input));
	}

	public deleteState(id: number): Promise<MessageResponse> {
		return this.write("Soft-delete state", async (tx, actorUserId) => this.repository.deleteState(tx, id, GeoService.deletionStamp(actorUserId)));
	}

	public listCities(query: CityListQuery): Promise<PaginatedServiceResult<CityListItem>> {
		return this.repository.listCities(query);
	}

	public getCity(id: number): Promise<City> {
		return this.repository.getCity(id);
	}

	public createCity(input: CreateCityInput): Promise<City> {
		return this.write("Create city", async (tx) => this.repository.createCity(tx, input));
	}

	public updateCity(id: number, input: UpdateCityInput): Promise<City> {
		return this.write("Update city", async (tx) => this.repository.updateCity(tx, id, input));
	}

	public deleteCity(id: number): Promise<MessageResponse> {
		return this.write("Soft-delete city", async (tx, actorUserId) => this.repository.deleteCity(tx, id, GeoService.deletionStamp(actorUserId)));
	}
}

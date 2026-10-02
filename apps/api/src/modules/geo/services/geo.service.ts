import { Injectable } from "@nestjs/common";

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

import { GeoRepository } from "../repositories/geo.repository";

@Injectable()
export class GeoService {
	public constructor(private readonly repository: GeoRepository) {}

	public getStats(): Promise<GeoStats> {
		return this.repository.getStats();
	}

	public autocomplete(query: GeoAutocompleteQuery): Promise<readonly GeoAutocompleteItem[]> {
		return this.repository.autocomplete(query);
	}

	public importData(input: GeoImportInput): Promise<GeoImportResult> {
		return this.repository.importData(input);
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
		return this.repository.createRegion(input);
	}

	public updateRegion(id: number, input: UpdateRegionInput): Promise<Region> {
		return this.repository.updateRegion(id, input);
	}

	public deleteRegion(id: number): Promise<MessageResponse> {
		return this.repository.deleteRegion(id);
	}

	public listSubregions(query: SubregionListQuery): Promise<PaginatedServiceResult<SubregionListItem>> {
		return this.repository.listSubregions(query);
	}

	public getSubregion(id: number): Promise<Subregion> {
		return this.repository.getSubregion(id);
	}

	public createSubregion(input: CreateSubregionInput): Promise<Subregion> {
		return this.repository.createSubregion(input);
	}

	public updateSubregion(id: number, input: UpdateSubregionInput): Promise<Subregion> {
		return this.repository.updateSubregion(id, input);
	}

	public deleteSubregion(id: number): Promise<MessageResponse> {
		return this.repository.deleteSubregion(id);
	}

	public listCountries(query: CountryListQuery): Promise<PaginatedServiceResult<CountryListItem>> {
		return this.repository.listCountries(query);
	}

	public getCountry(id: number): Promise<Country> {
		return this.repository.getCountry(id);
	}

	public createCountry(input: CreateCountryInput): Promise<Country> {
		return this.repository.createCountry(input);
	}

	public updateCountry(id: number, input: UpdateCountryInput): Promise<Country> {
		return this.repository.updateCountry(id, input);
	}

	public deleteCountry(id: number): Promise<MessageResponse> {
		return this.repository.deleteCountry(id);
	}

	public listStates(query: StateListQuery): Promise<PaginatedServiceResult<StateListItem>> {
		return this.repository.listStates(query);
	}

	public getState(id: number): Promise<State> {
		return this.repository.getState(id);
	}

	public createState(input: CreateStateInput): Promise<State> {
		return this.repository.createState(input);
	}

	public updateState(id: number, input: UpdateStateInput): Promise<State> {
		return this.repository.updateState(id, input);
	}

	public deleteState(id: number): Promise<MessageResponse> {
		return this.repository.deleteState(id);
	}

	public listCities(query: CityListQuery): Promise<PaginatedServiceResult<CityListItem>> {
		return this.repository.listCities(query);
	}

	public getCity(id: number): Promise<City> {
		return this.repository.getCity(id);
	}

	public createCity(input: CreateCityInput): Promise<City> {
		return this.repository.createCity(input);
	}

	public updateCity(id: number, input: UpdateCityInput): Promise<City> {
		return this.repository.updateCity(id, input);
	}

	public deleteCity(id: number): Promise<MessageResponse> {
		return this.repository.deleteCity(id);
	}
}

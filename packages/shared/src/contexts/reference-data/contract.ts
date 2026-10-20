// API contract leaves owned by the `reference-data` context (plan §7: the backend owner of each
// endpoint). Composed into `apiContract` (`src/contracts/index.ts`) with identical keys.

import { z } from "zod";

import { defineContract } from "../../contracts/define-contract";
import { paginatedResponse, singleResponse } from "../../contracts/response";
import { MessageResponseSchema } from "../../schemas/api/message";
import { geoRoutes } from "./routes";
import {
	CascadePreviewSchema,
	CityListQuerySchema,
	CountryListQuerySchema,
	CreateCitySchema,
	CreateCountrySchema,
	CreateRegionSchema,
	CreateStateSchema,
	CreateSubregionSchema,
	GeoAutocompleteQuerySchema,
	GeoExportQuerySchema,
	GeoIdParamSchema,
	GeoImportInputSchema,
	GeoImportValidateInputSchema,
	RegionListQuerySchema,
	StateListQuerySchema,
	SubregionListQuerySchema,
	UpdateCitySchema,
	UpdateCountrySchema,
	UpdateRegionSchema,
	UpdateStateSchema,
	UpdateSubregionSchema,
} from "./schemas/geo";
import { CitySchema } from "./schemas/geo-city";
import { CountrySchema } from "./schemas/geo-country";
import { CityListItemSchema, CountryListItemSchema, RegionListItemSchema, StateListItemSchema, SubregionListItemSchema } from "./schemas/geo-list-items";
import { RegionSchema } from "./schemas/geo-region";
import { StateSchema } from "./schemas/geo-state";
import { SubregionSchema } from "./schemas/geo-subregion";
import {
	CascadePreviewResultSchema,
	GeoAutocompleteResponseSchema,
	GeoExportResponseSchema,
	GeoImportResultSchema,
	GeoImportValidationResultSchema,
	GeoStatsSchema,
} from "./schemas/geo-tools";

// ── Geo (Country / State / City) ────────────────────────────────

/** Contract leaves composed into `apiContract.geo`. */
export const geoContract = {
	// Stats & utility
	stats: defineContract({ method: "GET", path: geoRoutes.stats, input: z.object({}).strict(), response: singleResponse(GeoStatsSchema) }),
	autocomplete: defineContract({
		method: "GET",
		path: geoRoutes.autocomplete,
		input: GeoAutocompleteQuerySchema,
		response: singleResponse(GeoAutocompleteResponseSchema),
	}),
	importData: defineContract({ method: "POST", path: geoRoutes.import, input: GeoImportInputSchema, response: singleResponse(GeoImportResultSchema) }),
	importValidate: defineContract({
		method: "POST",
		path: geoRoutes.importValidate,
		input: GeoImportValidateInputSchema,
		response: singleResponse(GeoImportValidationResultSchema),
	}),
	exportData: defineContract({ method: "GET", path: geoRoutes.export, input: GeoExportQuerySchema, response: singleResponse(GeoExportResponseSchema) }),
	cascadePreview: defineContract({ method: "GET", path: geoRoutes.cascadePreview, input: CascadePreviewSchema, response: singleResponse(CascadePreviewResultSchema) }),
	// Regions
	regions: defineContract({ method: "GET", path: geoRoutes.regions, input: RegionListQuerySchema, response: paginatedResponse(RegionListItemSchema) }),
	regionDetail: defineContract({ method: "GET", path: geoRoutes.regionDetail, input: GeoIdParamSchema, response: singleResponse(RegionSchema) }),
	createRegion: defineContract({ method: "POST", path: geoRoutes.regions, input: CreateRegionSchema, response: singleResponse(RegionSchema) }),
	updateRegion: defineContract({ method: "PATCH", path: geoRoutes.regionDetail, input: UpdateRegionSchema, response: singleResponse(RegionSchema) }),
	deleteRegion: defineContract({ method: "DELETE", path: geoRoutes.regionDetail, input: GeoIdParamSchema, response: singleResponse(MessageResponseSchema) }),
	// Subregions
	subregions: defineContract({ method: "GET", path: geoRoutes.subregions, input: SubregionListQuerySchema, response: paginatedResponse(SubregionListItemSchema) }),
	subregionDetail: defineContract({ method: "GET", path: geoRoutes.subregionDetail, input: GeoIdParamSchema, response: singleResponse(SubregionSchema) }),
	createSubregion: defineContract({ method: "POST", path: geoRoutes.subregions, input: CreateSubregionSchema, response: singleResponse(SubregionSchema) }),
	updateSubregion: defineContract({ method: "PATCH", path: geoRoutes.subregionDetail, input: UpdateSubregionSchema, response: singleResponse(SubregionSchema) }),
	deleteSubregion: defineContract({ method: "DELETE", path: geoRoutes.subregionDetail, input: GeoIdParamSchema, response: singleResponse(MessageResponseSchema) }),
	// Countries
	countries: defineContract({ method: "GET", path: geoRoutes.countries, input: CountryListQuerySchema, response: paginatedResponse(CountryListItemSchema) }),
	countryDetail: defineContract({ method: "GET", path: geoRoutes.countryDetail, input: GeoIdParamSchema, response: singleResponse(CountrySchema) }),
	createCountry: defineContract({ method: "POST", path: geoRoutes.countries, input: CreateCountrySchema, response: singleResponse(CountrySchema) }),
	updateCountry: defineContract({ method: "PATCH", path: geoRoutes.countryDetail, input: UpdateCountrySchema, response: singleResponse(CountrySchema) }),
	deleteCountry: defineContract({ method: "DELETE", path: geoRoutes.countryDetail, input: GeoIdParamSchema, response: singleResponse(MessageResponseSchema) }),
	// States
	states: defineContract({ method: "GET", path: geoRoutes.states, input: StateListQuerySchema, response: paginatedResponse(StateListItemSchema) }),
	stateDetail: defineContract({ method: "GET", path: geoRoutes.stateDetail, input: GeoIdParamSchema, response: singleResponse(StateSchema) }),
	createState: defineContract({ method: "POST", path: geoRoutes.states, input: CreateStateSchema, response: singleResponse(StateSchema) }),
	updateState: defineContract({ method: "PATCH", path: geoRoutes.stateDetail, input: UpdateStateSchema, response: singleResponse(StateSchema) }),
	deleteState: defineContract({ method: "DELETE", path: geoRoutes.stateDetail, input: GeoIdParamSchema, response: singleResponse(MessageResponseSchema) }),
	// Cities
	cities: defineContract({ method: "GET", path: geoRoutes.cities, input: CityListQuerySchema, response: paginatedResponse(CityListItemSchema) }),
	cityDetail: defineContract({ method: "GET", path: geoRoutes.cityDetail, input: GeoIdParamSchema, response: singleResponse(CitySchema) }),
	createCity: defineContract({ method: "POST", path: geoRoutes.cities, input: CreateCitySchema, response: singleResponse(CitySchema) }),
	updateCity: defineContract({ method: "PATCH", path: geoRoutes.cityDetail, input: UpdateCitySchema, response: singleResponse(CitySchema) }),
	deleteCity: defineContract({ method: "DELETE", path: geoRoutes.cityDetail, input: GeoIdParamSchema, response: singleResponse(MessageResponseSchema) }),
};

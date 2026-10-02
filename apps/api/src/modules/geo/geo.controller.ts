import { Controller, Delete, Get, Header, HttpStatus, Patch, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { z } from "zod";

import {
	apiContract,
	apiPath,
	GeoAutocompleteQuerySchema,
	CascadePreviewSchema,
	GeoExportQuerySchema,
	GeoIdParamSchema,
	GeoImportInputSchema,
	GeoImportValidateInputSchema,
	CascadePreviewResultSchema,
	CityListItemSchema,
	CitySchema,
	CountryListItemSchema,
	CountrySchema,
	GeoAutocompleteResponseSchema,
	GeoExportResponseSchema,
	GeoImportResultSchema,
	GeoImportValidationResultSchema,
	GeoStatsSchema,
	MessageResponseSchema,
	RegionListItemSchema,
	RegionSchema,
	StateListItemSchema,
	StateSchema,
	SubregionListItemSchema,
	SubregionSchema,
} from "@workspace/shared";
import { ZodBody, ZodListQuery, ZodQuery, ZodParams } from "../../common/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../common/decorators/zod-response.decorators";

import { RequirePermission } from "../auth/decorators/require-permission.decorator";
import { Authorize } from "../authorization/decorators/authorize.decorator";

import { GeoService } from "./services/geo.service";

@ApiTags("Geo")
@Controller(apiPath("/geo"))
export class GeoController {
	public constructor(private readonly geoService: GeoService) {}

	// ── Stats ──────────────────────────────────────────────────────────

	@RequirePermission("READ", "GEO")
	@Get("stats")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "Get geo entity counts" })
	@ZodResponse(GeoStatsSchema, { description: "Entity counts for regions, subregions, countries, states, and cities" })
	public getStats(): ReturnType<GeoService["getStats"]> {
		return this.geoService.getStats();
	}

	// ── Autocomplete ───────────────────────────────────────────────────

	@RequirePermission("READ", "GEO")
	@Get("autocomplete")
	@Header("Cache-Control", "public, max-age=300")
	@ApiOperation({ summary: "Autocomplete search across all geo entities" })
	@ZodResponse(GeoAutocompleteResponseSchema, { description: "Matching geo items" })
	public autocomplete(@ZodQuery(GeoAutocompleteQuerySchema) query: z.output<typeof GeoAutocompleteQuerySchema>): ReturnType<GeoService["autocomplete"]> {
		return this.geoService.autocomplete(query);
	}

	// ── Import ──────────────────────────────────────────────────────────

	@RequirePermission("CREATE", "GEO")
	@Authorize({ action: "CREATE", resource: "GEO", description: "Import geo data" })
	@Post("import")
	@ApiOperation({ summary: "Bulk import geo data" })
	@ZodResponse(GeoImportResultSchema, { status: HttpStatus.CREATED, description: "Import result with created/updated/skipped counts" })
	public importData(@ZodBody(GeoImportInputSchema) body: z.output<typeof GeoImportInputSchema>): ReturnType<GeoService["importData"]> {
		return this.geoService.importData(body);
	}

	@RequirePermission("READ", "GEO")
	@Post("import/validate")
	@ApiOperation({ summary: "Validate geo import data without inserting" })
	@ZodResponse(GeoImportValidationResultSchema, { status: HttpStatus.CREATED, description: "Validation result with row-level errors" })
	public validateImport(@ZodBody(GeoImportValidateInputSchema) body: z.output<typeof GeoImportValidateInputSchema>): ReturnType<GeoService["validateImport"]> {
		return this.geoService.validateImport(body);
	}

	// ── Export ──────────────────────────────────────────────────────────

	@RequirePermission("READ", "GEO")
	@Get("export")
	@Header("Cache-Control", "public, max-age=360")
	@ApiOperation({ summary: "Export the cities of the matching countries (rows are always JSON; `format=csv` is not rendered server-side)" })
	@ZodResponse(GeoExportResponseSchema, { description: "City rows of every country matching countryCode / regionId" })
	public exportData(@ZodQuery(GeoExportQuerySchema) query: z.output<typeof GeoExportQuerySchema>): ReturnType<GeoService["exportData"]> {
		return this.geoService.exportData(query);
	}

	// ── Cascade Preview ─────────────────────────────────────────────────

	@RequirePermission("READ", "GEO")
	@Get("cascade-preview")
	@ApiOperation({ summary: "Preview cascade delete impact" })
	@ZodResponse(CascadePreviewResultSchema, { description: "Cascade preview with affected entity counts" })
	public cascadePreview(@ZodQuery(CascadePreviewSchema) query: z.output<typeof CascadePreviewSchema>): ReturnType<GeoService["cascadePreview"]> {
		return this.geoService.cascadePreview(query);
	}

	// ── Regions ─────────────────────────────────────────────────────────

	@RequirePermission("READ", "GEO")
	@Get("regions")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "List regions" })
	@ZodPaginatedResponse(RegionListItemSchema, { description: "Paginated list of regions" })
	public listRegions(@ZodListQuery(apiContract.geo.regions.input) query: z.output<typeof apiContract.geo.regions.input>): ReturnType<GeoService["listRegions"]> {
		return this.geoService.listRegions(query);
	}

	@RequirePermission("READ", "GEO")
	@Get("regions/:id")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "Get region by ID" })
	@ZodResponse(RegionSchema, { description: "Region detail" })
	public getRegion(@ZodParams(GeoIdParamSchema) param: { readonly id: number }): ReturnType<GeoService["getRegion"]> {
		return this.geoService.getRegion(param.id);
	}

	@RequirePermission("CREATE", "GEO")
	@Post("regions")
	@ApiOperation({ summary: "Create a region" })
	@ZodResponse(RegionSchema, { status: HttpStatus.CREATED, description: "Created region" })
	public createRegion(@ZodBody(apiContract.geo.createRegion.input) body: z.output<typeof apiContract.geo.createRegion.input>): ReturnType<GeoService["createRegion"]> {
		return this.geoService.createRegion(body);
	}

	@RequirePermission("UPDATE", "GEO")
	@Patch("regions/:id")
	@ApiOperation({ summary: "Update a region" })
	@ZodResponse(RegionSchema, { description: "Updated region" })
	public updateRegion(
		@ZodParams(GeoIdParamSchema) param: { readonly id: number },
		@ZodBody(apiContract.geo.updateRegion.input) body: z.output<typeof apiContract.geo.updateRegion.input>,
	): ReturnType<GeoService["updateRegion"]> {
		return this.geoService.updateRegion(param.id, body);
	}

	@RequirePermission("DELETE", "GEO")
	@Delete("regions/:id")
	@ApiOperation({ summary: "Delete a region" })
	@ZodResponse(MessageResponseSchema, { description: "Region deleted" })
	public deleteRegion(@ZodParams(GeoIdParamSchema) param: { readonly id: number }): ReturnType<GeoService["deleteRegion"]> {
		return this.geoService.deleteRegion(param.id);
	}

	// ── Subregions ──────────────────────────────────────────────────────

	@RequirePermission("READ", "GEO")
	@Get("subregions")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "List subregions" })
	@ZodPaginatedResponse(SubregionListItemSchema, { description: "Paginated list of subregions" })
	public listSubregions(@ZodListQuery(apiContract.geo.subregions.input) query: z.output<typeof apiContract.geo.subregions.input>): ReturnType<GeoService["listSubregions"]> {
		return this.geoService.listSubregions(query);
	}

	@RequirePermission("READ", "GEO")
	@Get("subregions/:id")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "Get subregion by ID" })
	@ZodResponse(SubregionSchema, { description: "Subregion detail" })
	public getSubregion(@ZodParams(GeoIdParamSchema) param: { readonly id: number }): ReturnType<GeoService["getSubregion"]> {
		return this.geoService.getSubregion(param.id);
	}

	@RequirePermission("CREATE", "GEO")
	@Post("subregions")
	@ApiOperation({ summary: "Create a subregion" })
	@ZodResponse(SubregionSchema, { status: HttpStatus.CREATED, description: "Created subregion" })
	public createSubregion(
		@ZodBody(apiContract.geo.createSubregion.input) body: z.output<typeof apiContract.geo.createSubregion.input>,
	): ReturnType<GeoService["createSubregion"]> {
		return this.geoService.createSubregion(body);
	}

	@RequirePermission("UPDATE", "GEO")
	@Patch("subregions/:id")
	@ApiOperation({ summary: "Update a subregion" })
	@ZodResponse(SubregionSchema, { description: "Updated subregion" })
	public updateSubregion(
		@ZodParams(GeoIdParamSchema) param: { readonly id: number },
		@ZodBody(apiContract.geo.updateSubregion.input) body: z.output<typeof apiContract.geo.updateSubregion.input>,
	): ReturnType<GeoService["updateSubregion"]> {
		return this.geoService.updateSubregion(param.id, body);
	}

	@RequirePermission("DELETE", "GEO")
	@Delete("subregions/:id")
	@ApiOperation({ summary: "Delete a subregion" })
	@ZodResponse(MessageResponseSchema, { description: "Subregion deleted" })
	public deleteSubregion(@ZodParams(GeoIdParamSchema) param: { readonly id: number }): ReturnType<GeoService["deleteSubregion"]> {
		return this.geoService.deleteSubregion(param.id);
	}

	// ── Countries ───────────────────────────────────────────────────────

	@RequirePermission("READ", "GEO")
	@Get("countries")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "List countries" })
	@ZodPaginatedResponse(CountryListItemSchema, { description: "Paginated list of countries" })
	public listCountries(@ZodListQuery(apiContract.geo.countries.input) query: z.output<typeof apiContract.geo.countries.input>): ReturnType<GeoService["listCountries"]> {
		return this.geoService.listCountries(query);
	}

	@RequirePermission("READ", "GEO")
	@Get("countries/:id")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "Get country by ID" })
	@ZodResponse(CountrySchema, { description: "Country detail" })
	public getCountry(@ZodParams(GeoIdParamSchema) param: { readonly id: number }): ReturnType<GeoService["getCountry"]> {
		return this.geoService.getCountry(param.id);
	}

	@RequirePermission("CREATE", "GEO")
	@Post("countries")
	@ApiOperation({ summary: "Create a country" })
	@ZodResponse(CountrySchema, { status: HttpStatus.CREATED, description: "Created country" })
	public createCountry(@ZodBody(apiContract.geo.createCountry.input) body: z.output<typeof apiContract.geo.createCountry.input>): ReturnType<GeoService["createCountry"]> {
		return this.geoService.createCountry(body);
	}

	@RequirePermission("UPDATE", "GEO")
	@Patch("countries/:id")
	@ApiOperation({ summary: "Update a country" })
	@ZodResponse(CountrySchema, { description: "Updated country" })
	public updateCountry(
		@ZodParams(GeoIdParamSchema) param: { readonly id: number },
		@ZodBody(apiContract.geo.updateCountry.input) body: z.output<typeof apiContract.geo.updateCountry.input>,
	): ReturnType<GeoService["updateCountry"]> {
		return this.geoService.updateCountry(param.id, body);
	}

	@RequirePermission("DELETE", "GEO")
	@Delete("countries/:id")
	@ApiOperation({ summary: "Delete a country" })
	@ZodResponse(MessageResponseSchema, { description: "Country deleted" })
	public deleteCountry(@ZodParams(GeoIdParamSchema) param: { readonly id: number }): ReturnType<GeoService["deleteCountry"]> {
		return this.geoService.deleteCountry(param.id);
	}

	// ── States ──────────────────────────────────────────────────────────

	@RequirePermission("READ", "GEO")
	@Get("states")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "List states" })
	@ZodPaginatedResponse(StateListItemSchema, { description: "Paginated list of states" })
	public listStates(@ZodListQuery(apiContract.geo.states.input) query: z.output<typeof apiContract.geo.states.input>): ReturnType<GeoService["listStates"]> {
		return this.geoService.listStates(query);
	}

	@RequirePermission("READ", "GEO")
	@Get("states/:id")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "Get state by ID" })
	@ZodResponse(StateSchema, { description: "State detail" })
	public getState(@ZodParams(GeoIdParamSchema) param: { readonly id: number }): ReturnType<GeoService["getState"]> {
		return this.geoService.getState(param.id);
	}

	@RequirePermission("CREATE", "GEO")
	@Post("states")
	@ApiOperation({ summary: "Create a state" })
	@ZodResponse(StateSchema, { status: HttpStatus.CREATED, description: "Created state" })
	public createState(@ZodBody(apiContract.geo.createState.input) body: z.output<typeof apiContract.geo.createState.input>): ReturnType<GeoService["createState"]> {
		return this.geoService.createState(body);
	}

	@RequirePermission("UPDATE", "GEO")
	@Patch("states/:id")
	@ApiOperation({ summary: "Update a state" })
	@ZodResponse(StateSchema, { description: "Updated state" })
	public updateState(
		@ZodParams(GeoIdParamSchema) param: { readonly id: number },
		@ZodBody(apiContract.geo.updateState.input) body: z.output<typeof apiContract.geo.updateState.input>,
	): ReturnType<GeoService["updateState"]> {
		return this.geoService.updateState(param.id, body);
	}

	@RequirePermission("DELETE", "GEO")
	@Delete("states/:id")
	@ApiOperation({ summary: "Delete a state" })
	@ZodResponse(MessageResponseSchema, { description: "State deleted" })
	public deleteState(@ZodParams(GeoIdParamSchema) param: { readonly id: number }): ReturnType<GeoService["deleteState"]> {
		return this.geoService.deleteState(param.id);
	}

	// ── Cities ──────────────────────────────────────────────────────────

	@RequirePermission("READ", "GEO")
	@Get("cities")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "List cities" })
	@ZodPaginatedResponse(CityListItemSchema, { description: "Paginated list of cities" })
	public listCities(@ZodListQuery(apiContract.geo.cities.input) query: z.output<typeof apiContract.geo.cities.input>): ReturnType<GeoService["listCities"]> {
		return this.geoService.listCities(query);
	}

	@RequirePermission("READ", "GEO")
	@Get("cities/:id")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "Get city by ID" })
	@ZodResponse(CitySchema, { description: "City detail" })
	public getCity(@ZodParams(GeoIdParamSchema) param: { readonly id: number }): ReturnType<GeoService["getCity"]> {
		return this.geoService.getCity(param.id);
	}

	@RequirePermission("CREATE", "GEO")
	@Post("cities")
	@ApiOperation({ summary: "Create a city" })
	@ZodResponse(CitySchema, { status: HttpStatus.CREATED, description: "Created city" })
	public createCity(@ZodBody(apiContract.geo.createCity.input) body: z.output<typeof apiContract.geo.createCity.input>): ReturnType<GeoService["createCity"]> {
		return this.geoService.createCity(body);
	}

	@RequirePermission("UPDATE", "GEO")
	@Patch("cities/:id")
	@ApiOperation({ summary: "Update a city" })
	@ZodResponse(CitySchema, { description: "Updated city" })
	public updateCity(
		@ZodParams(GeoIdParamSchema) param: { readonly id: number },
		@ZodBody(apiContract.geo.updateCity.input) body: z.output<typeof apiContract.geo.updateCity.input>,
	): ReturnType<GeoService["updateCity"]> {
		return this.geoService.updateCity(param.id, body);
	}

	@RequirePermission("DELETE", "GEO")
	@Delete("cities/:id")
	@ApiOperation({ summary: "Delete a city" })
	@ZodResponse(MessageResponseSchema, { description: "City deleted" })
	public deleteCity(@ZodParams(GeoIdParamSchema) param: { readonly id: number }): ReturnType<GeoService["deleteCity"]> {
		return this.geoService.deleteCity(param.id);
	}
}

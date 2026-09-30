import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiOkResponse, ApiQuery } from "@nestjs/swagger";
import type { z } from "zod";
import type { City, Country, Region, State, Subregion } from "@prisma/client";

import {
	apiContract,
	apiPath,
	GeoAutocompleteQuerySchema,
	CascadePreviewSchema,
	GeoExportQuerySchema,
	GeoIdParamSchema,
	GeoImportInputSchema,
	GeoImportValidateInputSchema,
} from "@workspace/shared";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";

import { RequirePermission } from "../auth/decorators/require-permission.decorator";
import { Authorize } from "../authorization/decorators/authorize.decorator";

import {
	GeoService,
	type AutocompleteItem,
	type CascadePreviewResult,
	type GeoStats,
	type ImportResult,
	type ImportValidationResult,
	type ListResult,
} from "./services/geo.service";

@ApiTags("Geo")
@Controller(apiPath("/geo"))
export class GeoController {
	public constructor(private readonly geoService: GeoService) {}

	// ── Stats ──────────────────────────────────────────────────────────

	@RequirePermission("READ", "GEO")
	@Get("stats")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "Get geo entity counts" })
	@ApiOkResponse({ description: "Entity counts for regions, subregions, countries, states, and cities" })
	public getStats(): Promise<GeoStats> {
		return this.geoService.getStats();
	}

	// ── Autocomplete ───────────────────────────────────────────────────

	@RequirePermission("READ", "GEO")
	@Get("autocomplete")
	@Header("Cache-Control", "public, max-age=300")
	@ApiOperation({ summary: "Autocomplete search across all geo entities" })
	@ApiOkResponse({ description: "Matching geo items" })
	@ApiQuery({ name: "q", required: true, description: "Search query" })
	@ApiQuery({ name: "country", required: false, description: "ISO 3166-1 alpha-2 country code to scope results" })
	@ApiQuery({ name: "limit", required: false, description: "Max results (1-20)", example: 10 })
	public autocomplete(@Query(new ZodValidationPipe(GeoAutocompleteQuerySchema)) query: z.output<typeof GeoAutocompleteQuerySchema>): Promise<readonly AutocompleteItem[]> {
		return this.geoService.autocomplete(query);
	}

	// ── Import ──────────────────────────────────────────────────────────

	@RequirePermission("CREATE", "GEO")
	@Authorize({ action: "CREATE", resource: "GEO", description: "Import geo data" })
	@Post("import")
	@ApiOperation({ summary: "Bulk import geo data" })
	@ApiOkResponse({ description: "Import result with created/updated/skipped counts" })
	public async importData(@Body(new ZodValidationPipe(GeoImportInputSchema)) body: z.output<typeof GeoImportInputSchema>): Promise<ImportResult> {
		return this.geoService.importData(body);
	}

	@RequirePermission("READ", "GEO")
	@Post("import/validate")
	@ApiOperation({ summary: "Validate geo import data without inserting" })
	@ApiOkResponse({ description: "Validation result with row-level errors" })
	public validateImport(@Body(new ZodValidationPipe(GeoImportValidateInputSchema)) body: z.output<typeof GeoImportValidateInputSchema>): ImportValidationResult {
		return this.geoService.validateImport(body);
	}

	// ── Export ──────────────────────────────────────────────────────────

	@RequirePermission("READ", "GEO")
	@Get("export")
	@Header("Cache-Control", "public, max-age=360")
	@ApiOperation({ summary: "Export geo data as JSON or CSV" })
	@ApiOkResponse({ description: "Exported geo data" })
	@ApiQuery({ name: "format", required: false, description: "Export format (json or csv)", example: "json" })
	@ApiQuery({ name: "countryCode", required: false, description: "Filter by ISO 3166-1 alpha-2 country code" })
	@ApiQuery({ name: "regionId", required: false, description: "Filter by region ID" })
	public exportData(
		@Query(new ZodValidationPipe(GeoExportQuerySchema)) query: z.output<typeof GeoExportQuerySchema>,
	): Promise<readonly Region[] | readonly Subregion[] | readonly Country[] | readonly State[] | readonly City[]> {
		return this.geoService.exportData(query);
	}

	// ── Cascade Preview ─────────────────────────────────────────────────

	@RequirePermission("READ", "GEO")
	@Get("cascade-preview")
	@ApiOperation({ summary: "Preview cascade delete impact" })
	@ApiOkResponse({ description: "Cascade preview with affected entity counts" })
	@ApiQuery({ name: "entity", required: true, description: "Entity type (region, subregion, country, state)" })
	@ApiQuery({ name: "id", required: true, description: "Entity ID" })
	public cascadePreview(@Query(new ZodValidationPipe(CascadePreviewSchema)) query: z.output<typeof CascadePreviewSchema>): Promise<CascadePreviewResult> {
		return this.geoService.cascadePreview(query);
	}

	// ── Regions ─────────────────────────────────────────────────────────

	@RequirePermission("READ", "GEO")
	@Get("regions")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "List regions" })
	@ApiOkResponse({ description: "Paginated list of regions" })
	@ApiQuery({ name: "page", required: false, description: "Page number (1-based)", example: 1 })
	@ApiQuery({ name: "limit", required: false, description: "Results per page (max 100)", example: 10 })
	@ApiQuery({ name: "search", required: false, description: "Filter by name (case-insensitive)" })
	@ApiQuery({ name: "ids", required: false, description: "Comma-separated IDs for batch lookup" })
	@ApiQuery({ name: "sort", required: false, description: "Sort field (prefix with - for desc, e.g. -name)" })
	@ApiQuery({ name: "include", required: false, description: "Comma-separated related entities (e.g. subregions,countries)" })
	@ApiQuery({ name: "flag", required: false, description: "Filter by active flag" })
	public listRegions(@Query(new ZodValidationPipe(apiContract.geo.regions.input)) query: z.output<typeof apiContract.geo.regions.input>): Promise<ListResult> {
		return this.geoService.listRegions(query);
	}

	@RequirePermission("READ", "GEO")
	@Get("regions/:id")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "Get region by ID" })
	@ApiOkResponse({ description: "Region detail" })
	public getRegion(@Param("id", new ZodValidationPipe(GeoIdParamSchema)) param: { readonly id: number }): Promise<Region> {
		return this.geoService.getRegion(param.id);
	}

	@RequirePermission("CREATE", "GEO")
	@Post("regions")
	@ApiOperation({ summary: "Create a region" })
	@ApiOkResponse({ description: "Created region" })
	public createRegion(@Body(new ZodValidationPipe(apiContract.geo.createRegion.input)) body: z.output<typeof apiContract.geo.createRegion.input>): Promise<Region> {
		return this.geoService.createRegion(body);
	}

	@RequirePermission("UPDATE", "GEO")
	@Patch("regions/:id")
	@ApiOperation({ summary: "Update a region" })
	@ApiOkResponse({ description: "Updated region" })
	public updateRegion(
		@Param("id", new ZodValidationPipe(GeoIdParamSchema)) param: { readonly id: number },
		@Body(new ZodValidationPipe(apiContract.geo.updateRegion.input)) body: z.output<typeof apiContract.geo.updateRegion.input>,
	): Promise<Region> {
		return this.geoService.updateRegion(param.id, body);
	}

	@RequirePermission("DELETE", "GEO")
	@Delete("regions/:id")
	@ApiOperation({ summary: "Delete a region" })
	@ApiOkResponse({ description: "Region deleted" })
	public deleteRegion(@Param("id", new ZodValidationPipe(GeoIdParamSchema)) param: { readonly id: number }): Promise<{ readonly message: string }> {
		return this.geoService.deleteRegion(param.id);
	}

	// ── Subregions ──────────────────────────────────────────────────────

	@RequirePermission("READ", "GEO")
	@Get("subregions")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "List subregions" })
	@ApiOkResponse({ description: "Paginated list of subregions" })
	@ApiQuery({ name: "page", required: false })
	@ApiQuery({ name: "limit", required: false })
	@ApiQuery({ name: "search", required: false })
	@ApiQuery({ name: "regionId", required: false })
	@ApiQuery({ name: "ids", required: false })
	@ApiQuery({ name: "sort", required: false })
	@ApiQuery({ name: "include", required: false })
	@ApiQuery({ name: "flag", required: false })
	public listSubregions(@Query(new ZodValidationPipe(apiContract.geo.subregions.input)) query: z.output<typeof apiContract.geo.subregions.input>): Promise<ListResult> {
		return this.geoService.listSubregions(query);
	}

	@RequirePermission("READ", "GEO")
	@Get("subregions/:id")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "Get subregion by ID" })
	@ApiOkResponse({ description: "Subregion detail" })
	public getSubregion(@Param("id", new ZodValidationPipe(GeoIdParamSchema)) param: { readonly id: number }): Promise<Subregion> {
		return this.geoService.getSubregion(param.id);
	}

	@RequirePermission("CREATE", "GEO")
	@Post("subregions")
	@ApiOperation({ summary: "Create a subregion" })
	@ApiOkResponse({ description: "Created subregion" })
	public createSubregion(
		@Body(new ZodValidationPipe(apiContract.geo.createSubregion.input)) body: z.output<typeof apiContract.geo.createSubregion.input>,
	): Promise<Subregion> {
		return this.geoService.createSubregion(body);
	}

	@RequirePermission("UPDATE", "GEO")
	@Patch("subregions/:id")
	@ApiOperation({ summary: "Update a subregion" })
	@ApiOkResponse({ description: "Updated subregion" })
	public updateSubregion(
		@Param("id", new ZodValidationPipe(GeoIdParamSchema)) param: { readonly id: number },
		@Body(new ZodValidationPipe(apiContract.geo.updateSubregion.input)) body: z.output<typeof apiContract.geo.updateSubregion.input>,
	): Promise<Subregion> {
		return this.geoService.updateSubregion(param.id, body);
	}

	@RequirePermission("DELETE", "GEO")
	@Delete("subregions/:id")
	@ApiOperation({ summary: "Delete a subregion" })
	@ApiOkResponse({ description: "Subregion deleted" })
	public deleteSubregion(@Param("id", new ZodValidationPipe(GeoIdParamSchema)) param: { readonly id: number }): Promise<{ readonly message: string }> {
		return this.geoService.deleteSubregion(param.id);
	}

	// ── Countries ───────────────────────────────────────────────────────

	@RequirePermission("READ", "GEO")
	@Get("countries")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "List countries" })
	@ApiOkResponse({ description: "Paginated list of countries" })
	@ApiQuery({ name: "page", required: false })
	@ApiQuery({ name: "limit", required: false })
	@ApiQuery({ name: "search", required: false })
	@ApiQuery({ name: "iso2", required: false, description: "Filter by ISO 3166-1 alpha-2 code", example: "US" })
	@ApiQuery({ name: "regionId", required: false })
	@ApiQuery({ name: "subregionId", required: false })
	@ApiQuery({ name: "ids", required: false })
	@ApiQuery({ name: "sort", required: false })
	@ApiQuery({ name: "include", required: false })
	@ApiQuery({ name: "flag", required: false })
	public listCountries(@Query(new ZodValidationPipe(apiContract.geo.countries.input)) query: z.output<typeof apiContract.geo.countries.input>): Promise<ListResult> {
		return this.geoService.listCountries(query);
	}

	@RequirePermission("READ", "GEO")
	@Get("countries/:id")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "Get country by ID" })
	@ApiOkResponse({ description: "Country detail" })
	public getCountry(@Param("id", new ZodValidationPipe(GeoIdParamSchema)) param: { readonly id: number }): Promise<Country> {
		return this.geoService.getCountry(param.id);
	}

	@RequirePermission("CREATE", "GEO")
	@Post("countries")
	@ApiOperation({ summary: "Create a country" })
	@ApiOkResponse({ description: "Created country" })
	public createCountry(@Body(new ZodValidationPipe(apiContract.geo.createCountry.input)) body: z.output<typeof apiContract.geo.createCountry.input>): Promise<Country> {
		return this.geoService.createCountry(body);
	}

	@RequirePermission("UPDATE", "GEO")
	@Patch("countries/:id")
	@ApiOperation({ summary: "Update a country" })
	@ApiOkResponse({ description: "Updated country" })
	public updateCountry(
		@Param("id", new ZodValidationPipe(GeoIdParamSchema)) param: { readonly id: number },
		@Body(new ZodValidationPipe(apiContract.geo.updateCountry.input)) body: z.output<typeof apiContract.geo.updateCountry.input>,
	): Promise<Country> {
		return this.geoService.updateCountry(param.id, body);
	}

	@RequirePermission("DELETE", "GEO")
	@Delete("countries/:id")
	@ApiOperation({ summary: "Delete a country" })
	@ApiOkResponse({ description: "Country deleted" })
	public deleteCountry(@Param("id", new ZodValidationPipe(GeoIdParamSchema)) param: { readonly id: number }): Promise<{ readonly message: string }> {
		return this.geoService.deleteCountry(param.id);
	}

	// ── States ──────────────────────────────────────────────────────────

	@RequirePermission("READ", "GEO")
	@Get("states")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "List states" })
	@ApiOkResponse({ description: "Paginated list of states" })
	@ApiQuery({ name: "page", required: false })
	@ApiQuery({ name: "limit", required: false })
	@ApiQuery({ name: "search", required: false })
	@ApiQuery({ name: "countryId", required: false })
	@ApiQuery({ name: "countryCode", required: false, description: "Filter by ISO 3166-1 alpha-2 country code", example: "US" })
	@ApiQuery({ name: "ids", required: false })
	@ApiQuery({ name: "sort", required: false })
	@ApiQuery({ name: "include", required: false })
	@ApiQuery({ name: "flag", required: false })
	public listStates(@Query(new ZodValidationPipe(apiContract.geo.states.input)) query: z.output<typeof apiContract.geo.states.input>): Promise<ListResult> {
		return this.geoService.listStates(query);
	}

	@RequirePermission("READ", "GEO")
	@Get("states/:id")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "Get state by ID" })
	@ApiOkResponse({ description: "State detail" })
	public getState(@Param("id", new ZodValidationPipe(GeoIdParamSchema)) param: { readonly id: number }): Promise<State> {
		return this.geoService.getState(param.id);
	}

	@RequirePermission("CREATE", "GEO")
	@Post("states")
	@ApiOperation({ summary: "Create a state" })
	@ApiOkResponse({ description: "Created state" })
	public createState(@Body(new ZodValidationPipe(apiContract.geo.createState.input)) body: z.output<typeof apiContract.geo.createState.input>): Promise<State> {
		return this.geoService.createState(body);
	}

	@RequirePermission("UPDATE", "GEO")
	@Patch("states/:id")
	@ApiOperation({ summary: "Update a state" })
	@ApiOkResponse({ description: "Updated state" })
	public updateState(
		@Param("id", new ZodValidationPipe(GeoIdParamSchema)) param: { readonly id: number },
		@Body(new ZodValidationPipe(apiContract.geo.updateState.input)) body: z.output<typeof apiContract.geo.updateState.input>,
	): Promise<State> {
		return this.geoService.updateState(param.id, body);
	}

	@RequirePermission("DELETE", "GEO")
	@Delete("states/:id")
	@ApiOperation({ summary: "Delete a state" })
	@ApiOkResponse({ description: "State deleted" })
	public deleteState(@Param("id", new ZodValidationPipe(GeoIdParamSchema)) param: { readonly id: number }): Promise<{ readonly message: string }> {
		return this.geoService.deleteState(param.id);
	}

	// ── Cities ──────────────────────────────────────────────────────────

	@RequirePermission("READ", "GEO")
	@Get("cities")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "List cities" })
	@ApiOkResponse({ description: "Paginated list of cities" })
	@ApiQuery({ name: "page", required: false })
	@ApiQuery({ name: "limit", required: false })
	@ApiQuery({ name: "search", required: false })
	@ApiQuery({ name: "stateId", required: false })
	@ApiQuery({ name: "countryId", required: false })
	@ApiQuery({ name: "countryCode", required: false, description: "Filter by ISO 3166-1 alpha-2 country code", example: "US" })
	@ApiQuery({ name: "stateCode", required: false })
	@ApiQuery({ name: "ids", required: false })
	@ApiQuery({ name: "sort", required: false })
	@ApiQuery({ name: "include", required: false })
	@ApiQuery({ name: "flag", required: false })
	public listCities(@Query(new ZodValidationPipe(apiContract.geo.cities.input)) query: z.output<typeof apiContract.geo.cities.input>): Promise<ListResult> {
		return this.geoService.listCities(query);
	}

	@RequirePermission("READ", "GEO")
	@Get("cities/:id")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "Get city by ID" })
	@ApiOkResponse({ description: "City detail" })
	public getCity(@Param("id", new ZodValidationPipe(GeoIdParamSchema)) param: { readonly id: number }): Promise<City> {
		return this.geoService.getCity(param.id);
	}

	@RequirePermission("CREATE", "GEO")
	@Post("cities")
	@ApiOperation({ summary: "Create a city" })
	@ApiOkResponse({ description: "Created city" })
	public createCity(@Body(new ZodValidationPipe(apiContract.geo.createCity.input)) body: z.output<typeof apiContract.geo.createCity.input>): Promise<City> {
		return this.geoService.createCity(body);
	}

	@RequirePermission("UPDATE", "GEO")
	@Patch("cities/:id")
	@ApiOperation({ summary: "Update a city" })
	@ApiOkResponse({ description: "Updated city" })
	public updateCity(
		@Param("id", new ZodValidationPipe(GeoIdParamSchema)) param: { readonly id: number },
		@Body(new ZodValidationPipe(apiContract.geo.updateCity.input)) body: z.output<typeof apiContract.geo.updateCity.input>,
	): Promise<City> {
		return this.geoService.updateCity(param.id, body);
	}

	@RequirePermission("DELETE", "GEO")
	@Delete("cities/:id")
	@ApiOperation({ summary: "Delete a city" })
	@ApiOkResponse({ description: "City deleted" })
	public deleteCity(@Param("id", new ZodValidationPipe(GeoIdParamSchema)) param: { readonly id: number }): Promise<{ readonly message: string }> {
		return this.geoService.deleteCity(param.id);
	}
}

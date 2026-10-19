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
import { ZodBody, ZodListQuery, ZodQuery, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse, ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";

import { RequirePermission } from "../../../../platform/presentation/http/security/decorators/require-permission.decorator";
import { SuperAdminOnly } from "../../../../platform/presentation/http/security/decorators/super-admin.decorator";
import { Authorize } from "../../../../platform/presentation/http/security/decorators/authorize.decorator";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { GeographyApplicationService } from "../../application/services/geography.application-service";
import { RATE_LIMIT_POLICY, RateLimit } from "../../../../platform/presentation/http/security/throttling/rate-limit.decorator";

/**
 * Geo reference data. Reads need `GEO:READ`; every write (create, update,
 * soft-delete, import) is SuperAdmin-only and runs under the
 * `geo.reference_data.write` system operation (GeographyApplicationService).
 */
@ApiTags("Geo")
@Controller(apiPath("/geo"))
export class GeoController {
	public constructor(private readonly geography: GeographyApplicationService) {}

	// ── Stats ──────────────────────────────────────────────────────────

	@RequirePermission("READ", "GEO")
	@Get("stats")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "Get geo entity counts" })
	@ZodResponse(GeoStatsSchema, { description: "Entity counts for regions, subregions, countries, states, and cities" })
	public getStats(@CurrentActor() actor: ActorContext): ReturnType<GeographyApplicationService["getStats"]> {
		return this.geography.getStats(actor);
	}

	// ── Autocomplete ───────────────────────────────────────────────────

	@RequirePermission("READ", "GEO")
	@Get("autocomplete")
	@Header("Cache-Control", "public, max-age=300")
	@ApiOperation({ summary: "Autocomplete search across all geo entities" })
	@ZodResponse(GeoAutocompleteResponseSchema, { description: "Matching geo items" })
	public autocomplete(
		@CurrentActor() actor: ActorContext,
		@ZodQuery(GeoAutocompleteQuerySchema) query: z.output<typeof GeoAutocompleteQuerySchema>,
	): ReturnType<GeographyApplicationService["autocomplete"]> {
		return this.geography.autocomplete(actor, query);
	}

	// ── Import ──────────────────────────────────────────────────────────

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@SuperAdminOnly()
	@RequirePermission("CREATE", "GEO")
	@Authorize({ action: "CREATE", resource: "GEO", description: "Import geo data" })
	@Post("import")
	@ApiOperation({ summary: "Bulk import geo data" })
	@ZodResponse(GeoImportResultSchema, { status: HttpStatus.CREATED, description: "Import result with created/updated/skipped counts" })
	public importData(
		@CurrentActor() actor: ActorContext,
		@ZodBody(GeoImportInputSchema) body: z.output<typeof GeoImportInputSchema>,
	): ReturnType<GeographyApplicationService["importData"]> {
		return this.geography.importData(actor, body);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@RequirePermission("READ", "GEO")
	@Post("import/validate")
	@ApiOperation({ summary: "Validate geo import data without inserting" })
	@ZodResponse(GeoImportValidationResultSchema, { status: HttpStatus.CREATED, description: "Validation result with row-level errors" })
	public validateImport(
		@CurrentActor() actor: ActorContext,
		@ZodBody(GeoImportValidateInputSchema) body: z.output<typeof GeoImportValidateInputSchema>,
	): ReturnType<GeographyApplicationService["validateImport"]> {
		return this.geography.validateImport(actor, body);
	}

	// ── Export ──────────────────────────────────────────────────────────

	@RequirePermission("READ", "GEO")
	@Get("export")
	@Header("Cache-Control", "public, max-age=360")
	@ApiOperation({ summary: "Export the cities of the matching countries (rows are always JSON; `format=csv` is not rendered server-side)" })
	@ZodResponse(GeoExportResponseSchema, { description: "City rows of every country matching countryCode / regionId" })
	public exportData(
		@CurrentActor() actor: ActorContext,
		@ZodQuery(GeoExportQuerySchema) query: z.output<typeof GeoExportQuerySchema>,
	): ReturnType<GeographyApplicationService["exportData"]> {
		return this.geography.exportData(actor, query);
	}

	// ── Cascade Preview ─────────────────────────────────────────────────

	@RequirePermission("READ", "GEO")
	@Get("cascade-preview")
	@ApiOperation({ summary: "Preview cascade delete impact" })
	@ZodResponse(CascadePreviewResultSchema, { description: "Cascade preview with affected entity counts" })
	public cascadePreview(
		@CurrentActor() actor: ActorContext,
		@ZodQuery(CascadePreviewSchema) query: z.output<typeof CascadePreviewSchema>,
	): ReturnType<GeographyApplicationService["cascadePreview"]> {
		return this.geography.cascadePreview(actor, query);
	}

	// ── Regions ─────────────────────────────────────────────────────────

	@RequirePermission("READ", "GEO")
	@Get("regions")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "List regions" })
	@ZodPaginatedResponse(RegionListItemSchema, { description: "Paginated list of regions" })
	public listRegions(
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(apiContract.geo.regions.input) query: z.output<typeof apiContract.geo.regions.input>,
	): ReturnType<GeographyApplicationService["listRegions"]> {
		return this.geography.listRegions(actor, query);
	}

	@RequirePermission("READ", "GEO")
	@Get("regions/:id")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "Get region by ID" })
	@ZodResponse(RegionSchema, { description: "Region detail" })
	public getRegion(@CurrentActor() actor: ActorContext, @ZodParams(GeoIdParamSchema) param: { readonly id: number }): ReturnType<GeographyApplicationService["getRegion"]> {
		return this.geography.getRegion(actor, param.id);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@SuperAdminOnly()
	@RequirePermission("CREATE", "GEO")
	@Post("regions")
	@ApiOperation({ summary: "Create a region" })
	@ZodResponse(RegionSchema, { status: HttpStatus.CREATED, description: "Created region" })
	public createRegion(
		@CurrentActor() actor: ActorContext,
		@ZodBody(apiContract.geo.createRegion.input) body: z.output<typeof apiContract.geo.createRegion.input>,
	): ReturnType<GeographyApplicationService["createRegion"]> {
		return this.geography.createRegion(actor, body);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@SuperAdminOnly()
	@RequirePermission("UPDATE", "GEO")
	@Patch("regions/:id")
	@ApiOperation({ summary: "Update a region" })
	@ZodResponse(RegionSchema, { description: "Updated region" })
	public updateRegion(
		@CurrentActor() actor: ActorContext,
		@ZodParams(GeoIdParamSchema) param: { readonly id: number },
		@ZodBody(apiContract.geo.updateRegion.input) body: z.output<typeof apiContract.geo.updateRegion.input>,
	): ReturnType<GeographyApplicationService["updateRegion"]> {
		return this.geography.updateRegion(actor, param.id, body);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@SuperAdminOnly()
	@RequirePermission("DELETE", "GEO")
	@Delete("regions/:id")
	@ApiOperation({ summary: "Delete a region" })
	@ZodResponse(MessageResponseSchema, { description: "Region deleted" })
	public deleteRegion(
		@CurrentActor() actor: ActorContext,
		@ZodParams(GeoIdParamSchema) param: { readonly id: number },
	): ReturnType<GeographyApplicationService["deleteRegion"]> {
		return this.geography.deleteRegion(actor, param.id);
	}

	// ── Subregions ──────────────────────────────────────────────────────

	@RequirePermission("READ", "GEO")
	@Get("subregions")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "List subregions" })
	@ZodPaginatedResponse(SubregionListItemSchema, { description: "Paginated list of subregions" })
	public listSubregions(
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(apiContract.geo.subregions.input) query: z.output<typeof apiContract.geo.subregions.input>,
	): ReturnType<GeographyApplicationService["listSubregions"]> {
		return this.geography.listSubregions(actor, query);
	}

	@RequirePermission("READ", "GEO")
	@Get("subregions/:id")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "Get subregion by ID" })
	@ZodResponse(SubregionSchema, { description: "Subregion detail" })
	public getSubregion(
		@CurrentActor() actor: ActorContext,
		@ZodParams(GeoIdParamSchema) param: { readonly id: number },
	): ReturnType<GeographyApplicationService["getSubregion"]> {
		return this.geography.getSubregion(actor, param.id);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@SuperAdminOnly()
	@RequirePermission("CREATE", "GEO")
	@Post("subregions")
	@ApiOperation({ summary: "Create a subregion" })
	@ZodResponse(SubregionSchema, { status: HttpStatus.CREATED, description: "Created subregion" })
	public createSubregion(
		@CurrentActor() actor: ActorContext,
		@ZodBody(apiContract.geo.createSubregion.input) body: z.output<typeof apiContract.geo.createSubregion.input>,
	): ReturnType<GeographyApplicationService["createSubregion"]> {
		return this.geography.createSubregion(actor, body);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@SuperAdminOnly()
	@RequirePermission("UPDATE", "GEO")
	@Patch("subregions/:id")
	@ApiOperation({ summary: "Update a subregion" })
	@ZodResponse(SubregionSchema, { description: "Updated subregion" })
	public updateSubregion(
		@CurrentActor() actor: ActorContext,
		@ZodParams(GeoIdParamSchema) param: { readonly id: number },
		@ZodBody(apiContract.geo.updateSubregion.input) body: z.output<typeof apiContract.geo.updateSubregion.input>,
	): ReturnType<GeographyApplicationService["updateSubregion"]> {
		return this.geography.updateSubregion(actor, param.id, body);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@SuperAdminOnly()
	@RequirePermission("DELETE", "GEO")
	@Delete("subregions/:id")
	@ApiOperation({ summary: "Delete a subregion" })
	@ZodResponse(MessageResponseSchema, { description: "Subregion deleted" })
	public deleteSubregion(
		@CurrentActor() actor: ActorContext,
		@ZodParams(GeoIdParamSchema) param: { readonly id: number },
	): ReturnType<GeographyApplicationService["deleteSubregion"]> {
		return this.geography.deleteSubregion(actor, param.id);
	}

	// ── Countries ───────────────────────────────────────────────────────

	@RequirePermission("READ", "GEO")
	@Get("countries")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "List countries" })
	@ZodPaginatedResponse(CountryListItemSchema, { description: "Paginated list of countries" })
	public listCountries(
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(apiContract.geo.countries.input) query: z.output<typeof apiContract.geo.countries.input>,
	): ReturnType<GeographyApplicationService["listCountries"]> {
		return this.geography.listCountries(actor, query);
	}

	@RequirePermission("READ", "GEO")
	@Get("countries/:id")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "Get country by ID" })
	@ZodResponse(CountrySchema, { description: "Country detail" })
	public getCountry(@CurrentActor() actor: ActorContext, @ZodParams(GeoIdParamSchema) param: { readonly id: number }): ReturnType<GeographyApplicationService["getCountry"]> {
		return this.geography.getCountry(actor, param.id);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@SuperAdminOnly()
	@RequirePermission("CREATE", "GEO")
	@Post("countries")
	@ApiOperation({ summary: "Create a country" })
	@ZodResponse(CountrySchema, { status: HttpStatus.CREATED, description: "Created country" })
	public createCountry(
		@CurrentActor() actor: ActorContext,
		@ZodBody(apiContract.geo.createCountry.input) body: z.output<typeof apiContract.geo.createCountry.input>,
	): ReturnType<GeographyApplicationService["createCountry"]> {
		return this.geography.createCountry(actor, body);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@SuperAdminOnly()
	@RequirePermission("UPDATE", "GEO")
	@Patch("countries/:id")
	@ApiOperation({ summary: "Update a country" })
	@ZodResponse(CountrySchema, { description: "Updated country" })
	public updateCountry(
		@CurrentActor() actor: ActorContext,
		@ZodParams(GeoIdParamSchema) param: { readonly id: number },
		@ZodBody(apiContract.geo.updateCountry.input) body: z.output<typeof apiContract.geo.updateCountry.input>,
	): ReturnType<GeographyApplicationService["updateCountry"]> {
		return this.geography.updateCountry(actor, param.id, body);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@SuperAdminOnly()
	@RequirePermission("DELETE", "GEO")
	@Delete("countries/:id")
	@ApiOperation({ summary: "Delete a country" })
	@ZodResponse(MessageResponseSchema, { description: "Country deleted" })
	public deleteCountry(
		@CurrentActor() actor: ActorContext,
		@ZodParams(GeoIdParamSchema) param: { readonly id: number },
	): ReturnType<GeographyApplicationService["deleteCountry"]> {
		return this.geography.deleteCountry(actor, param.id);
	}

	// ── States ──────────────────────────────────────────────────────────

	@RequirePermission("READ", "GEO")
	@Get("states")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "List states" })
	@ZodPaginatedResponse(StateListItemSchema, { description: "Paginated list of states" })
	public listStates(
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(apiContract.geo.states.input) query: z.output<typeof apiContract.geo.states.input>,
	): ReturnType<GeographyApplicationService["listStates"]> {
		return this.geography.listStates(actor, query);
	}

	@RequirePermission("READ", "GEO")
	@Get("states/:id")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "Get state by ID" })
	@ZodResponse(StateSchema, { description: "State detail" })
	public getState(@CurrentActor() actor: ActorContext, @ZodParams(GeoIdParamSchema) param: { readonly id: number }): ReturnType<GeographyApplicationService["getState"]> {
		return this.geography.getState(actor, param.id);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@SuperAdminOnly()
	@RequirePermission("CREATE", "GEO")
	@Post("states")
	@ApiOperation({ summary: "Create a state" })
	@ZodResponse(StateSchema, { status: HttpStatus.CREATED, description: "Created state" })
	public createState(
		@CurrentActor() actor: ActorContext,
		@ZodBody(apiContract.geo.createState.input) body: z.output<typeof apiContract.geo.createState.input>,
	): ReturnType<GeographyApplicationService["createState"]> {
		return this.geography.createState(actor, body);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@SuperAdminOnly()
	@RequirePermission("UPDATE", "GEO")
	@Patch("states/:id")
	@ApiOperation({ summary: "Update a state" })
	@ZodResponse(StateSchema, { description: "Updated state" })
	public updateState(
		@CurrentActor() actor: ActorContext,
		@ZodParams(GeoIdParamSchema) param: { readonly id: number },
		@ZodBody(apiContract.geo.updateState.input) body: z.output<typeof apiContract.geo.updateState.input>,
	): ReturnType<GeographyApplicationService["updateState"]> {
		return this.geography.updateState(actor, param.id, body);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@SuperAdminOnly()
	@RequirePermission("DELETE", "GEO")
	@Delete("states/:id")
	@ApiOperation({ summary: "Delete a state" })
	@ZodResponse(MessageResponseSchema, { description: "State deleted" })
	public deleteState(
		@CurrentActor() actor: ActorContext,
		@ZodParams(GeoIdParamSchema) param: { readonly id: number },
	): ReturnType<GeographyApplicationService["deleteState"]> {
		return this.geography.deleteState(actor, param.id);
	}

	// ── Cities ──────────────────────────────────────────────────────────

	@RequirePermission("READ", "GEO")
	@Get("cities")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "List cities" })
	@ZodPaginatedResponse(CityListItemSchema, { description: "Paginated list of cities" })
	public listCities(
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(apiContract.geo.cities.input) query: z.output<typeof apiContract.geo.cities.input>,
	): ReturnType<GeographyApplicationService["listCities"]> {
		return this.geography.listCities(actor, query);
	}

	@RequirePermission("READ", "GEO")
	@Get("cities/:id")
	@Header("Cache-Control", "public, max-age=60")
	@ApiOperation({ summary: "Get city by ID" })
	@ZodResponse(CitySchema, { description: "City detail" })
	public getCity(@CurrentActor() actor: ActorContext, @ZodParams(GeoIdParamSchema) param: { readonly id: number }): ReturnType<GeographyApplicationService["getCity"]> {
		return this.geography.getCity(actor, param.id);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@SuperAdminOnly()
	@RequirePermission("CREATE", "GEO")
	@Post("cities")
	@ApiOperation({ summary: "Create a city" })
	@ZodResponse(CitySchema, { status: HttpStatus.CREATED, description: "Created city" })
	public createCity(
		@CurrentActor() actor: ActorContext,
		@ZodBody(apiContract.geo.createCity.input) body: z.output<typeof apiContract.geo.createCity.input>,
	): ReturnType<GeographyApplicationService["createCity"]> {
		return this.geography.createCity(actor, body);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@SuperAdminOnly()
	@RequirePermission("UPDATE", "GEO")
	@Patch("cities/:id")
	@ApiOperation({ summary: "Update a city" })
	@ZodResponse(CitySchema, { description: "Updated city" })
	public updateCity(
		@CurrentActor() actor: ActorContext,
		@ZodParams(GeoIdParamSchema) param: { readonly id: number },
		@ZodBody(apiContract.geo.updateCity.input) body: z.output<typeof apiContract.geo.updateCity.input>,
	): ReturnType<GeographyApplicationService["updateCity"]> {
		return this.geography.updateCity(actor, param.id, body);
	}

	@RateLimit(RATE_LIMIT_POLICY.authenticatedMutation)
	@SuperAdminOnly()
	@RequirePermission("DELETE", "GEO")
	@Delete("cities/:id")
	@ApiOperation({ summary: "Delete a city" })
	@ZodResponse(MessageResponseSchema, { description: "City deleted" })
	public deleteCity(@CurrentActor() actor: ActorContext, @ZodParams(GeoIdParamSchema) param: { readonly id: number }): ReturnType<GeographyApplicationService["deleteCity"]> {
		return this.geography.deleteCity(actor, param.id);
	}
}

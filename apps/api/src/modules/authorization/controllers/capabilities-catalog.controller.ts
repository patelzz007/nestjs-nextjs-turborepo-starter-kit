import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CapabilityCatalogQuerySchema, apiPath, type CapabilityDefinition } from "@workspace/shared";
import { ZodValidationPipe } from "../../../common/pipes/zod-validation.pipe";
import { RlsBypass } from "../../auth/decorators/rls-bypass.decorator";
import { KernelIntegrationHelper } from "../kernel/kernel-integration.helper";

import { CapabilityDefinitionService } from "../services/capability-definition.service";

@ApiTags("Capabilities")
@ApiBearerAuth()
@RlsBypass()
@Controller(apiPath("/capabilities/catalog"))
export class CapabilitiesCatalogController {
	public constructor(
		private readonly capabilityDefinitions: CapabilityDefinitionService,
		private readonly kernelHelper: KernelIntegrationHelper,
	) {}

	@Get()
	@ApiOperation({ summary: "List capability catalog entries (optionally filtered by scope)" })
	@ApiOkResponse({ description: "Capability definitions" })
	public listCatalog(@Query(new ZodValidationPipe(CapabilityCatalogQuerySchema)) query: { scope?: "PLATFORM" | "MERCHANT" | "ADMIN" }): Promise<CapabilityDefinition[]> {
		return this.capabilityDefinitions.listCatalog(query.scope);
	}
}

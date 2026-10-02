import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";

import { CapabilityCatalogQuerySchema, CapabilityCatalogResponseSchema, apiPath, type CapabilityCatalogQuery, type CapabilityCatalogResponse } from "@workspace/shared";
import { ZodQuery } from "../../../common/decorators/zod-request.decorators";
import { ZodResponse } from "../../../common/decorators/zod-response.decorators";
import { RlsBypass } from "../../auth/decorators/rls-bypass.decorator";

import { CapabilityDefinitionService } from "../services/capability-definition.service";

@ApiTags("Capabilities")
@ApiBearerAuth()
@RlsBypass()
@Controller(apiPath("/capabilities/catalog"))
export class CapabilitiesCatalogController {
	public constructor(private readonly capabilityDefinitions: CapabilityDefinitionService) {}

	@Get()
	@ApiOperation({ summary: "List capability catalog entries (optionally filtered by scope)" })
	@ZodResponse(CapabilityCatalogResponseSchema, { description: "Capability definitions" })
	public listCatalog(@ZodQuery(CapabilityCatalogQuerySchema) query: CapabilityCatalogQuery): Promise<CapabilityCatalogResponse> {
		return this.capabilityDefinitions.listCatalog(query.scope);
	}
}

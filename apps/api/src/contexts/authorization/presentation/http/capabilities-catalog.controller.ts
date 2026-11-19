import { Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CapabilityCatalogQuerySchema, CapabilityCatalogResponseSchema, type CapabilityCatalogQuery, type CapabilityCatalogResponse } from "@workspace/shared";

import { ApiController } from "../../../../platform/presentation/http/versioning/api-controller.decorator";
import { PublicOperation } from "../../../../platform/presentation/http/security/decorators/public-operation.decorator";
import { ZodQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { CAPABILITY_CATALOG_READ_OPERATION } from "../../application/ports/authorization.tokens";
import { CapabilityCatalogApplicationService } from "../../application/services/capability-catalog.application-service";

@ApiTags("Capabilities")
@ApiBearerAuth()
@PublicOperation(CAPABILITY_CATALOG_READ_OPERATION)
@ApiController("/capabilities/catalog")
export class CapabilitiesCatalogController {
	public constructor(private readonly catalog: CapabilityCatalogApplicationService) {}

	@Get()
	@ApiOperation({ summary: "List capability catalog entries (optionally filtered by scope)" })
	@ZodResponse(CapabilityCatalogResponseSchema, { description: "Capability definitions" })
	public async listCatalog(@ZodQuery(CapabilityCatalogQuerySchema) query: CapabilityCatalogQuery): Promise<CapabilityCatalogResponse> {
		return this.catalog.getCatalog(query.scope);
	}
}

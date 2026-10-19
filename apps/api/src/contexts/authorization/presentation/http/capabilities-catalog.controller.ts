import { Controller, Get } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CapabilityCatalogQuerySchema, CapabilityCatalogResponseSchema, apiPath, type CapabilityCatalogQuery, type CapabilityCatalogResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { RlsBypass } from "../../../../platform/presentation/http/security/decorators/rls-bypass.decorator";
import { ZodQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { GetCapabilityCatalogQuery } from "../../application/queries/get-capability-catalog/get-capability-catalog.query";

@ApiTags("Capabilities")
@ApiBearerAuth()
@RlsBypass()
@Controller(apiPath("/capabilities/catalog"))
export class CapabilitiesCatalogController {
	public constructor(private readonly queryBus: QueryBus) {}

	@Get()
	@ApiOperation({ summary: "List capability catalog entries (optionally filtered by scope)" })
	@ZodResponse(CapabilityCatalogResponseSchema, { description: "Capability definitions" })
	public async listCatalog(@CurrentActor() actor: ActorContext, @ZodQuery(CapabilityCatalogQuerySchema) query: CapabilityCatalogQuery): Promise<CapabilityCatalogResponse> {
		return this.queryBus.execute(new GetCapabilityCatalogQuery(actor, query.scope));
	}
}

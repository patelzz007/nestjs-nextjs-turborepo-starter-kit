import { Controller, Get, UseInterceptors } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { apiPath, MerchantRedemptionListItemSchema, MerchantRedemptionListQuerySchema, type MerchantRedemptionListItem, type PaginatedServiceResult } from "@workspace/shared";
import type { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { MerchantActor } from "../../../../platform/presentation/http/security/api-keys/merchant-actor";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { AllowApiKeyAuth } from "../../../../platform/presentation/http/security/decorators/allow-api-key-auth.decorator";
import { GetMerchantActor } from "../../../../platform/presentation/http/security/decorators/get-merchant-actor.decorator";
import { SkipAuthThrottle } from "../../../../platform/presentation/http/security/decorators/skip-auth-throttle.decorator";
import { MerchantActorInterceptor } from "../../../../platform/presentation/http/security/interceptors/merchant-actor.interceptor";
import { ZodListQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { ListTenantRedemptionsQuery } from "../../application/queries/list-tenant-redemptions/list-tenant-redemptions.query";

/**
 * An integration API key's own redemption history (D6): the key names no tenant — its tenant and store
 * come from the key itself, so the path carries no `:tenantSlug` (one would be refused with 400). A
 * signed-in member uses `/tenants/:tenantSlug/redemptions`; a user here has no tenant and gets 401.
 */
@ApiTags("Integration")
@ApiSecurity("merchantApiKey")
@AllowApiKeyAuth()
@UseInterceptors(MerchantActorInterceptor)
@Controller(apiPath("/integration/redemptions"))
export class IntegrationRedemptionsController {
	public constructor(private readonly queryBus: QueryBus) {}

	@SkipAuthThrottle()
	@Get()
	@ApiOperation({ summary: "List the API key's own redemptions" })
	@ZodPaginatedResponse(MerchantRedemptionListItemSchema, { description: "Paginated redemption history of the key's tenant (and store, for a store-scoped key)" })
	public listRedemptions(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodListQuery(MerchantRedemptionListQuerySchema) query: z.output<typeof MerchantRedemptionListQuerySchema>,
	): Promise<PaginatedServiceResult<MerchantRedemptionListItem>> {
		return this.queryBus.execute(new ListTenantRedemptionsQuery(actor, { ...query, tenantId: merchant.tenantId }));
	}
}

import { Controller, Get, UseInterceptors } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	MerchantRedemptionListItemSchema,
	MerchantRedemptionListQuerySchema,
	TenantSlugParamSchema,
	type MerchantRedemptionListItem,
	type PaginatedServiceResult,
} from "@workspace/shared";
import type { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { MerchantActor } from "../../../../platform/presentation/http/security/api-keys/merchant-actor";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { GetMerchantActor } from "../../../../platform/presentation/http/security/decorators/get-merchant-actor.decorator";
import { SkipAuthThrottle } from "../../../../platform/presentation/http/security/decorators/skip-auth-throttle.decorator";
import { MerchantActorInterceptor } from "../../../../platform/presentation/http/security/interceptors/merchant-actor.interceptor";
import { ZodListQuery, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { ListTenantRedemptionsQuery } from "../../application/queries/list-tenant-redemptions/list-tenant-redemptions.query";

/**
 * The tenant's redemption history, for signed-in members (`:tenantSlug`). An integration API key uses
 * `/integration/redemptions` instead: a machine credential names no tenant (D6).
 */
@ApiTags("Tenant Redemptions")
@ApiBearerAuth()
@UseInterceptors(MerchantActorInterceptor)
@Controller(apiPath("/tenants/:tenantSlug/redemptions"))
export class TenantRedemptionsController {
	public constructor(private readonly queryBus: QueryBus) {}

	@SkipAuthThrottle()
	@Get()
	@ApiOperation({ summary: "List tenant redemptions" })
	@ZodPaginatedResponse(MerchantRedemptionListItemSchema, { description: "Paginated redemption history" })
	public listRedemptions(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(TenantSlugParamSchema) _params: z.output<typeof TenantSlugParamSchema>,
		@ZodListQuery(MerchantRedemptionListQuerySchema) query: z.output<typeof MerchantRedemptionListQuerySchema>,
	): Promise<PaginatedServiceResult<MerchantRedemptionListItem>> {
		return this.queryBus.execute(new ListTenantRedemptionsQuery(actor, { ...query, tenantId: merchant.tenantId }));
	}
}

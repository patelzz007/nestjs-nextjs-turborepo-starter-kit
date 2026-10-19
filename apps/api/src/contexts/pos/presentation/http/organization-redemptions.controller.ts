import { Controller, Get, UseInterceptors } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	MerchantRedemptionListItemSchema,
	MerchantRedemptionListQuerySchema,
	OrganizationSlugParamSchema,
	type MerchantRedemptionListItem,
	type PaginatedServiceResult,
} from "@workspace/shared";
import type { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { MerchantActor } from "../../../../platform/presentation/http/security/api-keys/merchant-actor";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { AllowApiKeyAuth } from "../../../../platform/presentation/http/security/decorators/allow-api-key-auth.decorator";
import { GetMerchantActor } from "../../../../platform/presentation/http/security/decorators/get-merchant-actor.decorator";
import { SkipAuthThrottle } from "../../../../platform/presentation/http/security/decorators/skip-auth-throttle.decorator";
import { MerchantActorInterceptor } from "../../../../platform/presentation/http/security/interceptors/merchant-actor.interceptor";
import { ZodListQuery, ZodParams } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { ListOrganizationRedemptionsQuery } from "../../application/queries/list-organization-redemptions/list-organization-redemptions.query";

/** The organization's redemption history, for members and integration keys. */
@ApiTags("Organization Redemptions")
@ApiBearerAuth()
@ApiSecurity("merchantApiKey")
@AllowApiKeyAuth()
@UseInterceptors(MerchantActorInterceptor)
@Controller(apiPath("/orgs/:orgSlug/redemptions"))
export class OrganizationRedemptionsController {
	public constructor(private readonly queryBus: QueryBus) {}

	@SkipAuthThrottle()
	@Get()
	@ApiOperation({ summary: "List organization redemptions" })
	@ZodPaginatedResponse(MerchantRedemptionListItemSchema, { description: "Paginated redemption history" })
	public listRedemptions(
		@CurrentActor() actor: ActorContext,
		@GetMerchantActor() merchant: MerchantActor,
		@ZodParams(OrganizationSlugParamSchema) _params: z.output<typeof OrganizationSlugParamSchema>,
		@ZodListQuery(MerchantRedemptionListQuerySchema) query: z.output<typeof MerchantRedemptionListQuerySchema>,
	): Promise<PaginatedServiceResult<MerchantRedemptionListItem>> {
		return this.queryBus.execute(new ListOrganizationRedemptionsQuery(actor, { ...query, organizationId: merchant.organizationId }));
	}
}

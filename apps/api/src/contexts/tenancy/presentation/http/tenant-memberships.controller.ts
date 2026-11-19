import { Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	TenantRewardMembershipResponseSchema,
	OwnMembershipListQuerySchema,
	type TenantRewardMembershipResponse,
	type OwnMembershipListQuery,
	type PaginatedServiceResult,
} from "@workspace/shared";

import { ApiController } from "../../../../platform/presentation/http/versioning/api-controller.decorator";
import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { SkipAuthThrottle } from "../../../../platform/presentation/http/security/decorators/skip-auth-throttle.decorator";
import { ZodListQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { TenantContextApplicationService } from "../../application/services/tenant-context.application-service";

@ApiTags("Tenant memberships")
@ApiBearerAuth()
@ApiController("/tenants/memberships")
export class MembershipsBootstrapController {
	public constructor(private readonly contexts: TenantContextApplicationService) {}

	@SkipAuthThrottle()
	@Get()
	@ApiOperation({ summary: "List the current user's tenant memberships" })
	@ZodPaginatedResponse(TenantRewardMembershipResponseSchema, { description: "One page of the current user's tenant memberships; pagination is in `meta`" })
	public listMemberships(
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(OwnMembershipListQuerySchema) query: OwnMembershipListQuery,
	): Promise<PaginatedServiceResult<TenantRewardMembershipResponse>> {
		return this.contexts.listMyMemberships(actor, query);
	}
}

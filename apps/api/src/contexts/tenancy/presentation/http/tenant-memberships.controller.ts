import { Controller, Get } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	apiPath,
	TenantRewardMembershipResponseSchema,
	OwnMembershipListQuerySchema,
	type TenantRewardMembershipResponse,
	type OwnMembershipListQuery,
	type PaginatedServiceResult,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { CurrentActor } from "../../../../platform/presentation/http/security/current-actor.decorator";
import { SkipAuthThrottle } from "../../../../platform/presentation/http/security/decorators/skip-auth-throttle.decorator";
import { ZodListQuery } from "../../../../platform/presentation/http/validation/decorators/zod-request.decorators";
import { ZodPaginatedResponse } from "../../../../platform/presentation/http/validation/decorators/zod-response.decorators";
import { ListMyMembershipsQuery } from "../../application/queries/list-my-memberships/list-my-memberships.query";

@ApiTags("Tenant memberships")
@ApiBearerAuth()
@Controller(apiPath("/tenants/memberships"))
export class MembershipsBootstrapController {
	public constructor(private readonly queryBus: QueryBus) {}

	@SkipAuthThrottle()
	@Get()
	@ApiOperation({ summary: "List the current user's tenant memberships" })
	@ZodPaginatedResponse(TenantRewardMembershipResponseSchema, { description: "One page of the current user's tenant memberships; pagination is in `meta`" })
	public listMemberships(
		@CurrentActor() actor: ActorContext,
		@ZodListQuery(OwnMembershipListQuerySchema) query: OwnMembershipListQuery,
	): Promise<PaginatedServiceResult<TenantRewardMembershipResponse>> {
		return this.queryBus.execute(new ListMyMembershipsQuery(actor, query));
	}
}

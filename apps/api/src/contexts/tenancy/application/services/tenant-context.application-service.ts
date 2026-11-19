import { Inject, Injectable } from "@nestjs/common";
import type { OwnMembershipListQuery, PaginatedServiceResult, TenantContextResponse, TenantRewardMembershipResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { TenantContextReadPort } from "../ports/tenant-context-read.port";
import { TENANT_CONTEXT_READ } from "../ports/tenants.tokens";
import { requireUserActor } from "../tenant-actor";

/** The signed-in person's view of the tenants they belong to (ADR 096). */
@Injectable()
export class TenantContextApplicationService {
	public constructor(@Inject(TENANT_CONTEXT_READ) private readonly reads: TenantContextReadPort) {}

	/** The tenant the route names, as the caller sees it (their membership, role and stores). */
	public async getContext(actor: ActorContext, input: { readonly tenantSlug: string }): Promise<TenantContextResponse> {
		return this.reads.getContext(requireUserActor(actor), input.tenantSlug);
	}

	/** One page of the caller's own memberships. */
	public async listMyMemberships(actor: ActorContext, query: OwnMembershipListQuery): Promise<PaginatedServiceResult<TenantRewardMembershipResponse>> {
		requireUserActor(actor);
		return this.reads.listMembershipsForUser(actor, query);
	}
}

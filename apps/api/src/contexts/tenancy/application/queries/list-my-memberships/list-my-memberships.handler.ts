import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { TenantRewardMembershipResponse, PaginatedServiceResult } from "@workspace/shared";

import { requireUserActor } from "../../tenant-actor";
import type { TenantContextReadPort } from "../../ports/tenant-context-read.port";
import { TENANT_CONTEXT_READ } from "../../ports/tenants.tokens";
import { ListMyMembershipsQuery } from "./list-my-memberships.query";

@QueryHandler(ListMyMembershipsQuery)
export class ListMyMembershipsHandler implements IQueryHandler<ListMyMembershipsQuery, PaginatedServiceResult<TenantRewardMembershipResponse>> {
	public constructor(@Inject(TENANT_CONTEXT_READ) private readonly reads: TenantContextReadPort) {}

	public async execute(query: ListMyMembershipsQuery): Promise<PaginatedServiceResult<TenantRewardMembershipResponse>> {
		requireUserActor(query.actor);
		return this.reads.listMembershipsForUser(query.actor, query.query);
	}
}

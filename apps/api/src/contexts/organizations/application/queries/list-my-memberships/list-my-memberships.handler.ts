import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { OrganizationRewardMembershipResponse, PaginatedServiceResult } from "@workspace/shared";

import { requireUserActor } from "../../organization-actor";
import type { OrganizationContextReadPort } from "../../ports/organization-context-read.port";
import { ORGANIZATION_CONTEXT_READ } from "../../ports/organizations.tokens";
import { ListMyMembershipsQuery } from "./list-my-memberships.query";

@QueryHandler(ListMyMembershipsQuery)
export class ListMyMembershipsHandler implements IQueryHandler<ListMyMembershipsQuery, PaginatedServiceResult<OrganizationRewardMembershipResponse>> {
	public constructor(@Inject(ORGANIZATION_CONTEXT_READ) private readonly reads: OrganizationContextReadPort) {}

	public async execute(query: ListMyMembershipsQuery): Promise<PaginatedServiceResult<OrganizationRewardMembershipResponse>> {
		requireUserActor(query.actor);
		return this.reads.listMembershipsForUser(query.actor, query.query);
	}
}

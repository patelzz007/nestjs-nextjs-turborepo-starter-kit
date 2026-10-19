import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type OrganizationMemberRosterResponse, type PaginatedServiceResult } from "@workspace/shared";

import { actingInOrganization, requireUserActor } from "../../organization-actor";
import type { MerchantAccessPort } from "../../ports/merchant-access.port";
import type { OrganizationDirectoryPort } from "../../ports/organization-directory.port";
import { MERCHANT_ACCESS, ORGANIZATION_DIRECTORY, TEAM_READ } from "../../ports/organizations.tokens";
import type { TeamReadPort } from "../../ports/team-read.port";
import { ListMembersQuery } from "./list-members.query";

@QueryHandler(ListMembersQuery)
export class ListMembersHandler implements IQueryHandler<ListMembersQuery, PaginatedServiceResult<OrganizationMemberRosterResponse>> {
	public constructor(
		@Inject(ORGANIZATION_DIRECTORY) private readonly directory: OrganizationDirectoryPort,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(TEAM_READ) private readonly team: TeamReadPort,
	) {}

	public async execute(query: ListMembersQuery): Promise<PaginatedServiceResult<OrganizationMemberRosterResponse>> {
		const user = requireUserActor(query.actor);
		const member = await this.directory.resolveMember(user, query.input.orgSlug);
		await this.merchantAccess.assertCapability(user, { organizationId: member.organizationId, capability: MERCHANT_CAPABILITY.manageTeam });
		return this.team.listMembers(actingInOrganization(user, member.organizationId), member.organizationId, query.input.query);
	}
}

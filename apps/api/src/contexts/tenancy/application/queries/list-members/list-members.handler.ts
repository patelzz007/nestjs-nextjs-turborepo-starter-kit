import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type TenantMemberRosterResponse, type PaginatedServiceResult } from "@workspace/shared";

import { actingInTenant, requireUserActor } from "../../tenant-actor";
import type { MerchantAccessPort } from "../../../../../platform/application/ports/authorization.port";
import type { TenantDirectoryPort } from "../../ports/tenant-directory.port";
import { MERCHANT_ACCESS, TENANT_DIRECTORY, TEAM_READ } from "../../ports/tenants.tokens";
import type { TeamReadPort } from "../../ports/team-read.port";
import { ListMembersQuery } from "./list-members.query";

@QueryHandler(ListMembersQuery)
export class ListMembersHandler implements IQueryHandler<ListMembersQuery, PaginatedServiceResult<TenantMemberRosterResponse>> {
	public constructor(
		@Inject(TENANT_DIRECTORY) private readonly directory: TenantDirectoryPort,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(TEAM_READ) private readonly team: TeamReadPort,
	) {}

	public async execute(query: ListMembersQuery): Promise<PaginatedServiceResult<TenantMemberRosterResponse>> {
		const user = requireUserActor(query.actor);
		const member = await this.directory.resolveMember(user, query.input.tenantSlug);
		await this.merchantAccess.assertCapability(user, { tenantId: member.tenantId, capability: MERCHANT_CAPABILITY.manageTeam });
		return this.team.listMembers(actingInTenant(user, member.tenantId), member.tenantId, query.input.query);
	}
}

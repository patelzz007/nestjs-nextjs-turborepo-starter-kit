import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import { MERCHANT_CAPABILITY, type TenantMemberInviteResponse, type PaginatedServiceResult } from "@workspace/shared";

import { actingInTenant, requireUserActor } from "../../tenant-actor";
import type { MerchantAccessPort } from "../../ports/merchant-access.port";
import type { TenantDirectoryPort } from "../../ports/tenant-directory.port";
import { MERCHANT_ACCESS, TENANT_DIRECTORY, TEAM_READ } from "../../ports/tenants.tokens";
import type { TeamReadPort } from "../../ports/team-read.port";
import { ListPendingInvitesQuery } from "./list-pending-invites.query";

@QueryHandler(ListPendingInvitesQuery)
export class ListPendingInvitesHandler implements IQueryHandler<ListPendingInvitesQuery, PaginatedServiceResult<TenantMemberInviteResponse>> {
	public constructor(
		@Inject(TENANT_DIRECTORY) private readonly directory: TenantDirectoryPort,
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(TEAM_READ) private readonly team: TeamReadPort,
	) {}

	public async execute(query: ListPendingInvitesQuery): Promise<PaginatedServiceResult<TenantMemberInviteResponse>> {
		const user = requireUserActor(query.actor);
		const member = await this.directory.resolveMember(user, query.input.tenantSlug);
		await this.merchantAccess.assertCapability(user, { tenantId: member.tenantId, capability: MERCHANT_CAPABILITY.manageTeam });
		return this.team.listPendingInvites(actingInTenant(user, member.tenantId), member.tenantId, query.input.query);
	}
}

import type { TenantContextResponse, TenantRewardMembershipResponse, OwnMembershipListQuery, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { requireUserActor } from "../../application/tenant-actor";
import type { TenantContextReadPort } from "../../application/ports/tenant-context-read.port";
import type { TenantDirectoryPort, ResolvedTenantMember } from "../../application/ports/tenant-directory.port";
import type { TenantContextService } from "./tenant-context.service";
import type { PrismaOwnMembershipsReadRepository } from "../persistence/prisma-own-memberships.read-repository";

/** Route-key resolution and the member-wide tenant reads, over the tenant context service. */
export class TenantDirectoryAdapter implements TenantDirectoryPort, TenantContextReadPort {
	public constructor(
		private readonly context: TenantContextService,
		private readonly ownMemberships: PrismaOwnMembershipsReadRepository,
	) {}

	public async resolveTenantId(routeKey: string): Promise<string> {
		return this.context.resolveTenantIdBySlug(routeKey);
	}

	public async resolveMember(actor: ActorContext, routeKey: string): Promise<ResolvedTenantMember> {
		const resolved = await this.context.resolveBySlug(requireUserActor(actor).userId, routeKey);
		return {
			tenantId: resolved.tenantId,
			slug: resolved.slug,
			displayName: resolved.displayName,
			userId: resolved.userId,
			membership: resolved.membership,
		};
	}

	public async assertAccessibleLocation(actor: ActorContext, routeKey: string, locationId: string): Promise<void> {
		await this.context.assertAccessibleLocation(requireUserActor(actor).userId, routeKey, locationId);
	}

	public async getContext(actor: ActorContext, routeKey: string): Promise<TenantContextResponse> {
		return this.context.getContext(requireUserActor(actor).userId, routeKey);
	}

	public async listMembershipsForUser(actor: ActorContext, query: OwnMembershipListQuery): Promise<PaginatedServiceResult<TenantRewardMembershipResponse>> {
		return this.ownMemberships.list(requireUserActor(actor).userId, query);
	}
}

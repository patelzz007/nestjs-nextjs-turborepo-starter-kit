import type { OrganizationContextResponse, OrganizationRewardMembershipResponse, OwnMembershipListQuery, PaginatedServiceResult } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { requireUserActor } from "../../application/organization-actor";
import type { OrganizationContextReadPort } from "../../application/ports/organization-context-read.port";
import type { OrganizationDirectoryPort, ResolvedOrganizationMember } from "../../application/ports/organization-directory.port";
import type { OrganizationContextService } from "./organization-context.service";
import type { PrismaOwnMembershipsReadRepository } from "../persistence/prisma-own-memberships.read-repository";

/** Route-key resolution and the member-wide organization reads, over the organization context service. */
export class OrganizationDirectoryAdapter implements OrganizationDirectoryPort, OrganizationContextReadPort {
	public constructor(
		private readonly context: OrganizationContextService,
		private readonly ownMemberships: PrismaOwnMembershipsReadRepository,
	) {}

	public async resolveOrganizationId(routeKey: string): Promise<string> {
		return this.context.resolveOrganizationIdBySlug(routeKey);
	}

	public async resolveMember(actor: ActorContext, routeKey: string): Promise<ResolvedOrganizationMember> {
		const resolved = await this.context.resolveBySlug(requireUserActor(actor).userId, routeKey);
		return {
			organizationId: resolved.organizationId,
			slug: resolved.slug,
			displayName: resolved.displayName,
			userId: resolved.userId,
			membership: resolved.membership,
			policyVersion: resolved.policyVersion,
		};
	}

	public async assertAccessibleLocation(actor: ActorContext, routeKey: string, locationId: string): Promise<void> {
		await this.context.assertAccessibleLocation(requireUserActor(actor).userId, routeKey, locationId);
	}

	public async getContext(actor: ActorContext, routeKey: string): Promise<OrganizationContextResponse> {
		return this.context.getContext(requireUserActor(actor).userId, routeKey);
	}

	public async listMembershipsForUser(actor: ActorContext, query: OwnMembershipListQuery): Promise<PaginatedServiceResult<OrganizationRewardMembershipResponse>> {
		return this.ownMemberships.list(requireUserActor(actor).userId, query);
	}
}

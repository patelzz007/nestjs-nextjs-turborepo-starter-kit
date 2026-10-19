import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../../prisma/prisma.service";
import type { MerchantPortalAccess, MerchantPortalAccessPort } from "../../../identity/public-api";

/**
 * Identity's `MerchantPortalAccessPort`, implemented by the owner of memberships and invitations: the
 * merchant organization a signing-in user belongs to (their oldest live membership of a merchant), or
 * whether a team invite is waiting for their address.
 */
@Injectable()
export class MerchantPortalAccessAdapter implements MerchantPortalAccessPort {
	public constructor(private readonly prisma: PrismaService) {}

	public async findAccess(userId: string, email: string, now: number): Promise<MerchantPortalAccess> {
		const membership = await this.prisma.organizationMembership.findFirst({
			where: { userId, isDeleted: false, status: "ACTIVE", organization: { merchantProfile: { isNot: null }, isDeleted: false } },
			select: { organization: { select: { slug: true } } },
			orderBy: { createdAt: "asc" },
		});
		if (membership !== null) {
			return { organizationSlug: membership.organization.slug, hasPendingTeamInvite: false };
		}
		const pendingTeamInvites: number = await this.prisma.organizationInvitation.count({
			where: { email, kind: "TEAM_MEMBER", status: "PENDING", expiresAt: { gt: BigInt(now) } },
		});
		return { organizationSlug: null, hasPendingTeamInvite: pendingTeamInvites > 0 };
	}
}

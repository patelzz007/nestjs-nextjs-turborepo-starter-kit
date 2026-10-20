import { Injectable } from "@nestjs/common";

import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import type { MerchantPortalAccess, MerchantPortalAccessPort } from "../../../identity/public-api";

/** Whether a signing-in account can open the merchant portal. */
const MERCHANT_PORTAL_LOOKUP_OPERATION = "auth.merchant_portal.lookup";

/**
 * Identity's `MerchantPortalAccessPort`, implemented by the owner of memberships and invitations: the
 * merchant tenant a signing-in user belongs to (their oldest live membership of a merchant), or
 * whether a team invite is waiting for their address.
 */
@Injectable()
export class MerchantPortalAccessAdapter implements MerchantPortalAccessPort {
	public constructor(private readonly transactions: TenantTransactionService) {}

	public async findAccess(userId: string, email: string, now: number): Promise<MerchantPortalAccess> {
		return this.transactions.withSystemOperation(
			{ operation: MERCHANT_PORTAL_LOOKUP_OPERATION, reason: "Read merchant-portal access for a sign-in", actorUserId: userId },
			async (tx): Promise<MerchantPortalAccess> => {
				const membership = await tx.membership.findFirst({
					where: { userId, isDeleted: false, status: "ACTIVE", tenant: { merchantProfile: { isNot: null }, isDeleted: false } },
					select: { tenant: { select: { slug: true } } },
					orderBy: { createdAt: "asc" },
				});
				if (membership !== null) {
					return { tenantSlug: membership.tenant.slug, hasPendingTeamInvite: false };
				}
				const pendingTeamInvites: number = await tx.tenantInvitation.count({
					where: { email, kind: "TEAM_MEMBER", status: "PENDING", expiresAt: { gt: BigInt(now) } },
				});
				return { tenantSlug: null, hasPendingTeamInvite: pendingTeamInvites > 0 };
			},
		);
	}
}

import { systemOperationBlocker, systemOperationEraser, type ErasureSystemTransactions } from "../../../../platform/infrastructure/personal-data/erasure-helpers";
import type { ErasureBlocker, PersonalDataEraser } from "../../../../platform/application/personal-data/personal-data-erasure.registry";

/** Tenancy's part of erasure (ADR 077): memberships ended (display names cleared), invitations and join requests removed. */
export function tenancyEraser(transactions: ErasureSystemTransactions): PersonalDataEraser {
	return systemOperationEraser("tenancy", transactions, (tx, { userId, email }) =>
		Promise.all([
			tx.membership.updateMany({ where: { userId }, data: { isDeleted: true, displayName: null } }),
			tx.tenantInvitation.deleteMany({ where: { OR: [{ acceptedByUserId: userId }, { email: { equals: email, mode: "insensitive" } }] } }),
			tx.tenantAccessRequest.deleteMany({ where: { userId } }),
		]),
	);
}

/** Owning a tenant blocks erasure: the business would be left without an owner. */
export function tenantOwnershipBlocker(transactions: ErasureSystemTransactions): ErasureBlocker {
	return systemOperationBlocker("tenant-ownership", transactions, async (tx, userId) => {
		const owned = await tx.membership.count({ where: { userId, role: "OWNER", isDeleted: false } });
		return owned > 0 ? "You own a business on the platform. Transfer its ownership to someone else, or delete the business, first." : null;
	});
}

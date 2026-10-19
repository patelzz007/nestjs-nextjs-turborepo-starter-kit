import type { Prisma } from "@prisma/client";

import type { SignupReferralCodeForValidation } from "../../domain/policies/signup-referral-code-validity.policy";

/** Newest first, tie broken by id: the order every "latest code" read uses (ADR 035, "Boundaries"). */
export const LATEST_CODE_ORDER: Prisma.SignupReferralCodeOrderByWithRelationInput[] = [{ createdAt: "desc" }, { id: "desc" }];

/**
 * The code row matching `canonical` (unique index lookup, never a scan by owner), with its owner's
 * account state and latest code id: everything the validity rule needs, in one read. `db` is the
 * signup transaction when the read must see the state the insert commits against.
 */
export async function findCodeForValidation(db: Prisma.TransactionClient, canonical: string): Promise<SignupReferralCodeForValidation | null> {
	const row = await db.signupReferralCode.findUnique({
		where: { code: canonical },
		select: {
			id: true,
			userId: true,
			expiresAt: true,
			isDeleted: true,
			user: {
				select: {
					isDeleted: true,
					isActive: true,
					signupReferralCodes: { where: { isDeleted: false }, orderBy: LATEST_CODE_ORDER, take: 1, select: { id: true } },
				},
			},
		},
	});
	if (row === null) {
		return null;
	}
	const [latest] = row.user.signupReferralCodes;
	return {
		id: row.id,
		userId: row.userId,
		expiresAt: row.expiresAt,
		isDeleted: row.isDeleted,
		owner: { isDeleted: row.user.isDeleted, isActive: row.user.isActive, latestCodeId: latest?.id ?? null },
	};
}

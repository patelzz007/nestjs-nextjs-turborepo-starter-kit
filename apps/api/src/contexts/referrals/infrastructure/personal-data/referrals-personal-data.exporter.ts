import type { Prisma } from "@prisma/client";

import type { PersonalDataExporter, PersonalDataSectionContent, PersonalDataSubject } from "../../../../platform/application/personal-data/personal-data-export.registry";
import { readAsPerson, rowsToJson, type PersonTransactions } from "../../../../platform/infrastructure/personal-data/read-as-person";

/**
 * The referrals section of "Download my data" (ADR 077): the person's invite codes and the sign-up
 * referrals they took part in. The other person in a referral is someone else's data, so only the
 * person's own role is exported, never the other side's account.
 */
export class ReferralsPersonalDataExporter implements PersonalDataExporter {
	public readonly section = "referrals";
	public readonly description = "Your invite codes, and the sign-ups you referred or were referred by";

	public constructor(private readonly transactions: PersonTransactions) {}

	public export({ actor, userId }: PersonalDataSubject): Promise<PersonalDataSectionContent> {
		return readAsPerson(this.transactions, actor, async (tx: Prisma.TransactionClient): Promise<PersonalDataSectionContent> => {
			const codes = await tx.signupReferralCode.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
			const referrals = await tx.signupReferral.findMany({
				where: { OR: [{ referrerUserId: userId }, { refereeUserId: userId }] },
				select: { id: true, referrerUserId: true, createdAt: true, successfulAt: true, isDeleted: true },
				orderBy: { createdAt: "asc" },
			});
			const mine = referrals.map(({ referrerUserId, ...referral }) => ({ ...referral, yourRole: referrerUserId === userId ? "referrer" : "referred" }));
			return { records: codes.length + referrals.length, data: { inviteCodes: rowsToJson(codes), signupReferrals: rowsToJson(mine) } };
		});
	}
}

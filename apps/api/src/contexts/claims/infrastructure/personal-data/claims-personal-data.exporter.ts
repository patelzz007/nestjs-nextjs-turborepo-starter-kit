import type { Prisma } from "@prisma/client";

import type { PersonalDataExporter, PersonalDataSectionContent, PersonalDataSubject } from "../../../../platform/application/personal-data/personal-data-export.registry";
import { readAsPerson, rowsToJson, type PersonTransactions } from "../../../../platform/infrastructure/personal-data/read-as-person";

/** The claims section of "Download my data" (ADR 077). The QR token and backup code are never exported (hashes only exist). */
export class ClaimsPersonalDataExporter implements PersonalDataExporter {
	public readonly section = "claims";
	public readonly description = "Every reward you claimed, and where and when each was redeemed";

	public constructor(private readonly transactions: PersonTransactions) {}

	public export({ actor, userId }: PersonalDataSubject): Promise<PersonalDataSectionContent> {
		return readAsPerson(this.transactions, actor, async (tx: Prisma.TransactionClient): Promise<PersonalDataSectionContent> => {
			const claims = await tx.rewardClaim.findMany({ where: { userId }, omit: { redemptionTokenHash: true, backupCodeHash: true }, orderBy: { claimedAt: "asc" } });
			const redemptions = await tx.rewardRedemption.findMany({ where: { userId }, orderBy: { redeemedAt: "asc" } });
			return { records: claims.length + redemptions.length, data: { claims: rowsToJson(claims), redemptions: rowsToJson(redemptions) } };
		});
	}
}

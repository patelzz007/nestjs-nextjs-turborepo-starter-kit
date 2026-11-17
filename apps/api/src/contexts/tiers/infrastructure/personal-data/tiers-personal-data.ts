import type { Prisma } from "@prisma/client";

import type { PersonalDataEraser } from "../../../../platform/application/personal-data/personal-data-erasure.registry";
import type { PersonalDataExporter, PersonalDataSectionContent, PersonalDataSubject } from "../../../../platform/application/personal-data/personal-data-export.registry";
import { systemOperationEraser, type ErasureSystemTransactions } from "../../../../platform/infrastructure/personal-data/erasure-helpers";
import { readAsPerson, rowsToJson, type PersonTransactions } from "../../../../platform/infrastructure/personal-data/read-as-person";

/**
 * The tiers section of "Download my data" (ADR 077, ADR 085): the person's tier standing and their tier history, read
 * under their own RLS context (they may read both).
 */
export class TiersPersonalDataExporter implements PersonalDataExporter {
	public readonly section = "tiers";
	public readonly description = "Your customer tier, and every change to it";

	public constructor(private readonly transactions: PersonTransactions) {}

	public export({ actor, userId }: PersonalDataSubject): Promise<PersonalDataSectionContent> {
		return readAsPerson(this.transactions, actor, async (tx: Prisma.TransactionClient): Promise<PersonalDataSectionContent> => {
			const standing = await tx.customerTierStanding.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
			const history = await tx.customerTierChange.findMany({ where: { userId }, orderBy: { occurredAt: "asc" } });
			return { records: standing.length + history.length, data: { standing: rowsToJson(standing), history: rowsToJson(history) } };
		});
	}
}

/**
 * Tiers' part of erasure (ADR 077): the person's standing and tier history go. Their redemptions (and the tier each
 * recorded) stay with the merchants' sales, as every redemption does.
 */
export function tiersEraser(transactions: ErasureSystemTransactions): PersonalDataEraser {
	return systemOperationEraser("tiers", transactions, (tx, { userId }) =>
		Promise.all([tx.customerTierChange.deleteMany({ where: { userId } }), tx.customerTierStanding.deleteMany({ where: { userId } })]),
	);
}

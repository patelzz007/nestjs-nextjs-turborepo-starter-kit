import type { Prisma } from "@prisma/client";

import type { LegalAcceptance } from "../../domain/aggregates/legal-acceptance.aggregate";
import type { LegalAcceptanceRepository } from "../../domain/repositories/legal-acceptance.repository";

/** Legal acceptances on Prisma, bound to one transaction. Append-only. */
export class PrismaLegalAcceptanceRepository implements LegalAcceptanceRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async add(acceptance: LegalAcceptance): Promise<void> {
		const record = acceptance.snapshot();
		await this.db.rewardLegalAcceptance.createMany({
			data: [{ userId: record.userId, termsVersion: record.termsVersion, privacyVersion: record.privacyVersion, acceptedAt: record.acceptedAt }],
		});
	}
}

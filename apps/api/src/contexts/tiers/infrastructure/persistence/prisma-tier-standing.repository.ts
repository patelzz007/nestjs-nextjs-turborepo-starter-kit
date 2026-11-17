import type { Prisma } from "@prisma/client";
import { CustomerTierSchema, epochMs, type EpochMs } from "@workspace/shared";

import { CorruptAggregateStateError } from "../../../../platform/domain/errors/corrupt-aggregate-state.error";
import type { TierStandingRepository } from "../../application/ports/tier-standing.repository";
import { CustomerTierStanding, type DemotionWarning } from "../../domain/aggregates/customer-tier-standing.aggregate";

/** The standing columns the aggregate is rebuilt from. */
export const STANDING_SELECT = {
	id: true,
	userId: true,
	tier: true,
	countedRedemptions: true,
	promotedAt: true,
	holdUntil: true,
	demotionWarningTier: true,
	demotionDueAt: true,
	demotionWarnedAt: true,
	evaluatedAt: true,
} satisfies Prisma.CustomerTierStandingSelect;

type StandingRow = Prisma.CustomerTierStandingGetPayload<{ select: typeof STANDING_SELECT }>;

function epochOrNull(value: bigint | null): EpochMs | null {
	return value === null ? null : epochMs(Number(value));
}

function bigIntOrNull(value: EpochMs | null): bigint | null {
	return value === null ? null : BigInt(value);
}

/** The warning's three columns are written together; a row with only some of them is corrupt. */
function warningOf(row: StandingRow): DemotionWarning | null {
	const { demotionWarningTier, demotionDueAt, demotionWarnedAt } = row;
	if (demotionWarningTier === null && demotionDueAt === null && demotionWarnedAt === null) {
		return null;
	}
	if (demotionWarningTier === null || demotionDueAt === null || demotionWarnedAt === null) {
		throw new CorruptAggregateStateError("customerTierStanding", row.id);
	}
	return { toTier: CustomerTierSchema.parse(demotionWarningTier), dueAt: epochMs(Number(demotionDueAt)), warnedAt: epochMs(Number(demotionWarnedAt)) };
}

function toAggregate(row: StandingRow): CustomerTierStanding {
	return CustomerTierStanding.rehydrate({
		userId: row.userId,
		tier: CustomerTierSchema.parse(row.tier),
		countedRedemptions: row.countedRedemptions,
		promotedAt: epochOrNull(row.promotedAt),
		holdUntil: epochOrNull(row.holdUntil),
		warning: warningOf(row),
		evaluatedAt: epochMs(Number(row.evaluatedAt)),
	});
}

/** {@link TierStandingRepository} on one evaluation's transaction. */
export class PrismaTierStandingRepository implements TierStandingRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	/**
	 * A transaction-scoped advisory lock on the customer, then the standing: two evaluations of one customer queue up
	 * even before their first standing row exists (a row lock needs a row).
	 */
	public async lockForEvaluation(userId: string): Promise<CustomerTierStanding> {
		await this.db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`tiers:standing:${userId}`}, 0))`;
		const row = await this.db.customerTierStanding.findFirst({ where: { userId, isDeleted: false }, select: STANDING_SELECT });
		return row === null ? CustomerTierStanding.fresh(userId) : toAggregate(row);
	}

	public async save(standing: CustomerTierStanding): Promise<void> {
		const state = standing.snapshot();
		const evaluatedAt = state.evaluatedAt;
		if (evaluatedAt === null) {
			return;
		}
		const columns = {
			tier: state.tier,
			countedRedemptions: state.countedRedemptions,
			promotedAt: bigIntOrNull(state.promotedAt),
			holdUntil: bigIntOrNull(state.holdUntil),
			demotionWarningTier: state.warning === null ? null : state.warning.toTier,
			demotionDueAt: state.warning === null ? null : BigInt(state.warning.dueAt),
			demotionWarnedAt: state.warning === null ? null : BigInt(state.warning.warnedAt),
			evaluatedAt: BigInt(evaluatedAt),
		};
		const existing = await this.db.customerTierStanding.findFirst({ where: { userId: state.userId, isDeleted: false }, select: { id: true } });
		if (existing === null) {
			await this.db.customerTierStanding.create({ data: { userId: state.userId, ...columns } });
		} else {
			await this.db.customerTierStanding.update({ where: { id: existing.id }, data: columns });
		}
		const changes = standing.changes();
		if (changes.length > 0) {
			await this.db.customerTierChange.createMany({
				data: changes.map((change) => ({
					userId: state.userId,
					fromTier: change.fromTier,
					toTier: change.toTier,
					reason: change.reason,
					countedRedemptions: change.countedRedemptions,
					occurredAt: BigInt(change.occurredAt),
				})),
			});
		}
	}
}

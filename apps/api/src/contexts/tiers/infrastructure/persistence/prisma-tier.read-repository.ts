import type { Prisma } from "@prisma/client";
import { CustomerTierChangeReasonSchema, CustomerTierSchema, epochMs, type CustomerTier, type CustomerTierChange, type EpochMs } from "@workspace/shared";
import { z } from "zod";

import { actingUserId, type ActorContext } from "../../../../platform/application/actor-context";
import type { SystemDatabaseContext } from "../../../../prisma/tenant-context";
import type { StoredTierDistribution, StoredTierStanding, TierReadPort } from "../../application/ports/tier-reads.port";
import { TIER_STANDING_READ_OPERATION } from "../../application/ports/tiers.tokens";
import type { CountedRedemption } from "../../domain/policies/tier-window.policy";
import { countedRedemptionsSince } from "./counted-redemptions.query";

const CustomerCountRowSchema = z.object({ customers: z.number().int().nonnegative() });

/** What the tier reads run on: a transaction under `tiers.standing.read`. */
export interface TierReadTransactions {
	withSystemOperation<TResult>(context: SystemDatabaseContext, handler: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
}

/**
 * {@link TierReadPort} over Prisma (ADR 085). Every read runs under `tiers.standing.read`: a customer may read their own
 * rows, but a merchant's and platform staff's reads (after their own access checks in the caller) need the bypass, and
 * the counted redemptions join other customers' memberships.
 */
export class PrismaTierReadRepository implements TierReadPort {
	public constructor(private readonly transactions: TierReadTransactions) {}

	public standingOf(actor: ActorContext, userId: string): Promise<StoredTierStanding | null> {
		return this.read(actor, "A customer's tier standing", async (db) => {
			const row = await db.customerTierStanding.findFirst({
				where: { userId, isDeleted: false },
				select: { tier: true, countedRedemptions: true, holdUntil: true, demotionWarningTier: true, demotionDueAt: true, evaluatedAt: true },
			});
			if (row === null) {
				return null;
			}
			return {
				tier: CustomerTierSchema.parse(row.tier),
				countedRedemptions: row.countedRedemptions,
				holdUntil: row.holdUntil === null ? null : epochMs(Number(row.holdUntil)),
				warning:
					row.demotionWarningTier === null || row.demotionDueAt === null
						? null
						: { toTier: CustomerTierSchema.parse(row.demotionWarningTier), dueAt: epochMs(Number(row.demotionDueAt)) },
				evaluatedAt: epochMs(Number(row.evaluatedAt)),
			};
		});
	}

	public historyOf(actor: ActorContext, userId: string, limit: number): Promise<readonly CustomerTierChange[]> {
		return this.read(actor, "A customer's tier history", async (db) => {
			const rows = await db.customerTierChange.findMany({
				where: { userId, isDeleted: false },
				orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
				take: limit,
				select: { id: true, fromTier: true, toTier: true, reason: true, countedRedemptions: true, occurredAt: true },
			});
			return rows.map((row): CustomerTierChange => ({
				id: row.id,
				fromTier: CustomerTierSchema.parse(row.fromTier),
				toTier: CustomerTierSchema.parse(row.toTier),
				reason: CustomerTierChangeReasonSchema.parse(row.reason),
				countedRedemptions: row.countedRedemptions,
				occurredAt: epochMs(Number(row.occurredAt)),
			}));
		});
	}

	public countedSince(actor: ActorContext, userId: string, since: EpochMs): Promise<readonly CountedRedemption[]> {
		return this.read(actor, "A customer's counted redemptions", (db) => countedRedemptionsSince(db, userId, since));
	}

	public tenantNames(actor: ActorContext, tenantIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
		if (tenantIds.length === 0) {
			return Promise.resolve(new Map());
		}
		return this.read(actor, "The names of the merchants a customer redeemed at", async (db) => {
			const rows = await db.tenant.findMany({ where: { id: { in: [...tenantIds] } }, select: { id: true, displayName: true } });
			return new Map(rows.map((row): [string, string] => [row.id, row.displayName]));
		});
	}

	public distribution(actor: ActorContext): Promise<StoredTierDistribution> {
		return this.read(actor, "How many customers stand at each tier", async (db) => {
			const [groups, customers] = await Promise.all([
				db.customerTierStanding.groupBy({ by: ["tier"], where: { isDeleted: false, tier: { not: "BRONZE" } }, _count: { _all: true } }),
				// One number, however many customers: Prisma has no COUNT(DISTINCT …).
				db.$queryRaw`SELECT COUNT(DISTINCT "userId")::int AS customers FROM "TenantCustomer" WHERE "isDeleted" = false`,
			]);
			const [counted] = CustomerCountRowSchema.array().length(1).parse(customers);
			return {
				aboveBronze: new Map(groups.map((group): [CustomerTier, number] => [CustomerTierSchema.parse(group.tier), group._count._all])),
				customers: counted?.customers ?? 0,
			};
		});
	}

	public storedTiersOf(userIds: readonly string[]): Promise<ReadonlyMap<string, CustomerTier>> {
		return this.transactions.withSystemOperation({ operation: TIER_STANDING_READ_OPERATION, reason: "Customers' tiers", actorUserId: null }, async (db) => {
			const rows = await db.customerTierStanding.findMany({ where: { userId: { in: [...userIds] }, isDeleted: false }, select: { userId: true, tier: true } });
			return new Map(rows.map((row): [string, CustomerTier] => [row.userId, CustomerTierSchema.parse(row.tier)]));
		});
	}

	private read<TResult>(actor: ActorContext, reason: string, work: (db: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> {
		return this.transactions.withSystemOperation({ operation: TIER_STANDING_READ_OPERATION, reason: `Tiers: ${reason}`, actorUserId: actingUserId(actor) }, work);
	}
}

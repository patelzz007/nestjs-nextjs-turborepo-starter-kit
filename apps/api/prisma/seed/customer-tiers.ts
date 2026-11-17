// ============================================
// prisma/seed/customer-tiers.ts — customer tiers (ADR 085), derived from the seeded redemptions
// ============================================
// Runs after every redemption is seeded (the demo tenants' own and the year of analytics history). Nothing here is
// invented: each customer's real redemption history is replayed through the tiers context's OWN aggregate, exactly as
// the API would have lived through it — the evaluation just after each redemption, and the nightly review at 03:00 in
// the platform's time zone on every night the customer stood above Bronze (or had a warning). So:
//
// - every redemption records the tier its customer stood at just before it (the till's snapshot);
// - every customer's standing (tier, counted redemptions, tier hold, a pending demotion warning) and tier history
//   (promotions and demotions) are what the rules give for that history — a re-run of the nightly review changes
//   nothing;
// - the platform's tier rules are seeded at their defaults (10 / 25 / 50 in a 12-month window, at most 20 per merchant,
//   a 90-day hold, 14 days' warning), with who set them and why.
//
// A few running campaign rewards are given a minimum tier, so the marketplace shows locked rewards. With a cap of 20
// counted redemptions per merchant, Diamond (50) needs at least three merchants: the merchant network's five loyal
// customers (merchant-network-plan.ts) redeem 11 times at each of five merchants, so they reach it from their own rows.
//
// Re-runnable: the tier tables hold nothing but this seed's rows, so they are cleared and rebuilt.

import {
	CustomerTierSchema,
	DEFAULT_TIER_RULES,
	epochMs,
	MS_PER_DAY,
	MS_PER_HOUR,
	MS_PER_MINUTE,
	PLATFORM_DISPLAY_REGION,
	type CustomerTier,
	type EpochMs,
	type TierRules,
} from "@workspace/shared";
import { z } from "zod";

import { CustomerTierStanding } from "../../src/contexts/tiers/domain/aggregates/customer-tier-standing.aggregate";
import type { CountedRedemption } from "../../src/contexts/tiers/domain/policies/tier-window.policy";
import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";

/** The settings row's key (one row for the platform). */
const SETTINGS_KEY = "default";
const NAMESPACE = "customer-tiers";

/** The nightly review's hour in the platform's time zone (TierReviewCron). */
const REVIEW_HOUR = 3;
/** How long ago staff set the launch rules. */
const RULES_SET_DAYS_AGO = 30;

/** Running campaign rewards (analytics-history.ts keys) given a minimum tier, to show locked rewards. */
const MINIMUM_TIER_REWARDS: readonly { readonly key: string; readonly minimumTier: CustomerTier }[] = [
	{ key: "kl-latte-weekend", minimumTier: "SILVER" },
	{ key: "mlk-heritage-set", minimumTier: "GOLD" },
	{ key: "mlk-beruang-brunch", minimumTier: "DIAMOND" },
];

const RedemptionRowSchema = z.object({ id: z.string(), userId: z.string(), tenantId: z.string(), redeemedAt: z.bigint(), counted: z.boolean() });
type RedemptionRow = z.output<typeof RedemptionRowSchema>;

/** The platform time zone's offset from UTC at `at`, in ms (Malaysia: +8 h, no daylight saving). */
function platformOffsetMs(at: number): number {
	const parts = new Intl.DateTimeFormat("en-US", { timeZone: PLATFORM_DISPLAY_REGION.timeZone, timeZoneName: "longOffset" }).formatToParts(at);
	const zone = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT";
	const match = /GMT(?<sign>[+-])(?<hours>\d{2}):(?<minutes>\d{2})/.exec(zone);
	if (match?.groups === undefined) {
		return 0;
	}
	const { sign, hours, minutes } = match.groups;
	const magnitude = Number(hours) * MS_PER_HOUR + Number(minutes) * MS_PER_MINUTE;
	return sign === "-" ? -magnitude : magnitude;
}

/** The nightly reviews (03:00 platform time) after `from` up to and including `until`, in order. */
function nightsBetween(from: number, until: number): readonly EpochMs[] {
	const offset = platformOffsetMs(from);
	const firstLocalDay = Math.floor((from + offset) / MS_PER_DAY);
	const nights: EpochMs[] = [];
	for (let day = firstLocalDay; ; day += 1) {
		const night = day * MS_PER_DAY + REVIEW_HOUR * MS_PER_HOUR - offset;
		if (night > until) {
			break;
		}
		if (night > from) {
			nights.push(epochMs(night));
		}
	}
	return nights;
}

/** What one customer's replay produced. */
interface Replay {
	readonly standing: CustomerTierStanding;
	readonly snapshots: ReadonlyMap<string, CustomerTier>;
}

/**
 * One customer's history through the aggregate: each redemption records the tier before it and is evaluated just
 * after; each night the customer stands above Bronze (or holds a warning) is reviewed.
 */
function replay(userId: string, rows: readonly RedemptionRow[], rules: TierRules, nowMs: number): Replay {
	const standing = CustomerTierStanding.fresh(userId);
	const counted: CountedRedemption[] = rows.filter((row) => row.counted).map((row) => ({ tenantId: row.tenantId, redeemedAt: epochMs(Number(row.redeemedAt)) }));
	const snapshots = new Map<string, CustomerTier>();
	let clock = Number(rows.at(0)?.redeemedAt ?? BigInt(nowMs)) - 1;
	const reviewNightsUntil = (until: number): void => {
		for (const night of nightsBetween(clock, until)) {
			const { tier, warning } = standing.snapshot();
			if (tier !== "BRONZE" || warning !== null) {
				standing.review(counted, rules, night);
			}
		}
		clock = until;
	};
	for (const row of rows) {
		const at = Number(row.redeemedAt);
		reviewNightsUntil(at);
		snapshots.set(row.id, standing.snapshot().tier);
		standing.afterRedemption(counted, rules, epochMs(at));
	}
	reviewNightsUntil(nowMs);
	standing.pullEvents();
	return { standing, snapshots };
}

export interface CustomerTiersSeedSummary {
	readonly customers: number;
	readonly byTier: Readonly<Record<CustomerTier, number>>;
	readonly changes: number;
	readonly warnings: number;
	readonly lockedRewards: number;
}

export async function seedCustomerTiers(nowMs: number): Promise<CustomerTiersSeedSummary> {
	const superAdmin = await prisma.user.findFirstOrThrow({ where: { email: "superadmin@example.com", isDeleted: false }, select: { id: true } });
	const rules = DEFAULT_TIER_RULES;
	const settingsAt = BigInt(nowMs - RULES_SET_DAYS_AGO * MS_PER_DAY);
	await prisma.customerTierSettings.upsert({
		where: { key: SETTINGS_KEY },
		create: {
			id: deterministicUuid(NAMESPACE, "settings"),
			key: SETTINGS_KEY,
			...rules,
			reason: "Launch rules from ADR 085",
			createdBy: superAdmin.id,
			updatedBy: superAdmin.id,
			createdAt: settingsAt,
			updatedAt: settingsAt,
		},
		update: { ...rules, reason: "Launch rules from ADR 085", updatedBy: superAdmin.id, updatedAt: settingsAt },
	});

	// Every live redemption, and whether it counts: not when the customer was a member of that merchant at that moment.
	const redemptionRows = RedemptionRowSchema.array().parse(
		await prisma.$queryRaw`
			SELECT r.id, r."userId", r."tenantId", r."redeemedAt",
			       NOT EXISTS (
			         SELECT 1 FROM "Membership" m
			         WHERE m."tenantId" = r."tenantId" AND m."userId" = r."userId" AND m."createdAt" <= r."redeemedAt"
			           AND (m."isDeleted" = false OR (m."deletedAt" IS NOT NULL AND m."deletedAt" > r."redeemedAt"))
			       ) AS counted
			FROM "RewardRedemption" r
			WHERE r."isDeleted" = false
			ORDER BY r."userId", r."redeemedAt", r.id`,
	);
	const byCustomer = new Map<string, RedemptionRow[]>();
	for (const row of redemptionRows) {
		byCustomer.set(row.userId, [...(byCustomer.get(row.userId) ?? []), row]);
	}

	await prisma.customerTierChange.deleteMany({});
	await prisma.customerTierStanding.deleteMany({});

	const byTier: Record<CustomerTier, number> = { BRONZE: 0, SILVER: 0, GOLD: 0, DIAMOND: 0 };
	const snapshotIdsByTier = new Map<CustomerTier, string[]>();
	let changes = 0;
	let warnings = 0;
	for (const [userId, rows] of byCustomer) {
		const { standing, snapshots } = replay(userId, rows, rules, nowMs);
		for (const [redemptionId, tier] of snapshots) {
			snapshotIdsByTier.set(tier, [...(snapshotIdsByTier.get(tier) ?? []), redemptionId]);
		}
		const state = standing.snapshot();
		byTier[state.tier] += 1;
		warnings += state.warning === null ? 0 : 1;
		await prisma.customerTierStanding.create({
			data: {
				id: deterministicUuid(NAMESPACE, `standing:${userId}`),
				userId,
				tier: state.tier,
				countedRedemptions: state.countedRedemptions,
				promotedAt: state.promotedAt === null ? null : BigInt(state.promotedAt),
				holdUntil: state.holdUntil === null ? null : BigInt(state.holdUntil),
				demotionWarningTier: state.warning?.toTier ?? null,
				demotionDueAt: state.warning === null ? null : BigInt(state.warning.dueAt),
				demotionWarnedAt: state.warning === null ? null : BigInt(state.warning.warnedAt),
				evaluatedAt: BigInt(state.evaluatedAt ?? nowMs),
				createdBy: superAdmin.id,
				updatedBy: superAdmin.id,
			},
		});
		const history = standing.changes();
		changes += history.length;
		if (history.length > 0) {
			await prisma.customerTierChange.createMany({
				data: history.map((change, position) => ({
					id: deterministicUuid(NAMESPACE, `change:${userId}:${String(position)}`),
					userId,
					fromTier: change.fromTier,
					toTier: change.toTier,
					reason: change.reason,
					countedRedemptions: change.countedRedemptions,
					occurredAt: BigInt(change.occurredAt),
					createdAt: BigInt(change.occurredAt),
					updatedAt: BigInt(change.occurredAt),
					createdBy: superAdmin.id,
					updatedBy: superAdmin.id,
				})),
			});
		}
	}

	// Each redemption's snapshot: one statement per tier.
	for (const tier of CustomerTierSchema.options) {
		const ids = snapshotIdsByTier.get(tier) ?? [];
		if (ids.length > 0) {
			await prisma.rewardRedemption.updateMany({ where: { id: { in: ids } }, data: { customerTier: tier } });
		}
	}

	for (const { key, minimumTier } of MINIMUM_TIER_REWARDS) {
		await prisma.reward.updateMany({
			where: { id: deterministicUuid("reward-seed-history-reward", key), referralsEnabled: false, audienceType: "EVERYONE" },
			data: { minimumTier },
		});
	}

	return { customers: byCustomer.size, byTier, changes, warnings, lockedRewards: MINIMUM_TIER_REWARDS.length };
}

import {
	CustomerTierSchema,
	ENTRY_CUSTOMER_TIER,
	epochMs,
	nextCustomerTier,
	PLATFORM_DISPLAY_REGION,
	tierThreshold,
	type AdminUserTier,
	type CustomerTier,
	type EpochMs,
	type MyTier,
	type TierAvailability,
	type TierDemotionWarning,
	type TierDistribution,
	type TierDropOff,
	type TierRules,
} from "@workspace/shared";

import { actingUserId, type ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import { TiersDisabledError } from "../../domain/errors/tier.errors";
import { countedAt, dropOffsAfter, merchantCountsAt, windowMs, type CountedRedemption, type DropOff } from "../../domain/policies/tier-window.policy";
import type { StoredTierStanding, TierReadPort } from "../ports/tier-reads.port";
import type { TierSettingsStore } from "../ports/tier-settings.store";
import type { TiersAvailabilityPort } from "../ports/tiers-availability.port";

/** How many tier changes a tier page shows. */
export const TIER_HISTORY_LIMIT = 20;
/** How many coming days with redemptions leaving the window a tier page shows. */
export const TIER_DROP_OFF_DAYS = 5;

/** A locale whose numeric date format is `YYYY-MM-DD`: only used to key days, never shown. */
const DAY_KEY_LOCALE = "en-CA";

/** The calendar day of `at` in the platform's region (the stores' wall-clock date). */
function platformDayOf(at: EpochMs): string {
	return new Intl.DateTimeFormat(DAY_KEY_LOCALE, { timeZone: PLATFORM_DISPLAY_REGION.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** Drop-offs folded into one per platform day (the day's first moment), the first `days` days. */
export function dropOffsByDay(dropOffs: readonly DropOff[], days: number): readonly TierDropOff[] {
	const byDay: TierDropOff[] = [];
	let lastDay: string | null = null;
	for (const dropOff of dropOffs) {
		const day = platformDayOf(dropOff.at);
		const last = byDay.at(-1);
		if (day === lastDay && last !== undefined) {
			byDay.splice(-1, 1, { on: last.on, count: last.count + dropOff.count });
			continue;
		}
		if (byDay.length === days) {
			break;
		}
		byDay.push({ on: dropOff.at, count: dropOff.count });
		lastDay = day;
	}
	return byDay;
}

/** The warning as the customer sees it: where they fall, when, and how many more counted redemptions keep the tier. */
function warningOf(standing: StoredTierStanding, redemptions: readonly CountedRedemption[], rules: TierRules): TierDemotionWarning | null {
	if (standing.warning === null) {
		return null;
	}
	const { toTier, dueAt } = standing.warning;
	return { toTier, dueAt, redemptionsToKeep: Math.max(0, tierThreshold(rules, standing.tier) - countedAt(redemptions, dueAt, rules)) };
}

/** The hold's end while it is still ahead; null once it has passed. */
function activeHold(standing: StoredTierStanding | null, now: EpochMs): EpochMs | null {
	return standing !== null && standing.holdUntil !== null && standing.holdUntil > now ? standing.holdUntil : null;
}

/**
 * The tiers context's reads (ADR 085): the customer's own tier page, a customer's tier on their admin page, how many
 * customers stand at each tier, and whether tiers are on. Every tier page is refused while tiers are off.
 */
export class TierReadService {
	public constructor(
		private readonly reads: TierReadPort,
		private readonly settings: TierSettingsStore,
		private readonly availabilityPort: TiersAvailabilityPort,
		private readonly clock: Clock,
	) {}

	/** Whether tiers are on and, while they are, the caller's tier (Bronze signed out or never evaluated). */
	public async availability(actor: ActorContext): Promise<TierAvailability> {
		if (!(await this.availabilityPort.isOn())) {
			return { enabled: false };
		}
		const userId = actingUserId(actor);
		if (userId === null) {
			return { enabled: true, viewerTier: ENTRY_CUSTOMER_TIER };
		}
		const stored = await this.reads.storedTiersOf([userId]);
		return { enabled: true, viewerTier: stored.get(userId) ?? ENTRY_CUSTOMER_TIER };
	}

	/** The signed-in customer's tier page. */
	public async myTier(actor: ActorContext): Promise<MyTier> {
		const userId = actingUserId(actor);
		if (userId === null) {
			throw new TiersDisabledError();
		}
		await this.assertOn();
		const now = this.clock.now();
		const rules = await this.settings.rules();
		const [standing, redemptions, history] = await Promise.all([
			this.reads.standingOf(actor, userId),
			this.reads.countedSince(actor, userId, epochMs(Math.max(0, now - windowMs(rules)))),
			this.reads.historyOf(actor, userId, TIER_HISTORY_LIMIT),
		]);
		const tier = standing?.tier ?? ENTRY_CUSTOMER_TIER;
		const counted = countedAt(redemptions, now, rules);
		const merchantCounts = merchantCountsAt(redemptions, now, rules);
		const names = await this.reads.tenantNames(
			actor,
			merchantCounts.map((merchant) => merchant.tenantId),
		);
		const nextTier = nextCustomerTier(tier);
		return {
			tier,
			countedRedemptions: counted,
			nextTier,
			redemptionsToNextTier: nextTier === null ? null : Math.max(0, tierThreshold(rules, nextTier) - counted),
			holdUntil: activeHold(standing, now),
			demotionWarning: standing === null ? null : warningOf(standing, redemptions, rules),
			merchants: merchantCounts.map((merchant) => ({ ...merchant, tenantName: names.get(merchant.tenantId) ?? "" })),
			upcomingDropOffs: [...dropOffsByDay(dropOffsAfter(redemptions, now, rules), TIER_DROP_OFF_DAYS)],
			history: [...history],
			rules,
		};
	}

	/** A customer's tier and history on their admin page (read-only). */
	public async userTier(actor: ActorContext, userId: string): Promise<AdminUserTier> {
		await this.assertOn();
		const now = this.clock.now();
		const rules = await this.settings.rules();
		const [standing, redemptions, history] = await Promise.all([
			this.reads.standingOf(actor, userId),
			this.reads.countedSince(actor, userId, epochMs(Math.max(0, now - windowMs(rules)))),
			this.reads.historyOf(actor, userId, TIER_HISTORY_LIMIT),
		]);
		return {
			tier: standing?.tier ?? ENTRY_CUSTOMER_TIER,
			countedRedemptions: countedAt(redemptions, now, rules),
			holdUntil: activeHold(standing, now),
			demotionWarning: standing === null ? null : warningOf(standing, redemptions, rules),
			evaluatedAt: standing?.evaluatedAt ?? null,
			history: [...history],
		};
	}

	/** How many customers stand at each tier; every customer without a higher standing is Bronze. */
	public async distribution(actor: ActorContext): Promise<TierDistribution> {
		await this.assertOn();
		const stored = await this.reads.distribution(actor);
		const aboveBronze = CustomerTierSchema.options.filter((tier: CustomerTier): boolean => tier !== ENTRY_CUSTOMER_TIER);
		const higher = aboveBronze.reduce((sum: number, tier: CustomerTier): number => sum + (stored.aboveBronze.get(tier) ?? 0), 0);
		const total = Math.max(stored.customers, higher);
		return {
			counts: {
				BRONZE: total - higher,
				SILVER: stored.aboveBronze.get("SILVER") ?? 0,
				GOLD: stored.aboveBronze.get("GOLD") ?? 0,
				DIAMOND: stored.aboveBronze.get("DIAMOND") ?? 0,
			},
			total,
		};
	}

	private async assertOn(): Promise<void> {
		if (!(await this.availabilityPort.isOn())) {
			throw new TiersDisabledError();
		}
	}
}

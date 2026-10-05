// ============================================
// prisma/seed/analytics-history.ts — a year of POS activity for the analytics dashboards and exports
// ============================================
// The demo tenants' own rows (seeded by rewards.ts) cover the last few days.
// The analytics screens chart up to 366 days by store, reward, redemption
// method, category, city and new vs returning customers, so this adds ~12
// months of history through the SAME invariants the API enforces at checkout:
//
// - every bill (`reward_sales`) redeems one claim (`reward_redemptions`, same
//   store / terminal / store-scoped POS key, `redeemed_at = paid_at`) and has
//   its `merchant.checkout` audit row;
// - a claim is redeemed inside its claim window, at a store its reward is
//   offered at, while the reward runs, for a bill that meets its minimum spend;
// - unredeemed claims are EXPIRED (their window is over);
// - each history reward's counters match its rows (claimCount, redemptionCount,
//   quantityRemaining = quantityTotal − redeemed, nothing reserved).
//
// The plan is a pure function of (PRNG stream, now, customers) — deterministic
// for a `--seed`; ids are derived from stable keys so a re-run converges (the
// rows are deleted with the demo tenants' other reward rows and re-created;
// audit rows are never deleted and are inserted with skipDuplicates).

import { DAY_MS, DEFAULT_SALE_CURRENCY } from "@workspace/shared";
import type { Prisma, RewardClaimStatus, RewardRedemptionMethod, RewardStatus, RewardType } from "@prisma/client";

import { sha256Hex } from "../../src/common/crypto/sha256";
import { API_KEY_PREFIX_LENGTH } from "../../src/modules/rewards/services/merchant-api-key.service";
import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { ORGANIZATION_SEED_IDS } from "./organization-seed-ids";
import type { SeededRandom } from "./prng";
import { seedCodeHash } from "./reward-code-hashing";

/** Days of history before today (today itself is left to the live demo rows). */
export const ANALYTICS_HISTORY_DAYS = 365;

/** How long a claim stays redeemable (the app's default claim window). */
const CLAIM_WINDOW_MS = 7 * DAY_MS;

/** Kuala Lumpur and Melaka are UTC+8 all year: local wall clock = UTC + 8 h. */
const STORE_UTC_OFFSET_MS = 8 * 3_600_000;

/** Stores open 08:00–21:00 local; bills and claims fall inside. */
const OPENING_HOUR = 8;
const CLOSING_HOUR = 21;
const MINUTE_MS = 60_000;
const MINUTES_PER_HOUR = 60;

/** Days before the bill a customer claimed the reward (0 = same day). */
const MAX_CLAIM_LEAD_DAYS = 5;

/** Share of claims that are never redeemed (they expire). */
const EXPIRED_CLAIM_SHARE = 0.22;

/** Share of redemptions entered with the backup code instead of a QR scan. */
const MANUAL_REDEMPTION_SHARE = 0.3;

/** Saturday / Sunday traffic multiplier. */
const WEEKEND_BOOST = 1.45;
/** December (holiday season) traffic multiplier. */
const DECEMBER_BOOST = 1.3;
/** Traffic a year ago relative to today: the business grows linearly from this share to 100 %. */
const GROWTH_START_SHARE = 0.45;
/** `Date#getUTCDay()` of Saturday and Sunday; `getUTCMonth()` of December. */
const SATURDAY = 6;
const SUNDAY = 0;
const DECEMBER = 11;

/** Stock left on a history reward after its redemptions (still claimable when it runs). */
const REMAINING_STOCK = 40;

/** Seed-only plaintext of the Bukit Beruang POS key (only its hash is stored; nothing documents it as a credential). */
const BERUANG_POS_KEY_PLAINTEXT = "mk_live_seedMlkBukitBeruangPosHistoryKey3Hq8Vt2Xc6Lm1Np5Rs9Wz4Yb7Dg2Jk";

/** A store the history sells at. */
export interface HistoryStore {
	readonly key: string;
	readonly organizationId: string;
	readonly locationId: string;
	readonly terminalId: string;
	readonly apiKeyId: string;
	/** Mean bills per weekday at the END of the year (growth and seasonality scale it). */
	readonly billsPerDay: number;
	/** Bill total range in sen. */
	readonly minBillMinor: number;
	readonly maxBillMinor: number;
}

/** A campaign reward the history redeems. Its window is relative to "now". */
export interface HistoryReward {
	readonly key: string;
	readonly organizationId: string;
	readonly title: string;
	readonly description: string;
	readonly rewardType: RewardType;
	readonly rewardValue: number;
	readonly category: string;
	/** `null` = offered at every store of the organization. */
	readonly locationIds: readonly string[] | null;
	readonly minSpendMinor: number;
	readonly startDaysAgo: number;
	/** Negative = still running (expires that many days from now). */
	readonly endDaysAgo: number;
}

/** The demo tenants' stores and their POS keys (see rewards.ts for the KL and Bukit Katil keys). */
export const HISTORY_STORES: readonly HistoryStore[] = [
	{
		key: "kl",
		organizationId: ORGANIZATION_SEED_IDS.klOrganization,
		locationId: ORGANIZATION_SEED_IDS.klLocation,
		terminalId: "KL-REGISTER-01",
		apiKeyId: deterministicUuid("reward-seed-api-key", "kl-pos-simulator"),
		billsPerDay: 3,
		minBillMinor: 900,
		maxBillMinor: 4_800,
	},
	{
		key: "mlk-katil",
		organizationId: ORGANIZATION_SEED_IDS.mlkOrganization,
		locationId: ORGANIZATION_SEED_IDS.mlkLocationKatil,
		terminalId: "MLK-KATIL-01",
		apiKeyId: deterministicUuid("reward-seed-api-key", "mlk-katil-pos"),
		billsPerDay: 2.2,
		minBillMinor: 3_600,
		maxBillMinor: 14_500,
	},
	{
		key: "mlk-beruang",
		organizationId: ORGANIZATION_SEED_IDS.mlkOrganization,
		locationId: ORGANIZATION_SEED_IDS.mlkLocationBeruang,
		terminalId: "MLK-BERUANG-01",
		apiKeyId: deterministicUuid("reward-seed-api-key", "mlk-beruang-pos"),
		billsPerDay: 1.5,
		minBillMinor: 3_600,
		maxBillMinor: 11_800,
	},
];

export const HISTORY_REWARDS: readonly HistoryReward[] = [
	{
		key: "kl-morning-brew",
		organizationId: ORGANIZATION_SEED_IDS.klOrganization,
		title: "Morning brew club — free refill",
		description: "A free refill with any hot drink before 11am.",
		rewardType: "FREE_ITEM",
		rewardValue: 1,
		category: "cafe",
		locationIds: null,
		minSpendMinor: 0,
		startDaysAgo: 380,
		endDaysAgo: -60,
	},
	{
		key: "kl-pastry-autumn",
		organizationId: ORGANIZATION_SEED_IDS.klOrganization,
		// Mandarin (Simplified Chinese): exercises the CJK font in dashboards and PDF exports.
		title: "糕点配咖啡 — 八折优惠",
		description: "点咖啡时任何糕点享八折。",
		rewardType: "DISCOUNT",
		rewardValue: 20,
		category: "food",
		locationIds: null,
		minSpendMinor: 1_200,
		startDaysAgo: 365,
		endDaysAgo: 150,
	},
	{
		key: "kl-latte-weekend",
		organizationId: ORGANIZATION_SEED_IDS.klOrganization,
		// Malay.
		title: "Istimewa latte seni hujung minggu",
		description: "Potongan RM3 untuk latte istimewa pada hujung minggu.",
		rewardType: "CASHBACK",
		rewardValue: 3,
		category: "beverage",
		locationIds: null,
		minSpendMinor: 1_500,
		startDaysAgo: 170,
		endDaysAgo: -30,
	},
	{
		key: "mlk-heritage-set",
		organizationId: ORGANIZATION_SEED_IDS.mlkOrganization,
		title: "Jonker heritage set — RM12 off",
		description: "RM12 off the heritage lunch set at both stores.",
		rewardType: "DISCOUNT",
		rewardValue: 12,
		category: "restaurant",
		locationIds: [ORGANIZATION_SEED_IDS.mlkLocationKatil, ORGANIZATION_SEED_IDS.mlkLocationBeruang],
		minSpendMinor: 3_500,
		startDaysAgo: 375,
		endDaysAgo: -45,
	},
	{
		key: "mlk-katil-family",
		organizationId: ORGANIZATION_SEED_IDS.mlkOrganization,
		// Tamil: exercises Tamil shaping (two-part vowels, pulli) in dashboards and PDF exports.
		title: "குடும்ப இரவு உணவுடன் இலவச இனிப்பு",
		description: "புக்கிட் கட்டில் கிளையில் குடும்ப இரவு உணவுடன் இலவச இனிப்புத் தட்டு.",
		rewardType: "FREE_ITEM",
		rewardValue: 1,
		category: "restaurant",
		locationIds: [ORGANIZATION_SEED_IDS.mlkLocationKatil],
		minSpendMinor: 6_000,
		startDaysAgo: 300,
		endDaysAgo: 35,
	},
	{
		key: "mlk-beruang-brunch",
		organizationId: ORGANIZATION_SEED_IDS.mlkOrganization,
		// Hindi: exercises Devanagari shaping (conjuncts, reordered i-sign) in dashboards and PDF exports.
		title: "सप्ताहांत ब्रंच के साथ मुफ़्त पेय",
		description: "बुकित बेरुआंग में सप्ताहांत ब्रंच के साथ एक मुफ़्त ठंडा पेय।",
		rewardType: "FREE_ITEM",
		rewardValue: 1,
		category: "beverage",
		locationIds: [ORGANIZATION_SEED_IDS.mlkLocationBeruang],
		minSpendMinor: 3_500,
		startDaysAgo: 240,
		endDaysAgo: -20,
	},
];

/** One planned claim (and, when redeemed, its bill). Times are epoch ms. */
export interface PlannedClaim {
	readonly key: string;
	readonly rewardKey: string;
	readonly userId: string;
	readonly status: Extract<RewardClaimStatus, "REDEEMED" | "EXPIRED">;
	readonly claimedAt: number;
	readonly claimExpiresAt: number;
	readonly checkout: PlannedCheckout | null;
}

export interface PlannedCheckout {
	readonly storeKey: string;
	readonly paidAt: number;
	readonly billTotalMinor: number;
	readonly redemptionMethod: RewardRedemptionMethod;
}

export interface AnalyticsHistoryPlan {
	readonly claims: readonly PlannedClaim[];
}

export interface AnalyticsHistoryPlanInput {
	readonly random: SeededRandom;
	readonly nowMs: number;
	/** Consumer user ids; each "joins" on a different day, so new and returning customers both show. */
	readonly customerIds: readonly string[];
}

/** When a history reward runs, in epoch ms. */
export function rewardWindow(reward: HistoryReward, nowMs: number): { readonly startMs: number; readonly endMs: number } {
	return { startMs: nowMs - reward.startDaysAgo * DAY_MS, endMs: nowMs - reward.endDaysAgo * DAY_MS };
}

function offeredAt(reward: HistoryReward, store: HistoryStore): boolean {
	return reward.organizationId === store.organizationId && (reward.locationIds === null || reward.locationIds.includes(store.locationId));
}

/** Local midnight (UTC+8) of the day `daysAgo` days before `nowMs`, as epoch ms. */
function localMidnight(nowMs: number, daysAgo: number): number {
	const local = nowMs + STORE_UTC_OFFSET_MS - daysAgo * DAY_MS;
	return local - (local % DAY_MS) - STORE_UTC_OFFSET_MS;
}

/** A random instant inside opening hours of the local day starting at `midnightMs`. */
function duringOpeningHours(random: SeededRandom, midnightMs: number): number {
	return midnightMs + random.int(OPENING_HOUR * MINUTES_PER_HOUR, CLOSING_HOUR * MINUTES_PER_HOUR - 1) * MINUTE_MS;
}

/** Expected bills of `store` on the day `daysAgo` days back: growth over the year, weekends and December busier. */
function expectedBills(store: HistoryStore, midnightMs: number, daysAgo: number): number {
	const localDay = new Date(midnightMs + STORE_UTC_OFFSET_MS);
	const weekday = localDay.getUTCDay();
	const growth = GROWTH_START_SHARE + (1 - GROWTH_START_SHARE) * (1 - daysAgo / ANALYTICS_HISTORY_DAYS);
	const weekend = weekday === SATURDAY || weekday === SUNDAY ? WEEKEND_BOOST : 1;
	const season = localDay.getUTCMonth() === DECEMBER ? DECEMBER_BOOST : 1;
	return store.billsPerDay * growth * weekend * season;
}

/** A whole number of bills with mean `expected` (the integer part, plus one more with the fractional probability). */
function billCount(random: SeededRandom, expected: number): number {
	const whole = Math.floor(expected);
	return whole + (random.chance(expected - whole) ? 1 : 0);
}

/**
 * The history, as data: for every day and store, its bills (each redeeming one
 * claim of a reward running there), plus the claims that expired unredeemed.
 * Customers join one after another across the year and keep coming back.
 */
export function buildAnalyticsHistoryPlan(input: AnalyticsHistoryPlanInput): AnalyticsHistoryPlan {
	const { random, nowMs, customerIds } = input;
	const joinDayAgo = new Map(
		customerIds.map((userId, index) => [userId, Math.round(ANALYTICS_HISTORY_DAYS - (index * ANALYTICS_HISTORY_DAYS) / Math.max(1, customerIds.length))]),
	);
	const claims: PlannedClaim[] = [];

	for (let daysAgo = ANALYTICS_HISTORY_DAYS; daysAgo >= 1; daysAgo -= 1) {
		const midnight = localMidnight(nowMs, daysAgo);
		const customers = customerIds.filter((userId) => (joinDayAgo.get(userId) ?? 0) >= daysAgo);
		if (customers.length === 0) {
			continue;
		}
		for (const store of HISTORY_STORES) {
			const bills = billCount(random, expectedBills(store, midnight, daysAgo));
			for (let index = 0; index < bills; index += 1) {
				const paidAt = duringOpeningHours(random, midnight);
				// Claimed up to a few days before the bill, always inside the claim window and before paying.
				const leadClaimAt = Math.max(duringOpeningHours(random, midnight - random.int(0, MAX_CLAIM_LEAD_DAYS) * DAY_MS), paidAt - CLAIM_WINDOW_MS + MINUTE_MS);
				const firstClaimAt = Math.min(leadClaimAt, paidAt - MINUTE_MS);
				const running = HISTORY_REWARDS.filter((reward) => {
					const window = rewardWindow(reward, nowMs);
					return offeredAt(reward, store) && window.startMs <= firstClaimAt && window.endMs >= paidAt;
				});
				if (running.length === 0) {
					continue;
				}
				const reward = random.pick(running);
				const key = `${store.key}:${String(daysAgo)}:${String(index)}`;
				const minBill = Math.max(store.minBillMinor, reward.minSpendMinor);
				claims.push({
					key,
					rewardKey: reward.key,
					userId: random.pick(customers),
					status: "REDEEMED",
					claimedAt: firstClaimAt,
					claimExpiresAt: Math.min(firstClaimAt + CLAIM_WINDOW_MS, rewardWindow(reward, nowMs).endMs),
					checkout: {
						storeKey: store.key,
						paidAt,
						billTotalMinor: random.int(minBill, Math.max(minBill, store.maxBillMinor)),
						redemptionMethod: random.chance(MANUAL_REDEMPTION_SHARE) ? "MANUAL" : "SCAN",
					},
				});
				// Some claims of the same campaign are never redeemed: their window passed before today.
				if (random.chance(EXPIRED_CLAIM_SHARE) && daysAgo * DAY_MS > CLAIM_WINDOW_MS) {
					const expiredAt = duringOpeningHours(random, midnight);
					if (expiredAt >= rewardWindow(reward, nowMs).startMs) {
						claims.push({
							key: `${key}:expired`,
							rewardKey: reward.key,
							userId: random.pick(customers),
							status: "EXPIRED",
							claimedAt: expiredAt,
							claimExpiresAt: Math.min(expiredAt + CLAIM_WINDOW_MS, rewardWindow(reward, nowMs).endMs),
							checkout: null,
						});
					}
				}
			}
		}
	}
	return { claims };
}

/** A planned row names a store the history does not define — a bug in this file. */
export class UnknownHistoryEntryError extends Error {
	public constructor(kind: "store", key: string) {
		super(`Unknown analytics history ${kind} ${key}`);
		this.name = "UnknownHistoryEntryError";
	}
}

/** Writes rows in chunks (one `createMany` per chunk keeps every statement well below the bind-parameter limit). */
const CREATE_MANY_CHUNK = 500;

async function inChunks<TRow>(rows: readonly TRow[], write: (chunk: TRow[]) => Promise<void>): Promise<void> {
	for (let start = 0; start < rows.length; start += CREATE_MANY_CHUNK) {
		await write(rows.slice(start, start + CREATE_MANY_CHUNK));
	}
}

function rewardStatus(reward: HistoryReward): RewardStatus {
	return reward.endDaysAgo > 0 ? "EXPIRED" : "PUBLISHED";
}

export interface AnalyticsHistorySummary {
	readonly rewards: number;
	readonly claims: number;
	readonly sales: number;
}

/**
 * Seeds the plan for the demo tenants (after `seedRewards`, which created the
 * stores, terminals and the KL / Bukit Katil POS keys): the Bukit Beruang POS
 * key, the history rewards, their claims, bills, redemptions and checkout
 * audit rows.
 */
export async function seedAnalyticsHistory(input: AnalyticsHistoryPlanInput & { readonly createdByUserId: string }): Promise<AnalyticsHistorySummary> {
	const { nowMs } = input;
	const plan = buildAnalyticsHistoryPlan(input);
	const storeByKey = new Map(HISTORY_STORES.map((store) => [store.key, store]));
	const rewardId = (key: string): string => deterministicUuid("reward-seed-history-reward", key);
	const requireStore = (key: string): HistoryStore => {
		const store = storeByKey.get(key);
		if (store === undefined) throw new UnknownHistoryEntryError("store", key);
		return store;
	};

	await prisma.organizationApiKey.create({
		data: {
			id: deterministicUuid("reward-seed-api-key", "mlk-beruang-pos"),
			organizationId: ORGANIZATION_SEED_IDS.mlkOrganization,
			locationId: ORGANIZATION_SEED_IDS.mlkLocationBeruang,
			name: "Melaka Bukit Beruang POS",
			keyHash: sha256Hex(BERUANG_POS_KEY_PLAINTEXT),
			keyPrefix: BERUANG_POS_KEY_PLAINTEXT.slice(0, API_KEY_PREFIX_LENGTH),
			scope: "POS",
			createdByUserId: input.createdByUserId,
		},
	});

	for (const reward of HISTORY_REWARDS) {
		const rows = plan.claims.filter((claim) => claim.rewardKey === reward.key);
		const redeemed = rows.filter((claim) => claim.status === "REDEEMED").length;
		const window = rewardWindow(reward, nowMs);
		const quantityTotal = redeemed + (rewardStatus(reward) === "PUBLISHED" ? REMAINING_STOCK : 0);
		await prisma.reward.create({
			data: {
				id: rewardId(reward.key),
				organizationId: reward.organizationId,
				title: reward.title,
				description: reward.description,
				rewardType: reward.rewardType,
				rewardValue: reward.rewardValue,
				termsConditions: "One per bill. Not combinable with other rewards.",
				rewardKind: "CONSUMER",
				category: reward.category,
				placeholderImageKey: `category-${reward.category}`,
				minSpendMinor: reward.minSpendMinor,
				quantityTotal,
				quantityRemaining: quantityTotal - redeemed,
				quantityReserved: 0,
				startDate: window.startMs,
				expiryDate: window.endMs,
				status: rewardStatus(reward),
				claimCount: rows.length,
				redemptionCount: redeemed,
				referralsEnabled: false,
				locationScopeType: reward.locationIds === null ? "ALL_LOCATIONS" : "SELECTED",
				reviewedAt: window.startMs,
				createdAt: window.startMs - DAY_MS,
			},
		});
		if (reward.locationIds !== null) {
			await prisma.rewardLocationScope.createMany({
				data: reward.locationIds.map((locationId) => ({ rewardId: rewardId(reward.key), organizationId: reward.organizationId, locationId })),
			});
		}
	}

	const claimRows: Prisma.RewardClaimCreateManyInput[] = plan.claims.map((claim) => ({
		id: deterministicUuid("reward-seed-history-claim", claim.key),
		userId: claim.userId,
		rewardId: rewardId(claim.rewardKey),
		redemptionTokenHash: seedCodeHash(`seed_history_qr_${claim.key}`),
		backupCodeHash: seedCodeHash(`seed_history_backup_${claim.key}`),
		status: claim.status,
		claimedAt: claim.claimedAt,
		claimExpiresAt: claim.claimExpiresAt,
		redeemedAt: claim.checkout?.paidAt ?? null,
		createdAt: claim.claimedAt,
		updatedAt: claim.checkout?.paidAt ?? claim.claimExpiresAt,
	}));
	const redeemed = plan.claims.flatMap((claim) => (claim.checkout === null ? [] : [{ claim, checkout: claim.checkout, store: requireStore(claim.checkout.storeKey) }]));
	const saleRows: Prisma.RewardSaleCreateManyInput[] = redeemed.map(({ claim, checkout, store }) => ({
		id: deterministicUuid("reward-seed-history-sale", claim.key),
		organizationId: store.organizationId,
		locationId: store.locationId,
		userId: claim.userId,
		terminalId: store.terminalId,
		apiKeyId: store.apiKeyId,
		billTotalMinor: checkout.billTotalMinor,
		currency: DEFAULT_SALE_CURRENCY,
		idempotencyKey: deterministicUuid("reward-seed-history-checkout-key", claim.key),
		requestHash: sha256Hex(`seed-history-checkout:${claim.key}`),
		paidAt: checkout.paidAt,
		createdAt: checkout.paidAt,
		updatedAt: checkout.paidAt,
	}));
	const redemptionRows: Prisma.RewardRedemptionCreateManyInput[] = redeemed.map(({ claim, checkout, store }) => ({
		id: deterministicUuid("reward-seed-history-redemption", claim.key),
		claimId: deterministicUuid("reward-seed-history-claim", claim.key),
		organizationId: store.organizationId,
		locationId: store.locationId,
		userId: claim.userId,
		terminalId: store.terminalId,
		redemptionMethod: checkout.redemptionMethod,
		saleId: deterministicUuid("reward-seed-history-sale", claim.key),
		redeemedAt: checkout.paidAt,
		createdAt: checkout.paidAt,
		updatedAt: checkout.paidAt,
	}));
	const auditRows: Prisma.RewardAuditLogCreateManyInput[] = redeemed.map(({ claim, checkout, store }) => ({
		id: deterministicUuid("reward-seed-history-audit-checkout", claim.key),
		organizationId: store.organizationId,
		action: "merchant.checkout",
		metadata: {
			saleId: deterministicUuid("reward-seed-history-sale", claim.key),
			claimIds: [deterministicUuid("reward-seed-history-claim", claim.key)],
			terminalId: store.terminalId,
			apiKeyId: store.apiKeyId,
			locationId: store.locationId,
			billTotalMinor: checkout.billTotalMinor,
			currency: DEFAULT_SALE_CURRENCY,
		},
		createdAt: checkout.paidAt,
	}));

	await inChunks(claimRows, async (chunk) => {
		await prisma.rewardClaim.createMany({ data: chunk });
	});
	await inChunks(saleRows, async (chunk) => {
		await prisma.rewardSale.createMany({ data: chunk });
	});
	await inChunks(redemptionRows, async (chunk) => {
		await prisma.rewardRedemption.createMany({ data: chunk });
	});
	// Audit rows are never deleted (re-runs keep the first copy).
	await inChunks(auditRows, async (chunk) => {
		await prisma.rewardAuditLog.createMany({ data: chunk, skipDuplicates: true });
	});

	return { rewards: HISTORY_REWARDS.length, claims: claimRows.length, sales: saleRows.length };
}

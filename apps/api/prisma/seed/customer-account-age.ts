// ============================================
// prisma/seed/customer-account-age.ts — seeded customers existed before their history
// ============================================
// Seeded users are created "now", but the analytics history gives them claims
// and bills up to a year back. An account that buys before it exists makes
// account-age and new-vs-returning reasoning wrong, so after the reward seeds
// ran, every seeded user with reward activity is dated back: signed up a few
// days before their first claim / bill / referral, verified (email, and phone
// when verified at all) shortly after signing up. Deterministic per user and
// seed; recomputed on every run, so a re-run converges.

import { DAY_MS } from "@workspace/shared";

import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { SeededRandom } from "./prng";

/** Days between signing up and the first reward activity (each customer gets one value in this range). */
const MIN_SIGNUP_LEAD_DAYS = 2;
const MAX_SIGNUP_LEAD_DAYS = 21;
/** Minutes between signing up and verifying the email / phone. */
const MIN_VERIFY_DELAY_MINUTES = 3;
const MAX_VERIFY_DELAY_MINUTES = 90;
const MINUTE_MS = 60_000;

/**
 * Terms / privacy version recorded for a customer whose history began before
 * the seed's current documents (2026-01-01): the version in force back then.
 */
export const SEED_HISTORIC_LEGAL_VERSION = "2025-01-01";

/** When an account was created and verified, given its first reward activity. */
export interface AccountTimeline {
	readonly createdAt: number;
	readonly verifiedAt: number;
}

/** The account timeline of `userId`: created `MIN…MAX_SIGNUP_LEAD_DAYS` days before `firstActivityAt`, verified minutes later. */
export function accountTimeline(seed: number, userId: string, firstActivityAt: number): AccountTimeline {
	const random = SeededRandom.derive(seed, `account-age:${userId}`);
	const createdAt = firstActivityAt - random.int(MIN_SIGNUP_LEAD_DAYS, MAX_SIGNUP_LEAD_DAYS) * DAY_MS - random.int(0, DAY_MS / MINUTE_MS - 1) * MINUTE_MS;
	return { createdAt, verifiedAt: createdAt + random.int(MIN_VERIFY_DELAY_MINUTES, MAX_VERIFY_DELAY_MINUTES) * MINUTE_MS };
}

/** Earliest reward activity (claim, bill, referral sent) per user, and earliest claim, from the seeded rows. */
async function firstActivityByUser(): Promise<{ readonly activity: Map<string, number>; readonly claims: Map<string, number> }> {
	const [claims, sales, referrals] = await Promise.all([
		prisma.rewardClaim.groupBy({ by: ["userId"], _min: { claimedAt: true } }),
		prisma.rewardSale.groupBy({ by: ["userId"], _min: { paidAt: true } }),
		prisma.rewardReferral.groupBy({ by: ["referrerUserId"], _min: { createdAt: true } }),
	]);
	const first = new Map<string, number>();
	const record = (userId: string, at: bigint | null): void => {
		if (at === null) return;
		first.set(userId, Math.min(first.get(userId) ?? Number.POSITIVE_INFINITY, Number(at)));
	};
	for (const row of claims) record(row.userId, row._min.claimedAt);
	for (const row of sales) record(row.userId, row._min.paidAt);
	for (const row of referrals) record(row.referrerUserId, row._min.createdAt);
	const firstClaims = new Map(claims.flatMap((row) => (row._min.claimedAt === null ? [] : [[row.userId, Number(row._min.claimedAt)] satisfies [string, number]])));
	return { activity: first, claims: firstClaims };
}

/**
 * The app records a legal acceptance (`POST /legal/accept`: `acceptedAt` =
 * `createdAt` = now) and refuses a claim without one. So every seeded customer
 * with a claim has an active acceptance no later than that first claim: rows
 * dated after it are moved to the moment the account was verified, and a
 * customer without one gets one (deterministic id — re-runs upsert it).
 */
async function alignLegalAcceptance(userId: string, firstClaimAt: number, acceptedAt: number): Promise<void> {
	const rows = await prisma.rewardLegalAcceptance.findMany({ where: { userId, isDeleted: false }, select: { id: true, acceptedAt: true } });
	for (const row of rows) {
		if (Number(row.acceptedAt) > firstClaimAt) {
			await prisma.rewardLegalAcceptance.update({ where: { id: row.id }, data: { acceptedAt, createdAt: acceptedAt, updatedAt: acceptedAt } });
		}
	}
	if (rows.length === 0) {
		const id = deterministicUuid("seed-legal-acceptance", userId);
		const data = { termsVersion: SEED_HISTORIC_LEGAL_VERSION, privacyVersion: SEED_HISTORIC_LEGAL_VERSION, acceptedAt, createdAt: acceptedAt, updatedAt: acceptedAt };
		await prisma.rewardLegalAcceptance.upsert({ where: { id }, create: { id, userId, ...data }, update: data });
	}
}

/**
 * Dates every seeded user with reward activity back to before it: `createdAt`,
 * and `emailVerifiedAt` / `phoneVerifiedAt` where set (an unverified demo
 * account stays unverified), and their legal acceptance to no later than their
 * first claim. Only the given users are touched.
 */
export async function alignCustomerAccountAges(seed: number, userIds: readonly string[]): Promise<number> {
	const { activity: first, claims: firstClaims } = await firstActivityByUser();
	const users = await prisma.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, emailVerifiedAt: true, phoneVerifiedAt: true } });
	let aligned = 0;
	for (const user of users) {
		const firstActivityAt = first.get(user.id);
		if (firstActivityAt === undefined) continue;
		const timeline = accountTimeline(seed, user.id, firstActivityAt);
		await prisma.user.update({
			where: { id: user.id },
			data: {
				createdAt: timeline.createdAt,
				...(user.emailVerifiedAt === null ? {} : { emailVerifiedAt: timeline.verifiedAt }),
				...(user.phoneVerifiedAt === null ? {} : { phoneVerifiedAt: timeline.verifiedAt }),
			},
		});
		const firstClaimAt = firstClaims.get(user.id);
		if (firstClaimAt !== undefined) {
			await alignLegalAcceptance(user.id, firstClaimAt, timeline.verifiedAt);
		}
		aligned += 1;
	}
	return aligned;
}

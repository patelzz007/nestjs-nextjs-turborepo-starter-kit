import type { User } from "@prisma/client";
import { DAY_MS, SIGNUP_REFERRAL_CODE_TTL_MS, SIGNUP_REFERRALS_SCREEN_PATH } from "@workspace/shared";

import { issueSignupReferralCode } from "../../src/modules/auth/signup-referrals/signup-referral-code.issuer";
import { SIGNUP_REFERRAL_SUCCESS_NOTIFICATION_TYPE } from "../../src/modules/auth/signup-referrals/signup-referral.repository";
import { prisma } from "./client";
import { seedLog } from "./seed-log";

/** The demo referrer: a consumer account whose Referrals screen shows every state. */
const DEMO_REFERRER_EMAIL = "alice.johnson@example.com";

/** Days ago the demo referrer's retired code expired. */
const RETIRED_CODE_EXPIRED_DAYS_AGO = 10;

/** How long before `now` the demo referrer's retired code was issued — one full window plus the days since it expired. */
const RETIRED_CODE_AGE_MS = SIGNUP_REFERRAL_CODE_TTL_MS + RETIRED_CODE_EXPIRED_DAYS_AGO * DAY_MS;

/** The demo referrer's code rows: one retired (expired, superseded) and the current one. */
const DEMO_REFERRER_CODE_ROWS = 2;

type DemoRefereeState = "notified" | "owed" | "not_redeemed";

/** The demo referees, oldest registration first, and the state each one shows. */
const DEMO_REFEREE_STATES: readonly DemoRefereeState[] = ["notified", "owed", "not_redeemed"];

/** Days before `now` each demo referee registered, matching {@link DEMO_REFEREE_STATES}. */
const DEMO_REFEREE_REGISTERED_DAYS_AGO: Readonly<Record<DemoRefereeState, number>> = { notified: 6, owed: 4, not_redeemed: 2 };

/** Days after registering that a redeemed demo referee made their first redemption. */
const FIRST_REDEMPTION_AFTER_DAYS = 1;

/**
 * Issues each non-deleted account's first signup referral code (ADR 035) — a
 * deactivated account included, so reactivation finds a code. Production
 * issues these at account creation and from the hourly job; the seed writes
 * them through the same issuer, so the rows have the same shape.
 */
export async function seedSignupReferralCodes(users: readonly User[]): Promise<void> {
	const now = Date.now();
	let created = 0;
	for (const user of users) {
		if (user.isDeleted) {
			continue;
		}
		const existing = await prisma.signupReferralCode.findFirst({ where: { userId: user.id, isDeleted: false }, select: { id: true } });
		if (existing !== null) {
			continue;
		}
		await issueSignupReferralCode(prisma, user.id, now);
		created += 1;
	}
	seedLog(`✅ Signup referral codes (${String(created)} new, ${String(users.length)} accounts checked)`);
}

/**
 * The demo referrer's history and referees: a retired (expired, superseded)
 * code kept beside the current one, and three referees — redeemed and
 * notified, redeemed with the notification still owed (the hourly retry
 * delivers it), and not redeemed. Idempotent: a referee that already has a
 * signup referral is left as it is.
 */
export async function seedSignupReferralDemo(users: readonly User[]): Promise<void> {
	const now = Date.now();
	const referrer = users.find((user) => user.email === DEMO_REFERRER_EMAIL && !user.isDeleted && user.isActive);
	if (referrer === undefined) {
		seedLog(`⚠️ Signup referral demo skipped: ${DEMO_REFERRER_EMAIL} is not seeded`);
		return;
	}
	// seedSignupReferralCodes already issued the current code; a retired one dated a full
	// window earlier sits beside it, so the referrer's history has two rows and the
	// current code stays the latest.
	if ((await prisma.signupReferralCode.count({ where: { userId: referrer.id } })) < DEMO_REFERRER_CODE_ROWS) {
		await issueSignupReferralCode(prisma, referrer.id, now - RETIRED_CODE_AGE_MS);
	}
	const latest = await prisma.signupReferralCode.findFirst({ where: { userId: referrer.id, isDeleted: false }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
	if (latest === null) {
		throw new Error(`Signup referral demo: ${DEMO_REFERRER_EMAIL} has no code`);
	}

	const candidates = users.filter((user) => user.id !== referrer.id && !user.isDeleted && user.isActive && !user.isSuperAdmin);
	let created = 0;
	for (const [position, state] of DEMO_REFEREE_STATES.entries()) {
		const referee = candidates.at(position);
		if (referee === undefined) {
			continue;
		}
		const existing = await prisma.signupReferral.findUnique({ where: { refereeUserId: referee.id }, select: { id: true } });
		if (existing !== null) {
			continue;
		}
		const registeredAt = now - DEMO_REFEREE_REGISTERED_DAYS_AGO[state] * DAY_MS;
		const successfulAt = state === "not_redeemed" ? null : registeredAt + FIRST_REDEMPTION_AFTER_DAYS * DAY_MS;
		const successNotifiedAt = state === "notified" && successfulAt !== null ? successfulAt : null;
		const referral = await prisma.signupReferral.create({
			data: {
				referrerUserId: referrer.id,
				refereeUserId: referee.id,
				referralCodeId: latest.id,
				createdAt: BigInt(registeredAt),
				updatedAt: BigInt(successNotifiedAt ?? successfulAt ?? registeredAt),
				successfulAt: successfulAt === null ? null : BigInt(successfulAt),
				successNotifiedAt: successNotifiedAt === null ? null : BigInt(successNotifiedAt),
			},
		});
		if (successNotifiedAt !== null) {
			await prisma.rewardNotification.create({
				data: {
					userId: referrer.id,
					type: SIGNUP_REFERRAL_SUCCESS_NOTIFICATION_TYPE,
					title: "Referral successful",
					body: `${referee.fullName} redeemed a reward. Your referral is successful.`,
					metadata: { signupReferralId: referral.id, href: SIGNUP_REFERRALS_SCREEN_PATH },
					createdAt: BigInt(successNotifiedAt),
				},
			});
		}
		created += 1;
	}
	seedLog(`✅ Signup referral demo (${String(created)} referees of ${DEMO_REFERRER_EMAIL})`);
}

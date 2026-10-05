import type { RewardClaimStatus, RewardType, User } from "@prisma/client";
import * as bcrypt from "bcrypt";

import { POS_PAIRING_CODE_TTL_MS } from "@workspace/shared";

import { sha256Hex } from "../../src/common/crypto/sha256";
import { API_KEY_PREFIX_LENGTH } from "../../src/modules/rewards/services/merchant-api-key.service";

import { cleanupOrganizationSeedData, ORGANIZATION_SEED_IDS, SEED_ORGANIZATION_IDS, SEED_TEAM_INVITE_TOKEN_KL_ALICE, seedOrganizationsAndMerchants } from "./organizations";
import { prisma } from "./client";
import { seedCodeHash } from "./reward-code-hashing";
import { deterministicUuid } from "./deterministic-uuid";
import { daysAgo, daysFromNow } from "./helpers";
import { seedCheckout, type SeedCheckoutInput } from "./reward-checkout";
import { seedRewardLifecycleStates } from "./reward-lifecycle-states";
import { seedLog } from "./seed-log";

/** Fixed seed UUIDs for idempotent re-seeds. */
export const REWARD_SEED_IDS = Object.freeze({
	klOwnerUser: "326494e1-b45d-4203-b881-05b60ae50b4a",
	mlkOwnerUser: "b9cda090-b9e8-42e4-b7b1-b6d00294f022",
	klCashierUser: "937f5e43-9b11-47d0-866c-91fec89bc250",
	klPendingCashierUser: "a378a4d1-6915-4eb3-bf84-6fb14e1feb72",
	mlkCashierUser: "e79116ab-29e4-40ad-a5c7-f3158f7b1aa1",
	klRewardPublished: "c1214e16-bf0f-4410-8871-8d1a9970f75e",
	klRewardReferrer: "bab08148-80f2-4586-b1ea-48241dae1490",
	klRewardPending: "c25c75db-a700-499b-9649-dc965aa21264",
	klRewardDraft: "94a8af08-39cf-44ad-b3e7-9de599ad7938",
	klRewardExpired: "81ae6a7e-cea3-4117-8827-6c01e7754262",
	mlkRewardPublished: "af18c941-a960-4eaa-b988-9e15ceae6e96",
	mlkRewardKatilOnly: deterministicUuid("reward-seed", "mlk-katil-only"),
	mlkRewardBeruangOnly: deterministicUuid("reward-seed", "mlk-beruang-only"),
	mlkRewardReferrer: "098bb3dc-3121-4232-bbdf-d9ad684eecb8",
	mlkRewardDisabled: "9509c30b-c09d-4762-809c-7f421813ac36",
	claimPendingKl: "74199f6f-877f-4d87-8a02-78941a4ae1af",
	claimRedeemedKl: "df82577e-e756-4751-bf97-4d51fa3fe7be",
	claimExpiredKl: "83a172f3-76f9-483e-8756-d142e059f9d3",
	claimPendingMlk: "df2c10eb-7a56-456c-9b8c-5e3d1143c5b2",
	claimRedeemedMlk: "a2c10eb7-7a56-456c-9b8c-5e3d1143c5c3",
	referralPending: "13d97a9f-cb94-432b-bdb7-9011649cad0c",
	referralCredited: "594dcffc-3091-4aca-befa-affd618d5c36",
});

/**
 * Plaintext merchant API keys for staging / simulator (seed only).
 * Suffix matches production format: `openssl rand -base64 128` (fixed here for idempotent seeds).
 */
export const DEMO_MERCHANT_API_KEYS = Object.freeze({
	kl: "mk_live_IwgbQID2Csq4nbnfwUxVUrQT8lwrlhEz7bzagwasKyFtZYSQ42LSH43lzTfRdBkV7tZArdHQQE4EW0wDHpVAroL57w/+5AzsCxRpax2fmu3JqITATsJKJRi4+fifNVj1E3WswonhsleEBinxwcMOlqccH0suhUq6mJWVvaWYkf8=",
	mlk: "mk_live_Dx20Nsn5K79wGXWaTYbEvUyVLQrXWIwExA7zsK4jGyMMKxVPxsmJHoIrGimviO7RBtbb5ZdLsEcT0vxGeBVhV7NP72FoIRxFcF17juhUiMxrHxfAMuIy5NuYIK/eMqDdpWY5KNYxMGNCy/iT20Kc7813y2bMoOjZTCJJ/84JMQY=",
	/** Organization-wide INTEGRATION key (back-office sync): not bound to a store or terminal, not usable on /redemptions/*. */
	klIntegration: "mk_live_seedKlBackOfficeIntegrationKey7Hq2Vt9Xc4Lm8Np3Rs6Wz5Yb2Dg7Jk4Fh9Qa3Ue6Ti8Oy1Pw5",
});

/** Plaintext QR token for pending KL claim (hash stored in DB). */
/** Extra published marketplace rewards seeded for Brew & Bean KL. */
interface ExtraKlRewardSeed {
	readonly title: string;
	readonly description: string;
	readonly rewardType: RewardType;
	readonly rewardValue?: number;
	readonly category: string;
	readonly placeholderImageKey: string;
	readonly quantityTotal: number;
	readonly quantityRemaining: number;
	readonly quantityReserved: number;
}

export const DEMO_QR_TOKEN_PENDING_KL = "seed_qr_token_kl_pending_alice_001";

/** Plaintext backup code for pending KL claim. */
export const DEMO_BACKUP_CODE_PENDING_KL = "ABCD2345";

/** Plaintext one-time pairing code issued for KL-REGISTER-02 (hash stored; valid for `POS_PAIRING_CODE_TTL_MS` after seeding). */
export const DEMO_PAIRING_CODE_KL_REGISTER_02 = "PQRS2345";

/** Unknown backup codes recorded against the Melaka simulator key (below `POS_CODE_MAX_FAILURES`). */
const SEED_RECENT_CODE_FAILURES = 2;

/** How long ago that failure window opened. */
const SEED_CODE_FAILURE_WINDOW_AGE_MS = 5 * 60_000;

async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, 10);
}

async function upsertMerchantUser(id: string, email: string, fullName: string, password: string, phone: string | null, phoneVerifiedAt: number | null): Promise<User> {
	const passwordHash = await hashPassword(password);
	return prisma.user.upsert({
		where: { email },
		create: {
			id,
			email,
			fullName,
			passwordHash,
			isActive: true,
			emailVerifiedAt: Date.now(),
			phone,
			phoneVerifiedAt,
		},
		update: {
			fullName,
			passwordHash,
			phone,
			phoneVerifiedAt,
		},
	});
}

async function setRewardLocationScopes(rewardId: string, organizationId: string, locationIds: readonly string[]): Promise<void> {
	if (locationIds.length === 0) {
		return;
	}

	await prisma.reward.update({
		where: { id: rewardId },
		data: { locationScopeType: "SELECTED" },
	});

	await prisma.rewardLocationScope.createMany({
		data: locationIds.map((locationId) => ({
			rewardId,
			organizationId,
			locationId,
		})),
	});
}

async function ensureSeedConsumerRole(userId: string): Promise<void> {
	const userRole = await prisma.role.findFirst({
		where: { name: "User", isDeleted: false },
		select: { id: true },
	});

	if (userRole === null) {
		return;
	}

	await prisma.userRole.upsert({
		where: { userId_roleId: { userId, roleId: userRole.id } },
		create: { userId, roleId: userRole.id },
		update: { isDeleted: false, deletedAt: null },
	});
}

/** Consumer accounts whose reward rows (notifications, legal acceptances, OTP challenges) the seed owns. */
const SEED_CONSUMER_EMAILS: readonly string[] = ["alice.johnson@example.com", "bob.smith@example.com", "carol.white@example.com", "user@example.com"];

/**
 * Removes the re-creatable reward rows of the SEED tenants (and the seed
 * consumers' notification/legal/OTP rows) so the next run converges. Scoped by
 * id — another tenant's data is never touched — and audit tables
 * (`reward_audit_logs`, `organization_audit_logs`) are never deleted: the seed
 * writes its own audit rows with deterministic ids instead.
 */
export async function cleanupRewardSeedData(): Promise<void> {
	const organizationId = { in: [...SEED_ORGANIZATION_IDS] };
	const seedConsumers = await prisma.user.findMany({ where: { email: { in: [...SEED_CONSUMER_EMAILS] } }, select: { id: true } });
	const userId = { in: seedConsumers.map((consumer) => consumer.id) };

	await prisma.rewardNotification.deleteMany({ where: { userId } });
	await prisma.rewardLegalAcceptance.deleteMany({ where: { userId } });
	await prisma.rewardOtpChallenge.deleteMany({ where: { userId } });
	await prisma.rewardRedemption.deleteMany({ where: { organizationId } });
	// After redemptions: they reference their sale (ON DELETE RESTRICT).
	await prisma.rewardSale.deleteMany({ where: { organizationId } });
	await prisma.rewardClaim.deleteMany({ where: { reward: { organizationId } } });
	await prisma.rewardReferral.deleteMany({ where: { reward: { organizationId } } });
	await prisma.rewardLocationScope.deleteMany({ where: { organizationId } });
	// Referrer clones point at their parent; unlink before deleting either side.
	await prisma.reward.updateMany({ where: { organizationId }, data: { referrerRewardId: null, parentConsumerRewardId: null } });
	await prisma.reward.deleteMany({ where: { organizationId } });
	await prisma.organizationTerminal.deleteMany({ where: { organizationId } });
	await prisma.organizationApiKey.deleteMany({ where: { organizationId } });
	await cleanupOrganizationSeedData();
}

export interface RewardSeedSummary {
	organizations: number;
	rewards: number;
	claims: number;
	redemptions: number;
	referrals: number;
	notifications: number;
}

/** Bill totals (sen) of the seeded checkouts — each meets its reward's minimum spend. */
const SEED_BILL_KL_BOB_MINOR = 1_850;
const SEED_BILL_MLK_CAROL_MINOR = 4_820;
const SEED_BULK_BILL_BASE_MINOR = 1_200;
const SEED_BULK_BILL_STEP_MINOR = 350;

/** The paid POS bill a REDEEMED seed claim went through; seeded at the claim's `redeemedAt`. */
type SeedClaimCheckout = Omit<SeedCheckoutInput, "userId" | "claimId" | "paidAt">;

/** One seeded reward claim; the QR token and backup code are stored as their keyed hashes. */
interface SeedClaim {
	readonly id?: string;
	readonly userId: string;
	readonly rewardId: string;
	readonly referralId?: string;
	readonly qrToken: string;
	readonly backupCode: string;
	readonly status: RewardClaimStatus;
	readonly isReferrerCredit?: boolean;
	readonly claimedAt: number;
	readonly claimExpiresAt: number;
	readonly redeemedAt?: number | null;
	readonly checkout?: SeedClaimCheckout;
}

async function seedClaim({ qrToken, backupCode, checkout, ...claim }: SeedClaim): Promise<void> {
	const created = await prisma.rewardClaim.create({
		data: { ...claim, redemptionTokenHash: seedCodeHash(qrToken), backupCodeHash: seedCodeHash(backupCode) },
	});
	if (checkout !== undefined && claim.redeemedAt !== undefined && claim.redeemedAt !== null) {
		await seedCheckout({ ...checkout, userId: claim.userId, claimId: created.id, paidAt: claim.redeemedAt });
	}
}

export async function seedRewards(adminUser: User, consumerUsers: User[]): Promise<RewardSeedSummary> {
	const now = Date.now();
	const alice = consumerUsers.find((u) => u.email === "alice.johnson@example.com");
	const bob = consumerUsers.find((u) => u.email === "bob.smith@example.com");
	const carol = consumerUsers.find((u) => u.email === "carol.white@example.com");
	const user = consumerUsers.find((u) => u.email === "user@example.com");

	if (!alice || !bob || !carol || !user) {
		throw new Error("seedRewards requires alice, bob, carol, and user@example.com from base seed");
	}

	const klOwner = await upsertMerchantUser(REWARD_SEED_IDS.klOwnerUser, "brew.owner@kl-rewards.demo", "Ahmad Brew", "BrewOwner@123", "+60123456701", now);
	const mlkOwner = await upsertMerchantUser(REWARD_SEED_IDS.mlkOwnerUser, "jonker.owner@melaka-rewards.demo", "Siti Jonker", "JonkerOwner@123", "+60123456702", now);
	const klCashier = await upsertMerchantUser(REWARD_SEED_IDS.klCashierUser, "brew.cashier@kl-rewards.demo", "Lee Cashier", "BrewCashier@123", null, null);
	const klPendingCashier = await upsertMerchantUser(REWARD_SEED_IDS.klPendingCashierUser, "alice.kl@kl-rewards.demo", "Alice Tan", "AliceKl@123", null, null);
	const mlkCashier = await upsertMerchantUser(REWARD_SEED_IDS.mlkCashierUser, "jonker.cashier@melaka-rewards.demo", "Mira Cashier", "JonkerCashier@123", null, null);

	for (const merchantUser of [klOwner, mlkOwner, klCashier, klPendingCashier, mlkCashier]) {
		await ensureSeedConsumerRole(merchantUser.id);
	}

	const { klOrganization, mlkOrganization } = await seedOrganizationsAndMerchants(adminUser, klOwner, mlkOwner, klCashier, mlkCashier, user, klPendingCashier);

	const klKeyId = deterministicUuid("reward-seed-api-key", "kl-pos-simulator");
	const mlkKeyId = deterministicUuid("reward-seed-api-key", "mlk-katil-pos");
	const klIntegrationKeyId = deterministicUuid("reward-seed-api-key", "kl-integration");

	// The two simulator keys only call /redemptions/* — POS scope. The Melaka key carries a few
	// recent unknown backup codes (below the lockout limit) so the lockout columns hold real data.
	await prisma.organizationApiKey.createMany({
		data: [
			{
				id: klKeyId,
				organizationId: klOrganization.id,
				locationId: ORGANIZATION_SEED_IDS.klLocation,
				name: "KL POS Simulator",
				keyHash: sha256Hex(DEMO_MERCHANT_API_KEYS.kl),
				keyPrefix: DEMO_MERCHANT_API_KEYS.kl.slice(0, API_KEY_PREFIX_LENGTH),
				scope: "POS",
				createdByUserId: klOwner.id,
			},
			{
				id: mlkKeyId,
				organizationId: mlkOrganization.id,
				locationId: ORGANIZATION_SEED_IDS.mlkLocationKatil,
				name: "Melaka Bukit Katil POS",
				keyHash: sha256Hex(DEMO_MERCHANT_API_KEYS.mlk),
				keyPrefix: DEMO_MERCHANT_API_KEYS.mlk.slice(0, API_KEY_PREFIX_LENGTH),
				scope: "POS",
				createdByUserId: mlkOwner.id,
				codeFailureCount: SEED_RECENT_CODE_FAILURES,
				codeFailureWindowStartedAt: now - SEED_CODE_FAILURE_WINDOW_AGE_MS,
			},
			{
				id: klIntegrationKeyId,
				organizationId: klOrganization.id,
				locationId: null,
				name: "Brew & Bean back-office integration",
				keyHash: sha256Hex(DEMO_MERCHANT_API_KEYS.klIntegration),
				keyPrefix: DEMO_MERCHANT_API_KEYS.klIntegration.slice(0, API_KEY_PREFIX_LENGTH),
				scope: "INTEGRATION",
				createdByUserId: klOwner.id,
			},
		],
	});

	// Every till has its creator (the owner who registered it). KL-REGISTER-02 is awaiting pairing:
	// the cashier issued a code (`DEMO_PAIRING_CODE_KL_REGISTER_02`) that the till has not used yet.
	await prisma.organizationTerminal.createMany({
		data: [
			{
				organizationId: klOrganization.id,
				locationId: ORGANIZATION_SEED_IDS.klLocation,
				terminalId: "KL-REGISTER-01",
				label: "Front counter",
				createdByUserId: klOwner.id,
			},
			{
				organizationId: klOrganization.id,
				locationId: ORGANIZATION_SEED_IDS.klLocation,
				terminalId: "KL-REGISTER-02",
				label: "Drive-through",
				createdByUserId: klOwner.id,
				pairingCodeHash: seedCodeHash(DEMO_PAIRING_CODE_KL_REGISTER_02),
				pairingCodeExpiresAt: now + POS_PAIRING_CODE_TTL_MS,
				pairingCodeIssuedByUserId: klCashier.id,
				pairingCodeIssuedAt: now,
			},
			{
				organizationId: mlkOrganization.id,
				locationId: ORGANIZATION_SEED_IDS.mlkLocationKatil,
				terminalId: "MLK-KATIL-01",
				label: "Bukit Katil counter",
				createdByUserId: mlkOwner.id,
			},
			{
				organizationId: mlkOrganization.id,
				locationId: ORGANIZATION_SEED_IDS.mlkLocationBeruang,
				terminalId: "MLK-BERUANG-01",
				label: "Bukit Beruang counter",
				createdByUserId: mlkOwner.id,
			},
		],
	});

	// Consumer rewards first (referrer FK added after R′ rows exist)
	await prisma.reward.createMany({
		data: [
			{
				id: REWARD_SEED_IDS.klRewardPublished,
				organizationId: klOrganization.id,
				title: "Free coffee — Grand Opening",
				description: "One free regular coffee. Show QR at counter. Valid 7 days after claim.",
				rewardType: "FREE_ITEM",
				rewardValue: 1,
				termsConditions: "One per customer. Valid weekdays only.",
				rewardKind: "CONSUMER",
				category: "cafe",
				placeholderImageKey: "category-cafe",
				minSpendMinor: 0,
				quantityTotal: 200,
				quantityRemaining: 142,
				quantityReserved: 8,
				startDate: daysAgo(14),
				expiryDate: daysFromNow(45),
				status: "PUBLISHED",
				claimCount: 58,
				redemptionCount: 42,
				referralsEnabled: true,
				referralPoolTotal: 50,
				referralPoolRemaining: 48,
			},
			{
				id: REWARD_SEED_IDS.mlkRewardPublished,
				organizationId: mlkOrganization.id,
				title: "RM10 off Jonker lunch set",
				description: "Weekday lunch 11am–3pm. Min spend RM35. Available at both Bukit Katil and Bukit Beruang.",
				rewardType: "DISCOUNT",
				rewardValue: 10,
				termsConditions: "Minimum spend RM35. Weekdays 11am–3pm only.",
				rewardKind: "CONSUMER",
				category: "restaurant",
				placeholderImageKey: "category-restaurant",
				minSpendMinor: 3500,
				quantityTotal: 120,
				quantityRemaining: 95,
				quantityReserved: 5,
				startDate: daysAgo(7),
				expiryDate: daysFromNow(50),
				status: "PUBLISHED",
				claimCount: 28,
				redemptionCount: 18,
				referralsEnabled: true,
				referralPoolTotal: 30,
				referralPoolRemaining: 28,
				locationScopeType: "SELECTED",
			},
			{
				id: REWARD_SEED_IDS.mlkRewardKatilOnly,
				organizationId: mlkOrganization.id,
				title: "Free iced tea — Bukit Katil opening",
				description: "Complimentary iced tea with any main course at Bukit Katil only.",
				rewardType: "FREE_ITEM",
				rewardValue: 1,
				termsConditions: "Bukit Katil store only. One per customer per day.",
				rewardKind: "CONSUMER",
				category: "beverage",
				placeholderImageKey: "category-beverage",
				quantityTotal: 80,
				quantityRemaining: 64,
				quantityReserved: 3,
				startDate: daysAgo(3),
				expiryDate: daysFromNow(40),
				status: "PUBLISHED",
				claimCount: 16,
				redemptionCount: 11,
				referralsEnabled: false,
				locationScopeType: "SELECTED",
			},
			{
				id: REWARD_SEED_IDS.mlkRewardBeruangOnly,
				organizationId: mlkOrganization.id,
				title: "RM8 off weekend dinner — Bukit Beruang",
				description: "Friday and Saturday dinner from 6pm. Bukit Beruang store only.",
				rewardType: "DISCOUNT",
				rewardValue: 8,
				termsConditions: "Bukit Beruang store only. Fri–Sat 6pm–10pm.",
				rewardKind: "CONSUMER",
				category: "restaurant",
				placeholderImageKey: "category-restaurant",
				minSpendMinor: 2500,
				quantityTotal: 60,
				quantityRemaining: 48,
				quantityReserved: 2,
				startDate: daysAgo(5),
				expiryDate: daysFromNow(45),
				status: "PUBLISHED",
				claimCount: 12,
				redemptionCount: 8,
				referralsEnabled: false,
				locationScopeType: "SELECTED",
			},
		],
	});

	await setRewardLocationScopes(REWARD_SEED_IDS.mlkRewardPublished, mlkOrganization.id, [ORGANIZATION_SEED_IDS.mlkLocationKatil, ORGANIZATION_SEED_IDS.mlkLocationBeruang]);
	await setRewardLocationScopes(REWARD_SEED_IDS.mlkRewardKatilOnly, mlkOrganization.id, [ORGANIZATION_SEED_IDS.mlkLocationKatil]);
	await setRewardLocationScopes(REWARD_SEED_IDS.mlkRewardBeruangOnly, mlkOrganization.id, [ORGANIZATION_SEED_IDS.mlkLocationBeruang]);

	const klReferrerReward = await prisma.reward.create({
		data: {
			id: REWARD_SEED_IDS.klRewardReferrer,
			organizationId: klOrganization.id,
			title: "Referrer: Free pastry (Brew & Bean)",
			description: "Auto-cloned referrer reward when friends redeem the free coffee campaign.",
			rewardType: "FREE_ITEM",
			rewardKind: "REFERRER",
			category: "cafe",
			placeholderImageKey: "category-cafe",
			quantityTotal: 50,
			quantityRemaining: 48,
			quantityReserved: 1,
			expiryDate: daysFromNow(90),
			status: "PUBLISHED",
			referralsEnabled: false,
			parentConsumerRewardId: REWARD_SEED_IDS.klRewardPublished,
		},
	});

	const mlkReferrerReward = await prisma.reward.create({
		data: {
			id: REWARD_SEED_IDS.mlkRewardReferrer,
			organizationId: mlkOrganization.id,
			title: "Referrer: 15% off next meal",
			description: "Referrer bonus for Jonker lunch campaign.",
			rewardType: "DISCOUNT",
			rewardKind: "REFERRER",
			category: "restaurant",
			placeholderImageKey: "category-restaurant",
			quantityTotal: 30,
			quantityRemaining: 29,
			quantityReserved: 0,
			expiryDate: daysFromNow(60),
			status: "PUBLISHED",
			referralsEnabled: false,
			parentConsumerRewardId: REWARD_SEED_IDS.mlkRewardPublished,
		},
	});

	await prisma.reward.update({
		where: { id: REWARD_SEED_IDS.klRewardPublished },
		data: { referrerRewardId: klReferrerReward.id },
	});

	await prisma.reward.update({
		where: { id: REWARD_SEED_IDS.mlkRewardPublished },
		data: { referrerRewardId: mlkReferrerReward.id },
	});

	await setRewardLocationScopes(mlkReferrerReward.id, mlkOrganization.id, [ORGANIZATION_SEED_IDS.mlkLocationKatil, ORGANIZATION_SEED_IDS.mlkLocationBeruang]);

	await prisma.reward.createMany({
		data: [
			{
				id: REWARD_SEED_IDS.klRewardPending,
				organizationId: klOrganization.id,
				title: "20% off weekend brunch",
				description: "Awaiting admin moderation or auto-publish.",
				rewardType: "DISCOUNT",
				rewardKind: "CONSUMER",
				category: "cafe",
				placeholderImageKey: "category-cafe",
				quantityTotal: 80,
				quantityRemaining: 80,
				quantityReserved: 0,
				expiryDate: daysFromNow(30),
				status: "PENDING_REVIEW",
				submittedForReviewAt: daysAgo(1),
				autoPublishAt: daysFromNow(1),
				referralsEnabled: false,
			},
			{
				id: REWARD_SEED_IDS.klRewardDraft,
				organizationId: klOrganization.id,
				title: "Draft: Matcha latte trial",
				description: "Not submitted for review yet.",
				rewardType: "FREE_ITEM",
				rewardKind: "CONSUMER",
				category: "beverage",
				placeholderImageKey: "category-beverage",
				quantityTotal: 40,
				quantityRemaining: 40,
				quantityReserved: 0,
				expiryDate: daysFromNow(20),
				status: "DRAFT",
				referralsEnabled: false,
			},
			{
				id: REWARD_SEED_IDS.klRewardExpired,
				organizationId: klOrganization.id,
				title: "Expired: Merdeka promo",
				description: "Past campaign for expiry job testing.",
				rewardType: "DISCOUNT",
				rewardKind: "CONSUMER",
				category: "cafe",
				placeholderImageKey: "category-cafe",
				quantityTotal: 100,
				quantityRemaining: 12,
				quantityReserved: 0,
				expiryDate: daysAgo(3),
				status: "EXPIRED",
				referralsEnabled: false,
			},
			{
				id: REWARD_SEED_IDS.mlkRewardDisabled,
				organizationId: mlkOrganization.id,
				title: "Disabled: Cendol giveaway",
				description: "Merchant disabled after stock issue.",
				rewardType: "FREE_ITEM",
				rewardKind: "CONSUMER",
				category: "food",
				placeholderImageKey: "category-food",
				quantityTotal: 50,
				quantityRemaining: 0,
				quantityReserved: 0,
				expiryDate: daysFromNow(10),
				status: "DISABLED",
				referralsEnabled: false,
			},
		],
	});

	// Extra published rewards for marketplace volume
	const extraKlRewards: readonly ExtraKlRewardSeed[] = [
		{
			title: "RM5 cashback on dine-in",
			description: "Credited on your next visit.",
			rewardType: "CASHBACK",
			rewardValue: 5,
			category: "restaurant",
			placeholderImageKey: "category-restaurant",
			quantityTotal: 75,
			quantityRemaining: 60,
			quantityReserved: 2,
		},
		{
			title: "Double loyalty points weekend",
			description: "Earn 2x points on all orders.",
			rewardType: "POINTS",
			rewardValue: 200,
			category: "retail",
			placeholderImageKey: "category-retail",
			quantityTotal: 100,
			quantityRemaining: 88,
			quantityReserved: 1,
		},
		{
			title: "BOGO signature noodles",
			description: "Buy one bowl, get one free.",
			rewardType: "BOGO",
			rewardValue: 1,
			category: "food",
			placeholderImageKey: "category-food",
			quantityTotal: 50,
			quantityRemaining: 41,
			quantityReserved: 1,
		},
		{
			title: "Second coffee 50% off",
			description: "Afternoon pick-me-up 2–5pm.",
			rewardType: "DISCOUNT",
			category: "cafe",
			placeholderImageKey: "category-cafe",
			quantityTotal: 60,
			quantityRemaining: 44,
			quantityReserved: 3,
		},
		{
			title: "Free croissant with any drink",
			description: "Breakfast bundle.",
			rewardType: "FREE_ITEM",
			category: "food",
			placeholderImageKey: "category-food",
			quantityTotal: 40,
			quantityRemaining: 31,
			quantityReserved: 2,
		},
		{
			title: "Wellness: Free yoga class voucher",
			description: "Partner studio next door.",
			rewardType: "FREE_ITEM",
			category: "wellness",
			placeholderImageKey: "category-wellness",
			quantityTotal: 25,
			quantityRemaining: 20,
			quantityReserved: 1,
		},
	];

	for (const [index, row] of extraKlRewards.entries()) {
		await prisma.reward.create({
			data: {
				organizationId: klOrganization.id,
				title: row.title,
				description: row.description,
				rewardType: row.rewardType,
				rewardValue: row.rewardValue ?? (row.rewardType === "DISCOUNT" ? 20 : 1),
				termsConditions: "Subject to store availability.",
				rewardKind: "CONSUMER",
				category: row.category,
				placeholderImageKey: row.placeholderImageKey,
				quantityTotal: row.quantityTotal,
				quantityRemaining: row.quantityRemaining,
				quantityReserved: row.quantityReserved,
				expiryDate: daysFromNow(40 + index),
				status: "PUBLISHED",
				referralsEnabled: false,
			},
		});
	}

	const extraMlkRewards = [
		{
			title: "Nyonya kuih sampler",
			description: "Three-piece kuih platter. Bukit Katil only.",
			category: "food",
			placeholderImageKey: "category-food",
			locationIds: [ORGANIZATION_SEED_IDS.mlkLocationKatil],
		},
		{
			title: "Friday night entertainment discount",
			description: "RM15 off live music dinner. Bukit Beruang only.",
			category: "entertainment",
			placeholderImageKey: "category-entertainment",
			locationIds: [ORGANIZATION_SEED_IDS.mlkLocationBeruang],
		},
	];

	for (const row of extraMlkRewards) {
		const reward = await prisma.reward.create({
			data: {
				organizationId: mlkOrganization.id,
				title: row.title,
				description: row.description,
				rewardType: "FREE_ITEM",
				rewardValue: 1,
				termsConditions: "While stocks last.",
				rewardKind: "CONSUMER",
				category: row.category,
				placeholderImageKey: row.placeholderImageKey,
				quantityTotal: 35,
				quantityRemaining: 28,
				quantityReserved: 2,
				expiryDate: daysFromNow(35),
				status: "PUBLISHED",
				referralsEnabled: false,
				locationScopeType: "SELECTED",
			},
		});
		await setRewardLocationScopes(reward.id, mlkOrganization.id, row.locationIds);
	}

	await prisma.rewardReferral.create({
		data: {
			id: REWARD_SEED_IDS.referralPending,
			referrerUserId: alice.id,
			refereeUserId: bob.id,
			rewardId: REWARD_SEED_IDS.klRewardPublished,
			attributionToken: "seed_ref_token_alice_bob_kl",
			status: "PENDING",
			refereeIp: "203.176.12.10",
		},
	});

	await prisma.rewardReferral.create({
		data: {
			id: REWARD_SEED_IDS.referralCredited,
			referrerUserId: carol.id,
			refereeUserId: user.id,
			rewardId: REWARD_SEED_IDS.mlkRewardPublished,
			attributionToken: "seed_ref_token_carol_user_mlk",
			status: "CREDITED",
			creditedAt: daysAgo(2),
			// The "reward credited" email was delivered when the credit happened.
			creditNotifiedAt: daysAgo(2),
			refereeIp: "203.176.12.20",
		},
	});

	const klCheckout = { organizationId: klOrganization.id, locationId: ORGANIZATION_SEED_IDS.klLocation, terminalId: "KL-REGISTER-01", apiKeyId: klKeyId };
	const seedClaims: SeedClaim[] = [
		{
			id: REWARD_SEED_IDS.claimPendingKl,
			userId: alice.id,
			rewardId: REWARD_SEED_IDS.klRewardPublished,
			referralId: REWARD_SEED_IDS.referralPending,
			qrToken: DEMO_QR_TOKEN_PENDING_KL,
			backupCode: DEMO_BACKUP_CODE_PENDING_KL,
			status: "PENDING",
			claimedAt: daysAgo(1),
			claimExpiresAt: Math.min(daysFromNow(7), daysFromNow(45)),
		},
		{
			id: REWARD_SEED_IDS.claimRedeemedKl,
			userId: bob.id,
			rewardId: REWARD_SEED_IDS.klRewardPublished,
			qrToken: "seed_qr_token_kl_redeemed_bob_001",
			backupCode: "WXYZ2345",
			status: "REDEEMED",
			claimedAt: daysAgo(5),
			claimExpiresAt: daysAgo(1),
			redeemedAt: daysAgo(4),
			checkout: { key: "kl-bob", ...klCheckout, billTotalMinor: SEED_BILL_KL_BOB_MINOR },
		},
		{
			id: REWARD_SEED_IDS.claimExpiredKl,
			userId: carol.id,
			rewardId: REWARD_SEED_IDS.klRewardPublished,
			qrToken: "seed_qr_token_kl_expired_carol_001",
			backupCode: "PQRS6789",
			status: "EXPIRED",
			claimedAt: daysAgo(10),
			claimExpiresAt: daysAgo(3),
		},
		{
			id: REWARD_SEED_IDS.claimPendingMlk,
			userId: user.id,
			rewardId: REWARD_SEED_IDS.mlkRewardPublished,
			referralId: REWARD_SEED_IDS.referralCredited,
			qrToken: "seed_qr_token_mlk_pending_user_001",
			backupCode: "TUVW2345",
			status: "PENDING",
			claimedAt: daysAgo(2),
			claimExpiresAt: daysFromNow(5),
		},
		{
			id: REWARD_SEED_IDS.claimRedeemedMlk,
			userId: carol.id,
			rewardId: REWARD_SEED_IDS.mlkRewardPublished,
			qrToken: "seed_qr_token_mlk_redeemed_carol_001",
			backupCode: "JKLM2345",
			status: "REDEEMED",
			claimedAt: daysAgo(6),
			claimExpiresAt: daysAgo(2),
			redeemedAt: daysAgo(3),
			checkout: {
				key: "mlk-carol",
				organizationId: mlkOrganization.id,
				locationId: ORGANIZATION_SEED_IDS.mlkLocationKatil,
				terminalId: "MLK-KATIL-01",
				apiKeyId: mlkKeyId,
				billTotalMinor: SEED_BILL_MLK_CAROL_MINOR,
			},
		},
		// Bulk claims for inventory stress demo — every REDEEMED claim has a matching paid bill + redemption.
		...consumerUsers.slice(0, 6).map((consumer, index): SeedClaim => {
			const isRedeemed = index % 3 === 0;
			return {
				userId: consumer.id,
				rewardId: REWARD_SEED_IDS.klRewardPublished,
				qrToken: `seed_qr_bulk_kl_${consumer.id}_${String(index)}`,
				backupCode: `seed_backup_bulk_${consumer.id}_${String(index)}`,
				status: isRedeemed ? "REDEEMED" : "PENDING",
				claimedAt: daysAgo(index + 1),
				claimExpiresAt: daysFromNow(6 - index),
				redeemedAt: isRedeemed ? daysAgo(index) : null,
				...(isRedeemed ? { checkout: { key: `kl-bulk-${String(index)}`, ...klCheckout, billTotalMinor: SEED_BULK_BILL_BASE_MINOR + index * SEED_BULK_BILL_STEP_MINOR } } : {}),
			};
		}),
		// Referrer credit claim for carol (R′)
		{
			userId: carol.id,
			rewardId: REWARD_SEED_IDS.mlkRewardReferrer,
			// The referral this credit was earned by (the app links every credit claim to its referral).
			referralId: REWARD_SEED_IDS.referralCredited,
			qrToken: "seed_qr_referrer_carol_mlk_001",
			backupCode: "EFGH2345",
			status: "PENDING",
			isReferrerCredit: true,
			claimedAt: daysAgo(2),
			claimExpiresAt: daysFromNow(28),
		},
	];
	for (const claim of seedClaims) {
		await seedClaim(claim);
	}

	await prisma.rewardLegalAcceptance.createMany({
		data: [
			{
				userId: alice.id,
				termsVersion: "2026-01-01",
				privacyVersion: "2026-01-01",
				acceptedAt: daysAgo(30),
			},
			{
				userId: bob.id,
				termsVersion: "2026-01-01",
				privacyVersion: "2026-01-01",
				acceptedAt: daysAgo(20),
			},
			{
				userId: user.id,
				termsVersion: "2026-01-01",
				privacyVersion: "2026-01-01",
				acceptedAt: daysAgo(5),
			},
		],
	});

	await prisma.user.update({
		where: { id: bob.id },
		data: {
			pendingAttributionToken: "seed_ref_token_alice_bob_kl",
			pendingAttributionExpiresAt: daysFromNow(7),
			phone: "+60198765432",
			phoneVerifiedAt: now,
		},
	});

	await prisma.rewardNotification.createMany({
		data: [
			{
				userId: carol.id,
				type: "referrer_reward_credited",
				title: "You earned a referrer reward!",
				body: "Your friend redeemed at Jonker Street Kitchen. Claim your 15% off reward.",
				metadata: { rewardId: REWARD_SEED_IDS.mlkRewardReferrer, claimExpiresDays: 30 },
				createdAt: daysAgo(2),
			},
			{
				userId: alice.id,
				type: "claim_confirmed",
				title: "Claim confirmed",
				body: "Your free coffee reward is ready. Show QR at Brew & Bean KL.",
				metadata: { claimId: REWARD_SEED_IDS.claimPendingKl },
				createdAt: daysAgo(1),
			},
			{
				userId: bob.id,
				type: "redemption_confirmed",
				title: "Reward redeemed",
				body: "Enjoy your coffee! Redeemed at Brew & Bean KL.",
				metadata: { claimId: REWARD_SEED_IDS.claimRedeemedKl },
				readAt: daysAgo(3),
				createdAt: daysAgo(4),
			},
		],
	});

	// Deterministic ids + skipDuplicates: audit rows are never deleted, so a re-run must not append copies.
	await prisma.rewardAuditLog.createMany({
		skipDuplicates: true,
		data: [
			{
				id: deterministicUuid("reward-seed-audit", "kl-cashier-scan-qr"),
				actorUserId: klCashier.id,
				organizationId: klOrganization.id,
				action: "merchant.scan_qr",
				metadata: { claimId: REWARD_SEED_IDS.claimPendingKl, terminalId: "KL-REGISTER-01" },
				createdAt: daysAgo(1),
			},
			{
				id: deterministicUuid("reward-seed-audit", "kl-redeem-reward"),
				actorUserId: null,
				organizationId: klOrganization.id,
				action: "merchant.redeem_reward",
				metadata: { claimId: REWARD_SEED_IDS.claimRedeemedKl, redemptionMethod: "SCAN" },
				createdAt: daysAgo(4),
			},
			{
				id: deterministicUuid("reward-seed-audit", "kl-owner-self-redeem"),
				actorUserId: klOwner.id,
				organizationId: klOrganization.id,
				action: "self_redeem_audit",
				metadata: { note: "Owner self-redeem allowed with audit flag" },
				createdAt: daysAgo(6),
			},
			{
				id: deterministicUuid("reward-seed-audit", "mlk-redeem-reward"),
				actorUserId: null,
				organizationId: mlkOrganization.id,
				action: "merchant.redeem_reward",
				metadata: { claimId: REWARD_SEED_IDS.claimRedeemedMlk, redemptionMethod: "SCAN" },
				createdAt: daysAgo(3),
			},
		],
	});

	await prisma.rewardOtpChallenge.create({
		data: {
			userId: alice.id,
			phone: "+60123456789",
			purpose: "CLAIM",
			rewardId: REWARD_SEED_IDS.klRewardPublished,
			codeHash: sha256Hex("123456"),
			expiresAt: daysFromNow(1),
			attempts: 1,
			failedAttempts: 0,
			consumedAt: daysAgo(1),
		},
	});

	await seedRewardLifecycleStates({
		klOrganizationId: klOrganization.id,
		mlkOrganizationId: mlkOrganization.id,
		adminUserId: adminUser.id,
		klOwnerId: klOwner.id,
		mlkOwnerId: mlkOwner.id,
		klCashierId: klCashier.id,
		alice,
		bob,
		carol,
		klKeyId,
		mlkKeyId,
		now,
	});

	const organizations = await prisma.organization.count({ where: { merchantProfile: { isNot: null } } });
	const rewards = await prisma.reward.count();
	const claims = await prisma.rewardClaim.count();
	const redemptions = await prisma.rewardRedemption.count();
	const referrals = await prisma.rewardReferral.count();
	const notifications = await prisma.rewardNotification.count();

	return {
		organizations,
		rewards,
		claims,
		redemptions,
		referrals,
		notifications,
	};
}

export function printRewardSeedCredentials(): void {
	seedLog(`
🎁 Rewards platform seed credentials
──────────────────────────────────────────────
Merchant owners
  brew.owner@kl-rewards.demo     / BrewOwner@123     (KL Brew & Bean)
  jonker.owner@melaka-rewards.demo / JonkerOwner@123 (Melaka Jonker Kitchen)

Cashiers
  brew.cashier@kl-rewards.demo   / BrewCashier@123
  jonker.cashier@melaka-rewards.demo / JonkerCashier@123

Pending team invite (sign in as invitee, then open accept URL)
  alice.kl@kl-rewards.demo       / AliceKl@123
  Token:  ${SEED_TEAM_INVITE_TOKEN_KL_ALICE}
  URL:    /team-invite?token=${SEED_TEAM_INVITE_TOKEN_KL_ALICE}

POS API keys (X-Terminal-Id: KL-REGISTER-01 or MLK-REGISTER-01)
  KL:   ${DEMO_MERCHANT_API_KEYS.kl}
  MLK:  ${DEMO_MERCHANT_API_KEYS.mlk}

Demo QR / backup (alice pending claim at Brew & Bean)
  Token:  ${DEMO_QR_TOKEN_PENDING_KL}
  Backup: ${DEMO_BACKUP_CODE_PENDING_KL}
`);
}

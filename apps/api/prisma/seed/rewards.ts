import type { RewardClaimStatus, RewardType, User } from "@prisma/client";
import * as bcrypt from "bcrypt";

import { POS_PAIRING_CODE_TTL_MS } from "@workspace/shared";

import { sha256Hex } from "../../src/platform/infrastructure/crypto/sha256";
import { API_KEY_PREFIX_LENGTH } from "../../src/contexts/pos/public-api";

import { cleanupTenantSeedData, TENANT_SEED_IDS, SEED_TENANT_IDS, SEED_TEAM_INVITE_TOKEN_KL_ALICE, seedTenantsAndMerchants } from "./tenants";
import { prisma } from "./client";
import { seedCodeHash } from "./reward-code-hashing";
import { deterministicUuid } from "./deterministic-uuid";
import { daysAgo, daysFromNow } from "./helpers";
import { seedCheckout, type SeedCheckoutInput } from "./reward-checkout";
import { linkRewardImages, seedReplacedRewardImage, seedRewardImageFiles, type RewardImageLink, type RewardImageSetSlug } from "./reward-images";
import { seedRewardLifecycleStates } from "./reward-lifecycle-states";
import { seedLog } from "./seed-log";
import { seedAttributionToken } from "./referral-tokens";

/** Fixed seed UUIDs for idempotent re-seeds. */
export const REWARD_SEED_IDS = Object.freeze({
	klOwnerUser: "019b76da-a800-763a-b64a-fd037629f93f",
	mlkOwnerUser: "019b76da-a800-727d-bf31-03f65b3b9058",
	klCashierUser: "019b76da-a800-7965-b8a4-624b6c755c16",
	klPendingCashierUser: "019b76da-a800-7d4a-a84b-1bc9ce68940d",
	mlkCashierUser: "019b76da-a800-700a-ab98-2c90f85d89d2",
	klRewardPublished: "019b76da-a800-7abc-a318-2ac9fe8ee4ca",
	klRewardReferrer: "019b76da-a800-7218-9eea-e588d2be6f57",
	klRewardPending: "019b76da-a800-7501-9cc9-ed58933e4620",
	klRewardDraft: "019b76da-a800-7c1a-9c16-496d40d882fc",
	klRewardExpired: "019b76da-a800-7cfe-8283-cc50e36361cc",
	mlkRewardPublished: "019b76da-a800-7e7f-be77-2319ca85798d",
	mlkRewardKatilOnly: deterministicUuid("reward-seed", "mlk-katil-only"),
	mlkRewardBeruangOnly: deterministicUuid("reward-seed", "mlk-beruang-only"),
	mlkRewardReferrer: "019b76da-a800-71dd-95b6-2370ec136267",
	mlkRewardDisabled: "019b76da-a800-7f17-a7a6-7084c29068ac",
	claimPendingKl: "019b76da-a800-7c1a-9069-f2e16d4af0a3",
	claimRedeemedKl: "019b76da-a800-7544-9869-4da94e4d5b08",
	claimExpiredKl: "019b76da-a800-7d3c-8405-3468d934d438",
	claimPendingMlk: "019b76da-a800-7ff4-a763-5719588ed25e",
	claimRedeemedMlk: "019b76da-a800-7564-983c-da0039b0f89e",
	referralPending: "019b76da-a800-7e6f-b6ef-53d08fa77988",
	referralCredited: "019b76da-a800-7b16-9352-6c879b8595f9",
});

/**
 * Plaintext merchant API keys for staging / simulator (seed only).
 * Suffix matches production format: `openssl rand -base64 128` (fixed here for idempotent seeds).
 */
export const DEMO_MERCHANT_API_KEYS = Object.freeze({
	kl: "mk_live_IwgbQID2Csq4nbnfwUxVUrQT8lwrlhEz7bzagwasKyFtZYSQ42LSH43lzTfRdBkV7tZArdHQQE4EW0wDHpVAroL57w/+5AzsCxRpax2fmu3JqITATsJKJRi4+fifNVj1E3WswonhsleEBinxwcMOlqccH0suhUq6mJWVvaWYkf8=",
	mlk: "mk_live_Dx20Nsn5K79wGXWaTYbEvUyVLQrXWIwExA7zsK4jGyMMKxVPxsmJHoIrGimviO7RBtbb5ZdLsEcT0vxGeBVhV7NP72FoIRxFcF17juhUiMxrHxfAMuIy5NuYIK/eMqDdpWY5KNYxMGNCy/iT20Kc7813y2bMoOjZTCJJ/84JMQY=",
	/** Tenant-wide INTEGRATION key (back-office sync): not bound to a store or terminal, not usable on /redemptions/*. */
	klIntegration: "mk_live_seedKlBackOfficeIntegrationKey7Hq2Vt9Xc4Lm8Np3Rs6Wz5Yb2Dg7Jk4Fh9Qa3Ue6Ti8Oy1Pw5",
});

/** Plaintext QR token for pending KL claim (hash stored in DB). */
/** Extra published marketplace rewards seeded for Brew & Bean KL. */
interface ExtraKlRewardSeed {
	readonly title: string;
	readonly description: string;
	readonly rewardType: RewardType;
	readonly rewardValue: number;
	readonly category: string;
	readonly imageSet: RewardImageSetSlug;
	readonly quantityTotal: number;
	readonly quantityRemaining: number;
	readonly quantityReserved: number;
}

/** Extra published, store-limited rewards seeded for Jonker Street Kitchen. */
interface ExtraMlkRewardSeed {
	readonly title: string;
	readonly rewardType: RewardType;
	readonly rewardValue: number;
	readonly description: string;
	readonly category: string;
	readonly imageSet: RewardImageSetSlug;
	readonly locationIds: readonly string[];
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

async function setRewardLocationScopes(rewardId: string, tenantId: string, locationIds: readonly string[]): Promise<void> {
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
			tenantId,
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
 * (`RewardAuditLog`, `TenantAuditLog`) are never deleted: the seed
 * writes its own audit rows with deterministic ids instead.
 */
export async function cleanupRewardSeedData(): Promise<void> {
	const tenantId = { in: [...SEED_TENANT_IDS] };
	const seedConsumers = await prisma.user.findMany({ where: { email: { in: [...SEED_CONSUMER_EMAILS] } }, select: { id: true } });
	const userId = { in: seedConsumers.map((consumer) => consumer.id) };

	await prisma.rewardNotification.deleteMany({ where: { userId } });
	await prisma.rewardLegalAcceptance.deleteMany({ where: { userId } });
	await prisma.rewardOtpChallenge.deleteMany({ where: { userId } });
	await prisma.rewardRedemption.deleteMany({ where: { tenantId } });
	// After redemptions: they reference their sale (ON DELETE RESTRICT).
	await prisma.rewardSale.deleteMany({ where: { tenantId } });
	await prisma.rewardClaim.deleteMany({ where: { reward: { tenantId } } });
	await prisma.rewardReferral.deleteMany({ where: { reward: { tenantId } } });
	await prisma.rewardLocationScope.deleteMany({ where: { tenantId } });
	// Referrer clones point at their parent; unlink before deleting either side.
	await prisma.reward.updateMany({ where: { tenantId }, data: { referrerRewardId: null, parentConsumerRewardId: null } });
	await prisma.reward.deleteMany({ where: { tenantId } });
	await prisma.tenantTerminal.deleteMany({ where: { tenantId } });
	await prisma.tenantApiKey.deleteMany({ where: { tenantId } });
	await cleanupTenantSeedData();
}

export interface RewardSeedSummary {
	tenants: number;
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

	const { klTenant, mlkTenant } = await seedTenantsAndMerchants(adminUser, klOwner, mlkOwner, klCashier, mlkCashier, user, klPendingCashier);

	// Every reward shows images, so the photos are uploaded (and rendered) before any reward is linked to them.
	const imageCount = await seedRewardImageFiles({
		klTenantId: klTenant.id,
		klOwnerUserId: klOwner.id,
		mlkTenantId: mlkTenant.id,
		mlkOwnerUserId: mlkOwner.id,
	});
	seedLog(`Reward images: ${String(imageCount)} published with their renditions`);
	/** Which photo set each reward shows — linked once every reward exists. */
	const imageLinks: RewardImageLink[] = [
		{ rewardId: REWARD_SEED_IDS.klRewardPublished, tenantId: klTenant.id, slug: "free-coffee" },
		{ rewardId: REWARD_SEED_IDS.mlkRewardPublished, tenantId: mlkTenant.id, slug: "jonker-lunch-set" },
		{ rewardId: REWARD_SEED_IDS.mlkRewardKatilOnly, tenantId: mlkTenant.id, slug: "iced-tea" },
		{ rewardId: REWARD_SEED_IDS.mlkRewardBeruangOnly, tenantId: mlkTenant.id, slug: "weekend-dinner" },
		{ rewardId: REWARD_SEED_IDS.klRewardReferrer, tenantId: klTenant.id, slug: "free-pastry" },
		{ rewardId: REWARD_SEED_IDS.mlkRewardReferrer, tenantId: mlkTenant.id, slug: "next-meal" },
		{ rewardId: REWARD_SEED_IDS.klRewardPending, tenantId: klTenant.id, slug: "weekend-brunch" },
		{ rewardId: REWARD_SEED_IDS.klRewardDraft, tenantId: klTenant.id, slug: "matcha-latte" },
		{ rewardId: REWARD_SEED_IDS.klRewardExpired, tenantId: klTenant.id, slug: "merdeka-coffee" },
		{ rewardId: REWARD_SEED_IDS.mlkRewardDisabled, tenantId: mlkTenant.id, slug: "cendol" },
	];

	const klKeyId = deterministicUuid("reward-seed-api-key", "kl-pos-simulator");
	const mlkKeyId = deterministicUuid("reward-seed-api-key", "mlk-katil-pos");
	const klIntegrationKeyId = deterministicUuid("reward-seed-api-key", "kl-integration");

	// The two simulator keys only call /redemptions/* — POS scope. The Melaka key carries a few
	// recent unknown backup codes (below the lockout limit) so the lockout columns hold real data.
	await prisma.tenantApiKey.createMany({
		data: [
			{
				id: klKeyId,
				tenantId: klTenant.id,
				locationId: TENANT_SEED_IDS.klLocation,
				name: "KL POS Simulator",
				keyHash: sha256Hex(DEMO_MERCHANT_API_KEYS.kl),
				keyPrefix: DEMO_MERCHANT_API_KEYS.kl.slice(0, API_KEY_PREFIX_LENGTH),
				scope: "POS",
				createdByUserId: klOwner.id,
			},
			{
				id: mlkKeyId,
				tenantId: mlkTenant.id,
				locationId: TENANT_SEED_IDS.mlkLocationKatil,
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
				tenantId: klTenant.id,
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
	await prisma.tenantTerminal.createMany({
		data: [
			{
				tenantId: klTenant.id,
				locationId: TENANT_SEED_IDS.klLocation,
				terminalId: "KL-REGISTER-01",
				label: "Front counter",
				createdByUserId: klOwner.id,
			},
			{
				tenantId: klTenant.id,
				locationId: TENANT_SEED_IDS.klLocation,
				terminalId: "KL-REGISTER-02",
				label: "Drive-through",
				createdByUserId: klOwner.id,
				pairingCodeHash: seedCodeHash(DEMO_PAIRING_CODE_KL_REGISTER_02),
				pairingCodeExpiresAt: now + POS_PAIRING_CODE_TTL_MS,
				pairingCodeIssuedByUserId: klCashier.id,
				pairingCodeIssuedAt: now,
			},
			{
				tenantId: mlkTenant.id,
				locationId: TENANT_SEED_IDS.mlkLocationKatil,
				terminalId: "MLK-KATIL-01",
				label: "Bukit Katil counter",
				createdByUserId: mlkOwner.id,
			},
			{
				tenantId: mlkTenant.id,
				locationId: TENANT_SEED_IDS.mlkLocationBeruang,
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
				tenantId: klTenant.id,
				title: "Free coffee — Grand Opening",
				description: "One free regular coffee. Show QR at counter. Valid 7 days after claim.",
				rewardType: "FREE_ITEM",
				rewardValue: 1,
				termsConditions: "One per customer. Valid weekdays only.",
				rewardKind: "CONSUMER",
				category: "cafe",
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
				tenantId: mlkTenant.id,
				title: "10% off the Jonker lunch set",
				description: "Weekday lunch 11am–3pm. Min spend RM35. Available at both Bukit Katil and Bukit Beruang.",
				rewardType: "DISCOUNT",
				rewardValue: 10,
				termsConditions: "Minimum spend RM35. Weekdays 11am–3pm only.",
				rewardKind: "CONSUMER",
				category: "restaurant",
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
				tenantId: mlkTenant.id,
				title: "Free iced tea — Bukit Katil opening",
				description: "Complimentary iced tea with any main course at Bukit Katil only.",
				rewardType: "FREE_ITEM",
				rewardValue: 1,
				termsConditions: "Bukit Katil store only. One per customer per day.",
				rewardKind: "CONSUMER",
				category: "beverage",
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
				tenantId: mlkTenant.id,
				title: "15% off weekend dinner — Bukit Beruang",
				description: "Friday and Saturday dinner from 6pm. Bukit Beruang store only.",
				rewardType: "DISCOUNT",
				rewardValue: 15,
				termsConditions: "Bukit Beruang store only. Fri–Sat 6pm–10pm.",
				rewardKind: "CONSUMER",
				category: "restaurant",
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

	await setRewardLocationScopes(REWARD_SEED_IDS.mlkRewardPublished, mlkTenant.id, [TENANT_SEED_IDS.mlkLocationKatil, TENANT_SEED_IDS.mlkLocationBeruang]);
	await setRewardLocationScopes(REWARD_SEED_IDS.mlkRewardKatilOnly, mlkTenant.id, [TENANT_SEED_IDS.mlkLocationKatil]);
	await setRewardLocationScopes(REWARD_SEED_IDS.mlkRewardBeruangOnly, mlkTenant.id, [TENANT_SEED_IDS.mlkLocationBeruang]);

	const klReferrerReward = await prisma.reward.create({
		data: {
			id: REWARD_SEED_IDS.klRewardReferrer,
			tenantId: klTenant.id,
			title: "Referrer: Free pastry (Brew & Bean)",
			description: "A free pastry of your choice, earned when a friend redeems their free coffee.",
			rewardType: "FREE_ITEM",
			rewardValue: 1,
			rewardKind: "REFERRER",
			category: "cafe",
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
			tenantId: mlkTenant.id,
			title: "Referrer: 15% off next meal",
			description: "15% off your next meal, earned when a friend redeems the Jonker lunch set offer.",
			rewardType: "DISCOUNT",
			rewardValue: 15,
			rewardKind: "REFERRER",
			category: "restaurant",
			// Carol's one PENDING credit claim (below) holds a unit, as the app's credit does: it is
			// reserved, not yet redeemed, so an expiry can return it.
			quantityTotal: 30,
			quantityRemaining: 29,
			quantityReserved: 1,
			claimCount: 1,
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

	await setRewardLocationScopes(mlkReferrerReward.id, mlkTenant.id, [TENANT_SEED_IDS.mlkLocationKatil, TENANT_SEED_IDS.mlkLocationBeruang]);

	await prisma.reward.createMany({
		data: [
			{
				id: REWARD_SEED_IDS.klRewardPending,
				tenantId: klTenant.id,
				title: "20% off weekend brunch",
				description: "20% off any brunch plate on Saturdays and Sundays, 9am–1pm.",
				rewardType: "DISCOUNT",
				rewardValue: 20,
				rewardKind: "CONSUMER",
				category: "cafe",
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
				tenantId: klTenant.id,
				title: "Draft: Matcha latte trial",
				description: "A free iced or hot matcha latte while we trial our new matcha.",
				rewardType: "FREE_ITEM",
				rewardValue: 1,
				rewardKind: "CONSUMER",
				category: "beverage",
				quantityTotal: 40,
				quantityRemaining: 40,
				quantityReserved: 0,
				expiryDate: daysFromNow(20),
				status: "DRAFT",
				referralsEnabled: false,
			},
			{
				id: REWARD_SEED_IDS.klRewardExpired,
				tenantId: klTenant.id,
				title: "Expired: Merdeka promo",
				description: "31% off any kopi to celebrate Merdeka Day.",
				rewardType: "DISCOUNT",
				rewardValue: 31,
				rewardKind: "CONSUMER",
				category: "cafe",
				quantityTotal: 100,
				quantityRemaining: 12,
				quantityReserved: 0,
				expiryDate: daysAgo(3),
				status: "EXPIRED",
				referralsEnabled: false,
			},
			{
				id: REWARD_SEED_IDS.mlkRewardDisabled,
				tenantId: mlkTenant.id,
				title: "Disabled: Cendol giveaway",
				description: "A free bowl of cendol with gula Melaka with any main course.",
				rewardType: "FREE_ITEM",
				rewardValue: 1,
				rewardKind: "CONSUMER",
				category: "food",
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
			description: "RM5 back on any dine-in bill over RM30, credited on your next visit.",
			rewardType: "CASHBACK",
			rewardValue: 5,
			category: "restaurant",
			imageSet: "dine-in-cashback",
			quantityTotal: 75,
			quantityRemaining: 60,
			quantityReserved: 2,
		},
		{
			title: "200 bonus points this weekend",
			description: "Earn 200 bonus loyalty points on any purchase this weekend.",
			rewardType: "POINTS",
			rewardValue: 200,
			category: "retail",
			imageSet: "loyalty-points-retail",
			quantityTotal: 100,
			quantityRemaining: 88,
			quantityReserved: 1,
		},
		{
			title: "Buy one, get one signature noodles",
			description: "Buy one bowl of our signature curry laksa and get a second one free.",
			rewardType: "BOGO",
			rewardValue: 1,
			category: "food",
			imageSet: "signature-noodles",
			quantityTotal: 50,
			quantityRemaining: 41,
			quantityReserved: 1,
		},
		{
			title: "Second coffee 50% off",
			description: "50% off your second coffee, 2–5pm on weekdays.",
			rewardType: "DISCOUNT",
			rewardValue: 50,
			category: "cafe",
			imageSet: "second-coffee",
			quantityTotal: 60,
			quantityRemaining: 44,
			quantityReserved: 3,
		},
		{
			title: "Free croissant with any drink",
			description: "A free butter croissant with any hot or iced drink before 11am.",
			rewardType: "FREE_ITEM",
			rewardValue: 1,
			category: "food",
			imageSet: "croissant",
			quantityTotal: 40,
			quantityRemaining: 31,
			quantityReserved: 2,
		},
		{
			title: "Wellness: Free yoga class voucher",
			description: "One free drop-in class at our partner yoga studio next door.",
			rewardType: "FREE_ITEM",
			rewardValue: 1,
			category: "wellness",
			imageSet: "yoga-class",
			quantityTotal: 25,
			quantityRemaining: 20,
			quantityReserved: 1,
		},
	];

	for (const [index, row] of extraKlRewards.entries()) {
		const created = await prisma.reward.create({
			data: {
				tenantId: klTenant.id,
				title: row.title,
				description: row.description,
				rewardType: row.rewardType,
				rewardValue: row.rewardValue,
				termsConditions: "Subject to store availability.",
				rewardKind: "CONSUMER",
				category: row.category,
				quantityTotal: row.quantityTotal,
				quantityRemaining: row.quantityRemaining,
				quantityReserved: row.quantityReserved,
				expiryDate: daysFromNow(40 + index),
				status: "PUBLISHED",
				referralsEnabled: false,
			},
		});
		imageLinks.push({ rewardId: created.id, tenantId: klTenant.id, slug: row.imageSet });
	}

	const extraMlkRewards: readonly ExtraMlkRewardSeed[] = [
		{
			title: "Nyonya kuih sampler",
			rewardType: "FREE_ITEM",
			rewardValue: 1,
			description: "Three-piece kuih platter. Bukit Katil only.",
			category: "food",
			imageSet: "nyonya-kuih",
			locationIds: [TENANT_SEED_IDS.mlkLocationKatil],
		},
		{
			title: "15% off Friday live-music dinner",
			rewardType: "DISCOUNT",
			rewardValue: 15,
			description: "15% off your dinner bill on live-music Friday nights. Bukit Beruang only.",
			category: "entertainment",
			imageSet: "live-music-night",
			locationIds: [TENANT_SEED_IDS.mlkLocationBeruang],
		},
	];

	for (const row of extraMlkRewards) {
		const reward = await prisma.reward.create({
			data: {
				tenantId: mlkTenant.id,
				title: row.title,
				description: row.description,
				rewardType: row.rewardType,
				rewardValue: row.rewardValue,
				termsConditions: "While stocks last.",
				rewardKind: "CONSUMER",
				category: row.category,
				quantityTotal: 35,
				quantityRemaining: 28,
				quantityReserved: 2,
				expiryDate: daysFromNow(35),
				status: "PUBLISHED",
				referralsEnabled: false,
				locationScopeType: "SELECTED",
			},
		});
		imageLinks.push({ rewardId: reward.id, tenantId: mlkTenant.id, slug: row.imageSet });
		await setRewardLocationScopes(reward.id, mlkTenant.id, row.locationIds);
	}

	await prisma.rewardReferral.create({
		data: {
			id: REWARD_SEED_IDS.referralPending,
			referrerUserId: alice.id,
			refereeUserId: bob.id,
			rewardId: REWARD_SEED_IDS.klRewardPublished,
			attributionToken: seedAttributionToken("alice_bob_kl"),
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
			attributionToken: seedAttributionToken("carol_user_mlk"),
			status: "CREDITED",
			creditedAt: daysAgo(2),
			// The "reward credited" email was delivered when the credit happened.
			creditNotifiedAt: daysAgo(2),
			refereeIp: "203.176.12.20",
		},
	});

	const klCheckout = { tenantId: klTenant.id, locationId: TENANT_SEED_IDS.klLocation, terminalId: "KL-REGISTER-01", apiKeyId: klKeyId };
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
				tenantId: mlkTenant.id,
				locationId: TENANT_SEED_IDS.mlkLocationKatil,
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
			pendingAttributionToken: seedAttributionToken("alice_bob_kl"),
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
				tenantId: klTenant.id,
				action: "merchant.scan_qr",
				metadata: { claimId: REWARD_SEED_IDS.claimPendingKl, terminalId: "KL-REGISTER-01" },
				createdAt: daysAgo(1),
			},
			{
				id: deterministicUuid("reward-seed-audit", "kl-redeem-reward"),
				actorUserId: null,
				tenantId: klTenant.id,
				action: "merchant.redeem_reward",
				metadata: { claimId: REWARD_SEED_IDS.claimRedeemedKl, redemptionMethod: "SCAN" },
				createdAt: daysAgo(4),
			},
			{
				id: deterministicUuid("reward-seed-audit", "kl-owner-self-redeem"),
				actorUserId: klOwner.id,
				tenantId: klTenant.id,
				action: "self_redeem_audit",
				metadata: { note: "Owner self-redeem allowed with audit flag" },
				createdAt: daysAgo(6),
			},
			{
				id: deterministicUuid("reward-seed-audit", "mlk-redeem-reward"),
				actorUserId: null,
				tenantId: mlkTenant.id,
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

	await linkRewardImages(imageLinks);
	// The grand-opening coffee first showed a latte-art photo; the owner swapped in the current cover a week before launch.
	await seedReplacedRewardImage({
		rewardId: REWARD_SEED_IDS.klRewardPublished,
		tenantId: klTenant.id,
		slug: "free-coffee",
		previousSlug: "second-coffee",
		replacedBy: klOwner.id,
		replacedAt: BigInt(daysAgo(7)),
	});

	await seedRewardLifecycleStates({
		klTenantId: klTenant.id,
		mlkTenantId: mlkTenant.id,
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

	const tenants = await prisma.tenant.count({ where: { merchantProfile: { isNot: null } } });
	const rewards = await prisma.reward.count();
	const claims = await prisma.rewardClaim.count();
	const redemptions = await prisma.rewardRedemption.count();
	const referrals = await prisma.rewardReferral.count();
	const notifications = await prisma.rewardNotification.count();

	return {
		tenants,
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

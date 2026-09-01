import { createHash } from "node:crypto";

import type { User } from "@prisma/client";
import * as bcrypt from "bcrypt";

import { prisma } from "./client";

/** Deterministic UUIDs for idempotent re-seeds and docs. */
export const REWARD_SEED_IDS = {
	klOrg: "10000000-0000-4000-8000-000000000001",
	mlkOrg: "10000000-0000-4000-8000-000000000002",
	klOwnerUser: "10000000-0000-4000-8000-000000000010",
	mlkOwnerUser: "10000000-0000-4000-8000-000000000011",
	klCashierUser: "10000000-0000-4000-8000-000000000012",
	mlkCashierUser: "10000000-0000-4000-8000-000000000013",
	klRewardPublished: "20000000-0000-4000-8000-000000000001",
	klRewardReferrer: "20000000-0000-4000-8000-000000000002",
	klRewardPending: "20000000-0000-4000-8000-000000000003",
	klRewardDraft: "20000000-0000-4000-8000-000000000004",
	klRewardExpired: "20000000-0000-4000-8000-000000000005",
	mlkRewardPublished: "20000000-0000-4000-8000-000000000006",
	mlkRewardReferrer: "20000000-0000-4000-8000-000000000007",
	mlkRewardDisabled: "20000000-0000-4000-8000-000000000008",
	claimPendingKl: "30000000-0000-4000-8000-000000000001",
	claimRedeemedKl: "30000000-0000-4000-8000-000000000002",
	claimExpiredKl: "30000000-0000-4000-8000-000000000003",
	claimPendingMlk: "30000000-0000-4000-8000-000000000004",
	referralPending: "40000000-0000-4000-8000-000000000001",
	referralCredited: "40000000-0000-4000-8000-000000000002",
} as const;

/** Plaintext POS API keys for staging / simulator (seed only). */
export const DEMO_MERCHANT_API_KEYS = {
	kl: "mk_live_demo_kl_brew_terminal",
	mlk: "mk_live_demo_mlk_jonker_terminal",
} as const;

/** Plaintext QR token for pending KL claim (hash stored in DB). */
export const DEMO_QR_TOKEN_PENDING_KL = "seed_qr_token_kl_pending_alice_001";

/** Plaintext backup code for pending KL claim. */
export const DEMO_BACKUP_CODE_PENDING_KL = "ABCD2345";

function sha256Hex(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

function msFromNow(days: number): number {
	return Date.now() + days * 24 * 60 * 60 * 1000;
}

function msDaysAgo(days: number): number {
	return Date.now() - days * 24 * 60 * 60 * 1000;
}

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

export async function cleanupRewardSeedData(): Promise<void> {
	await prisma.rewardRedemptionIdempotencyRecord.deleteMany();
	await prisma.rewardAuditLog.deleteMany();
	await prisma.rewardNotification.deleteMany();
	await prisma.rewardLegalAcceptance.deleteMany();
	await prisma.rewardOtpChallenge.deleteMany();
	await prisma.rewardRedemption.deleteMany();
	await prisma.rewardClaim.deleteMany();
	await prisma.rewardReferral.deleteMany();
	await prisma.reward.deleteMany();
	await prisma.merchantInvite.deleteMany();
	await prisma.merchantApiKey.deleteMany();
	await prisma.merchantTerminal.deleteMany();
	await prisma.merchantMember.deleteMany();
	await prisma.merchantOrg.deleteMany();
}

export interface RewardSeedSummary {
	merchantOrgs: number;
	rewards: number;
	claims: number;
	redemptions: number;
	referrals: number;
	notifications: number;
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
	const mlkCashier = await upsertMerchantUser(REWARD_SEED_IDS.mlkCashierUser, "jonker.cashier@melaka-rewards.demo", "Mira Cashier", "JonkerCashier@123", null, null);

	const klOrg = await prisma.merchantOrg.create({
		data: {
			id: REWARD_SEED_IDS.klOrg,
			businessName: "Brew & Bean KL",
			legalName: "Brew & Bean KL Sdn Bhd",
			category: "cafe",
			addressText: "12 Jalan Bukit Bintang, Kuala Lumpur",
			city: "KUALA_LUMPUR",
			kybStatus: "APPROVED",
			kybFields: {
				registrationNo: "201901012345",
				taxId: "C12345678",
			},
			status: "ACTIVE",
			contactEmail: klOwner.email,
			contactPhone: "+60321456789",
		},
	});

	const mlkOrg = await prisma.merchantOrg.create({
		data: {
			id: REWARD_SEED_IDS.mlkOrg,
			businessName: "Jonker Street Kitchen",
			legalName: "Jonker Kitchen Melaka",
			category: "restaurant",
			addressText: "45 Jonker Walk, Melaka",
			city: "MELAKA",
			kybStatus: "PENDING",
			kybFields: {
				registrationNo: "202002023456",
			},
			status: "ACTIVE",
			contactEmail: mlkOwner.email,
			contactPhone: "+6062821234",
		},
	});

	await prisma.merchantMember.createMany({
		data: [
			{ userId: klOwner.id, merchantOrgId: klOrg.id, role: "OWNER" },
			{ userId: klCashier.id, merchantOrgId: klOrg.id, role: "CASHIER" },
			{ userId: mlkOwner.id, merchantOrgId: mlkOrg.id, role: "OWNER" },
			{ userId: mlkCashier.id, merchantOrgId: mlkOrg.id, role: "CASHIER" },
		],
	});

	await prisma.merchantTerminal.createMany({
		data: [
			{ merchantOrgId: klOrg.id, terminalId: "KL-REGISTER-01", label: "Front counter" },
			{ merchantOrgId: klOrg.id, terminalId: "KL-REGISTER-02", label: "Drive-through" },
			{ merchantOrgId: mlkOrg.id, terminalId: "MLK-REGISTER-01", label: "Main floor" },
		],
	});

	const klKeyHash = sha256Hex(DEMO_MERCHANT_API_KEYS.kl);
	const mlkKeyHash = sha256Hex(DEMO_MERCHANT_API_KEYS.mlk);

	await prisma.merchantApiKey.createMany({
		data: [
			{
				merchantOrgId: klOrg.id,
				name: "KL POS Simulator",
				keyHash: klKeyHash,
				keyPrefix: DEMO_MERCHANT_API_KEYS.kl.slice(0, 16),
				createdByUserId: klOwner.id,
			},
			{
				merchantOrgId: mlkOrg.id,
				name: "Melaka POS Simulator",
				keyHash: mlkKeyHash,
				keyPrefix: DEMO_MERCHANT_API_KEYS.mlk.slice(0, 16),
				createdByUserId: mlkOwner.id,
			},
		],
	});

	await prisma.merchantInvite.create({
		data: {
			email: "pending.invite@melaka-rewards.demo",
			tokenHash: sha256Hex("seed_invite_token_mlk_pending"),
			businessName: "Pending Nyonya Café",
			city: "MELAKA",
			createdByAdminId: adminUser.id,
			expiresAt: msFromNow(7),
		},
	});

	// Consumer rewards first (referrer FK added after R′ rows exist)
	await prisma.reward.createMany({
		data: [
			{
				id: REWARD_SEED_IDS.klRewardPublished,
				merchantOrgId: klOrg.id,
				title: "Free coffee — Grand Opening",
				description: "One free regular coffee. Show QR at counter. Valid 7 days after claim.",
				rewardType: "FREE_ITEM",
				rewardValue: 1,
				termsConditions: "One per customer. Valid weekdays only.",
				rewardKind: "CONSUMER",
				category: "cafe",
				placeholderImageKey: "category-cafe",
				rules: { minSpendMyr: 0 },
				quantityTotal: 200,
				quantityRemaining: 142,
				quantityReserved: 8,
				startDate: msDaysAgo(14),
				expiryDate: msFromNow(45),
				status: "PUBLISHED",
				claimCount: 58,
				redemptionCount: 42,
				referralsEnabled: true,
				referralPoolTotal: 50,
				referralPoolRemaining: 48,
			},
			{
				id: REWARD_SEED_IDS.mlkRewardPublished,
				merchantOrgId: mlkOrg.id,
				title: "RM10 off Jonker lunch set",
				description: "Weekday lunch 11am–3pm. Min spend RM35.",
				rewardType: "DISCOUNT",
				rewardValue: 10,
				termsConditions: "Minimum spend RM35. Weekdays 11am–3pm only.",
				rewardKind: "CONSUMER",
				category: "restaurant",
				placeholderImageKey: "category-restaurant",
				rules: { minSpendMyr: 35 },
				quantityTotal: 120,
				quantityRemaining: 95,
				quantityReserved: 5,
				startDate: msDaysAgo(7),
				expiryDate: msFromNow(50),
				status: "PUBLISHED",
				claimCount: 28,
				redemptionCount: 18,
				referralsEnabled: true,
				referralPoolTotal: 30,
				referralPoolRemaining: 28,
			},
		],
	});

	const klReferrerReward = await prisma.reward.create({
		data: {
			id: REWARD_SEED_IDS.klRewardReferrer,
			merchantOrgId: klOrg.id,
			title: "Referrer: Free pastry (Brew & Bean)",
			description: "Auto-cloned referrer reward when friends redeem the free coffee campaign.",
			rewardType: "FREE_ITEM",
			rewardKind: "REFERRER",
			category: "cafe",
			placeholderImageKey: "category-cafe",
			quantityTotal: 50,
			quantityRemaining: 48,
			quantityReserved: 1,
			expiryDate: msFromNow(90),
			status: "PUBLISHED",
			referralsEnabled: false,
			parentConsumerRewardId: REWARD_SEED_IDS.klRewardPublished,
		},
	});

	const mlkReferrerReward = await prisma.reward.create({
		data: {
			id: REWARD_SEED_IDS.mlkRewardReferrer,
			merchantOrgId: mlkOrg.id,
			title: "Referrer: 15% off next meal",
			description: "Referrer bonus for Jonker lunch campaign.",
			rewardType: "DISCOUNT",
			rewardKind: "REFERRER",
			category: "restaurant",
			placeholderImageKey: "category-restaurant",
			quantityTotal: 30,
			quantityRemaining: 29,
			quantityReserved: 0,
			expiryDate: msFromNow(60),
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

	await prisma.reward.createMany({
		data: [
			{
				id: REWARD_SEED_IDS.klRewardPending,
				merchantOrgId: klOrg.id,
				title: "20% off weekend brunch",
				description: "Awaiting admin moderation or auto-publish.",
				rewardType: "DISCOUNT",
				rewardKind: "CONSUMER",
				category: "cafe",
				placeholderImageKey: "category-cafe",
				quantityTotal: 80,
				quantityRemaining: 80,
				quantityReserved: 0,
				expiryDate: msFromNow(30),
				status: "PENDING_REVIEW",
				submittedForReviewAt: msDaysAgo(1),
				autoPublishAt: msFromNow(1),
				referralsEnabled: false,
			},
			{
				id: REWARD_SEED_IDS.klRewardDraft,
				merchantOrgId: klOrg.id,
				title: "Draft: Matcha latte trial",
				description: "Not submitted for review yet.",
				rewardType: "FREE_ITEM",
				rewardKind: "CONSUMER",
				category: "beverage",
				placeholderImageKey: "category-beverage",
				quantityTotal: 40,
				quantityRemaining: 40,
				quantityReserved: 0,
				expiryDate: msFromNow(20),
				status: "DRAFT",
				referralsEnabled: false,
			},
			{
				id: REWARD_SEED_IDS.klRewardExpired,
				merchantOrgId: klOrg.id,
				title: "Expired: Merdeka promo",
				description: "Past campaign for expiry job testing.",
				rewardType: "DISCOUNT",
				rewardKind: "CONSUMER",
				category: "cafe",
				placeholderImageKey: "category-cafe",
				quantityTotal: 100,
				quantityRemaining: 12,
				quantityReserved: 0,
				expiryDate: msDaysAgo(3),
				status: "EXPIRED",
				referralsEnabled: false,
			},
			{
				id: REWARD_SEED_IDS.mlkRewardDisabled,
				merchantOrgId: mlkOrg.id,
				title: "Disabled: Cendol giveaway",
				description: "Merchant disabled after stock issue.",
				rewardType: "FREE_ITEM",
				rewardKind: "CONSUMER",
				category: "food",
				placeholderImageKey: "category-food",
				quantityTotal: 50,
				quantityRemaining: 0,
				quantityReserved: 0,
				expiryDate: msFromNow(10),
				status: "DISABLED",
				referralsEnabled: false,
			},
		],
	});

	// Extra published rewards for marketplace volume
	const extraKlRewards = [
		{
			title: "RM5 cashback on dine-in",
			description: "Credited on your next visit.",
			rewardType: "CASHBACK" as const,
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
			rewardType: "POINTS" as const,
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
			rewardType: "BOGO" as const,
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
			rewardType: "DISCOUNT" as const,
			category: "cafe",
			placeholderImageKey: "category-cafe",
			quantityTotal: 60,
			quantityRemaining: 44,
			quantityReserved: 3,
		},
		{
			title: "Free croissant with any drink",
			description: "Breakfast bundle.",
			rewardType: "FREE_ITEM" as const,
			category: "food",
			placeholderImageKey: "category-food",
			quantityTotal: 40,
			quantityRemaining: 31,
			quantityReserved: 2,
		},
		{
			title: "Wellness: Free yoga class voucher",
			description: "Partner studio next door.",
			rewardType: "FREE_ITEM" as const,
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
				merchantOrgId: klOrg.id,
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
				expiryDate: msFromNow(40 + index),
				status: "PUBLISHED",
				referralsEnabled: false,
			},
		});
	}

	const extraMlkRewards = [
		{
			title: "Nyonya kuih sampler",
			description: "Three-piece kuih platter.",
			category: "food",
			placeholderImageKey: "category-food",
		},
		{
			title: "Friday night entertainment discount",
			description: "RM15 off live music dinner.",
			category: "entertainment",
			placeholderImageKey: "category-entertainment",
		},
	];

	for (const row of extraMlkRewards) {
		await prisma.reward.create({
			data: {
				merchantOrgId: mlkOrg.id,
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
				expiryDate: msFromNow(35),
				status: "PUBLISHED",
				referralsEnabled: false,
			},
		});
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
			creditedAt: msDaysAgo(2),
			refereeIp: "203.176.12.20",
		},
	});

	const claimExpiresKl = Math.min(msFromNow(7), msFromNow(45));

	await prisma.rewardClaim.create({
		data: {
			id: REWARD_SEED_IDS.claimPendingKl,
			userId: alice.id,
			rewardId: REWARD_SEED_IDS.klRewardPublished,
			referralId: REWARD_SEED_IDS.referralPending,
			redemptionTokenHash: sha256Hex(DEMO_QR_TOKEN_PENDING_KL),
			backupCodeHash: sha256Hex(DEMO_BACKUP_CODE_PENDING_KL),
			status: "PENDING",
			claimedAt: msDaysAgo(1),
			claimExpiresAt: claimExpiresKl,
		},
	});

	await prisma.rewardClaim.create({
		data: {
			id: REWARD_SEED_IDS.claimRedeemedKl,
			userId: bob.id,
			rewardId: REWARD_SEED_IDS.klRewardPublished,
			redemptionTokenHash: sha256Hex("seed_qr_token_kl_redeemed_bob_001"),
			backupCodeHash: sha256Hex("WXYZ2345"),
			status: "REDEEMED",
			claimedAt: msDaysAgo(5),
			claimExpiresAt: msDaysAgo(1),
			redeemedAt: msDaysAgo(4),
		},
	});

	await prisma.rewardRedemption.create({
		data: {
			claimId: REWARD_SEED_IDS.claimRedeemedKl,
			merchantOrgId: klOrg.id,
			userId: bob.id,
			terminalId: "KL-REGISTER-01",
			redemptionMethod: "SCAN",
			idempotencyKey: "50000000-0000-4000-8000-000000000001",
			redeemedAt: msDaysAgo(4),
		},
	});

	await prisma.rewardClaim.create({
		data: {
			id: REWARD_SEED_IDS.claimExpiredKl,
			userId: carol.id,
			rewardId: REWARD_SEED_IDS.klRewardPublished,
			redemptionTokenHash: sha256Hex("seed_qr_token_kl_expired_carol_001"),
			backupCodeHash: sha256Hex("PQRS6789"),
			status: "EXPIRED",
			claimedAt: msDaysAgo(10),
			claimExpiresAt: msDaysAgo(3),
		},
	});

	await prisma.rewardClaim.create({
		data: {
			id: REWARD_SEED_IDS.claimPendingMlk,
			userId: user.id,
			rewardId: REWARD_SEED_IDS.mlkRewardPublished,
			referralId: REWARD_SEED_IDS.referralCredited,
			redemptionTokenHash: sha256Hex("seed_qr_token_mlk_pending_user_001"),
			backupCodeHash: sha256Hex("TUVW2345"),
			status: "PENDING",
			claimedAt: msDaysAgo(2),
			claimExpiresAt: msFromNow(5),
		},
	});

	// Bulk pending claims for inventory stress demo
	const bulkClaimUsers = consumerUsers.slice(0, 6);
	for (const [index, consumer] of bulkClaimUsers.entries()) {
		await prisma.rewardClaim.create({
			data: {
				userId: consumer.id,
				rewardId: REWARD_SEED_IDS.klRewardPublished,
				redemptionTokenHash: sha256Hex(`seed_qr_bulk_kl_${consumer.id}_${index}`),
				backupCodeHash: sha256Hex(`seed_backup_bulk_${consumer.id}_${index}`),
				status: index % 3 === 0 ? "REDEEMED" : "PENDING",
				claimedAt: msDaysAgo(index + 1),
				claimExpiresAt: msFromNow(6 - index),
				redeemedAt: index % 3 === 0 ? msDaysAgo(index) : null,
			},
		});
	}

	// Referrer credit claim for carol (R′)
	await prisma.rewardClaim.create({
		data: {
			userId: carol.id,
			rewardId: REWARD_SEED_IDS.mlkRewardReferrer,
			redemptionTokenHash: sha256Hex("seed_qr_referrer_carol_mlk_001"),
			backupCodeHash: sha256Hex("EFGH2345"),
			status: "PENDING",
			isReferrerCredit: true,
			claimedAt: msDaysAgo(2),
			claimExpiresAt: msFromNow(28),
		},
	});

	await prisma.rewardLegalAcceptance.createMany({
		data: [
			{
				userId: alice.id,
				termsVersion: "2026-01-01",
				privacyVersion: "2026-01-01",
				acceptedAt: msDaysAgo(30),
			},
			{
				userId: bob.id,
				termsVersion: "2026-01-01",
				privacyVersion: "2026-01-01",
				acceptedAt: msDaysAgo(20),
			},
			{
				userId: user.id,
				termsVersion: "2026-01-01",
				privacyVersion: "2026-01-01",
				acceptedAt: msDaysAgo(5),
			},
		],
	});

	await prisma.user.update({
		where: { id: bob.id },
		data: {
			pendingAttributionToken: "seed_ref_token_alice_bob_kl",
			pendingAttributionExpiresAt: msFromNow(7),
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
				createdAt: msDaysAgo(2),
			},
			{
				userId: alice.id,
				type: "claim_confirmed",
				title: "Claim confirmed",
				body: "Your free coffee reward is ready. Show QR at Brew & Bean KL.",
				metadata: { claimId: REWARD_SEED_IDS.claimPendingKl },
				createdAt: msDaysAgo(1),
			},
			{
				userId: bob.id,
				type: "redemption_confirmed",
				title: "Reward redeemed",
				body: "Enjoy your coffee! Redeemed at Brew & Bean KL.",
				metadata: { claimId: REWARD_SEED_IDS.claimRedeemedKl },
				readAt: msDaysAgo(3),
				createdAt: msDaysAgo(4),
			},
		],
	});

	await prisma.rewardAuditLog.createMany({
		data: [
			{
				actorUserId: klCashier.id,
				merchantOrgId: klOrg.id,
				action: "merchant.scan_qr",
				metadata: { claimId: REWARD_SEED_IDS.claimPendingKl, terminalId: "KL-REGISTER-01" },
				createdAt: msDaysAgo(1),
			},
			{
				actorUserId: null,
				merchantOrgId: klOrg.id,
				action: "merchant.redeem_reward",
				metadata: { claimId: REWARD_SEED_IDS.claimRedeemedKl, redemptionMethod: "SCAN" },
				createdAt: msDaysAgo(4),
			},
			{
				actorUserId: klOwner.id,
				merchantOrgId: klOrg.id,
				action: "self_redeem_audit",
				metadata: { note: "Owner self-redeem allowed with audit flag" },
				createdAt: msDaysAgo(6),
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
			expiresAt: msFromNow(1),
			attempts: 1,
			failedAttempts: 0,
			consumedAt: msDaysAgo(1),
		},
	});

	const merchantOrgs = await prisma.merchantOrg.count();
	const rewards = await prisma.reward.count();
	const claims = await prisma.rewardClaim.count();
	const redemptions = await prisma.rewardRedemption.count();
	const referrals = await prisma.rewardReferral.count();
	const notifications = await prisma.rewardNotification.count();

	return {
		merchantOrgs,
		rewards,
		claims,
		redemptions,
		referrals,
		notifications,
	};
}

export function printRewardSeedCredentials(): void {
	console.log(`
🎁 Rewards platform seed credentials
──────────────────────────────────────────────
Merchant owners
  brew.owner@kl-rewards.demo     / BrewOwner@123     (KL Brew & Bean)
  jonker.owner@melaka-rewards.demo / JonkerOwner@123 (Melaka Jonker Kitchen)

Cashiers
  brew.cashier@kl-rewards.demo   / BrewCashier@123
  jonker.cashier@melaka-rewards.demo / JonkerCashier@123

POS API keys (X-Terminal-Id: KL-REGISTER-01 or MLK-REGISTER-01)
  KL:   ${DEMO_MERCHANT_API_KEYS.kl}
  MLK:  ${DEMO_MERCHANT_API_KEYS.mlk}

Demo QR / backup (alice pending claim at Brew & Bean)
  Token:  ${DEMO_QR_TOKEN_PENDING_KL}
  Backup: ${DEMO_BACKUP_CODE_PENDING_KL}
`);
}

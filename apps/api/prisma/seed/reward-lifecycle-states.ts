import type { User } from "@prisma/client";

import { DAY_MS } from "@workspace/shared";

import { sha256Hex } from "../../src/common/crypto/sha256";

import { prisma } from "./client";
import { seedCodeHash } from "./reward-code-hashing";
import { deterministicUuid } from "./deterministic-uuid";
import { ORGANIZATION_SEED_IDS } from "./organizations";
import { POS_CODE_LOCKOUT_MS } from "../../src/modules/rewards/services/pos-code-lockout.service";
import { seedCheckout } from "./reward-checkout";

// ---------------------------------------------------------------------------
// Rewards / POS rows in their LATER lifecycle states — the states the app
// reaches over time (a paired till, a retired till, revoked / locked / deleted
// keys, a rejected and a deleted reward, a blocked referral, soft-deleted
// claims, bills and consumer rows). The main rewards seeder creates the
// "happy path" rows; this module owns everything that is retired, refused or
// removed, so every column of these tables holds realistic data after a seed.
//
// Every id is deterministic and every row lives in a seed tenant or belongs to
// a seed consumer, so the scoped cleanup in `cleanupRewardSeedData` removes and
// re-creates them on each run (idempotent).
// ---------------------------------------------------------------------------

export interface RewardLifecycleSeedContext {
	readonly klOrganizationId: string;
	readonly mlkOrganizationId: string;
	readonly adminUserId: string;
	readonly klOwnerId: string;
	readonly mlkOwnerId: string;
	readonly klCashierId: string;
	readonly alice: User;
	readonly bob: User;
	readonly carol: User;
	readonly klKeyId: string;
	readonly mlkKeyId: string;
	readonly now: number;
}

const NAMESPACE = "reward-seed-lifecycle";
const MINUTE_MS = 60_000;

function id(key: string): string {
	return deterministicUuid(NAMESPACE, key);
}

function daysAgo(now: number, days: number): number {
	return now - days * DAY_MS;
}

/** Seeds every later-lifecycle state; see the module comment. */
export async function seedRewardLifecycleStates(context: RewardLifecycleSeedContext): Promise<void> {
	await seedTerminalAndKeyStates(context);
	await seedRewardStates(context);
	await seedClaimAndSaleStates(context);
	await seedReferralStates(context);
	await seedConsumerRowStates(context);
}

/**
 * - KL-REGISTER-03: a till that PAIRED (its own POS key, `pairedAt`, recently seen).
 * - KL-REGISTER-OLD: a till the owner REMOVED (soft-deleted, its key revoked) — the
 *   app keeps the row so historical bills still name their till.
 * - A manual key that was revoked, one that was deleted, and one locked for
 *   guessing backup codes.
 */
async function seedTerminalAndKeyStates(context: RewardLifecycleSeedContext): Promise<void> {
	const { now } = context;
	const pairedKeyId = id("kl-register-03-key");
	const retiredKeyId = id("kl-register-old-key");

	await prisma.organizationApiKey.createMany({
		data: [
			{
				id: pairedKeyId,
				organizationId: context.klOrganizationId,
				locationId: ORGANIZATION_SEED_IDS.klLocation,
				name: "Counter tablet",
				keyHash: sha256Hex(`seed-unissued:${pairedKeyId}`),
				keyPrefix: "mk_live_seedpair",
				scope: "POS",
				createdByUserId: context.klCashierId,
				lastUsedAt: now - 2 * MINUTE_MS,
			},
			{
				id: retiredKeyId,
				organizationId: context.klOrganizationId,
				locationId: ORGANIZATION_SEED_IDS.klLocation,
				name: "Old register",
				keyHash: sha256Hex(`seed-unissued:${retiredKeyId}`),
				keyPrefix: "mk_live_seedretd",
				scope: "POS",
				createdByUserId: context.klOwnerId,
				lastUsedAt: daysAgo(now, 21),
				revokedAt: daysAgo(now, 20),
			},
			{
				id: id("mlk-revoked-integration-key"),
				organizationId: context.mlkOrganizationId,
				locationId: null,
				name: "Former loyalty-app sync",
				keyHash: sha256Hex(`seed-unissued:${id("mlk-revoked-integration-key")}`),
				keyPrefix: "mk_live_seedrevk",
				scope: "INTEGRATION",
				createdByUserId: context.mlkOwnerId,
				lastUsedAt: daysAgo(now, 40),
				revokedAt: daysAgo(now, 30),
			},
			{
				id: id("mlk-deleted-key"),
				organizationId: context.mlkOrganizationId,
				locationId: ORGANIZATION_SEED_IDS.mlkLocationBeruang,
				name: "Trial key (deleted)",
				keyHash: sha256Hex(`seed-unissued:${id("mlk-deleted-key")}`),
				keyPrefix: "mk_live_seeddelt",
				scope: "POS",
				createdByUserId: context.mlkOwnerId,
				revokedAt: daysAgo(now, 12),
				isDeleted: true,
				deletedAt: daysAgo(now, 12),
			},
			{
				id: id("mlk-locked-key"),
				organizationId: context.mlkOrganizationId,
				locationId: ORGANIZATION_SEED_IDS.mlkLocationBeruang,
				name: "Bukit Beruang kiosk",
				keyHash: sha256Hex(`seed-unissued:${id("mlk-locked-key")}`),
				keyPrefix: "mk_live_seedlock",
				scope: "POS",
				createdByUserId: context.mlkOwnerId,
				lastUsedAt: now - 5 * MINUTE_MS,
				// Locked a few minutes ago for guessing backup codes (the window resets when the lock is set).
				codeLockedUntil: now - 5 * MINUTE_MS + POS_CODE_LOCKOUT_MS,
			},
		],
	});

	await prisma.organizationTerminal.createMany({
		data: [
			{
				id: id("kl-register-03"),
				organizationId: context.klOrganizationId,
				locationId: ORGANIZATION_SEED_IDS.klLocation,
				terminalId: "KL-REGISTER-03",
				label: "Counter tablet",
				createdByUserId: context.klOwnerId,
				pairingCodeIssuedByUserId: context.klCashierId,
				pairingCodeIssuedAt: daysAgo(now, 3),
				apiKeyId: pairedKeyId,
				pairedAt: daysAgo(now, 3) + MINUTE_MS,
				lastSeenAt: now - 2 * MINUTE_MS,
			},
			{
				id: id("kl-register-old"),
				organizationId: context.klOrganizationId,
				locationId: ORGANIZATION_SEED_IDS.klLocation,
				terminalId: "KL-REGISTER-OLD",
				label: "Old register (replaced)",
				createdByUserId: context.klOwnerId,
				pairingCodeIssuedByUserId: context.klOwnerId,
				pairingCodeIssuedAt: daysAgo(now, 60),
				apiKeyId: retiredKeyId,
				pairedAt: daysAgo(now, 60) + MINUTE_MS,
				lastSeenAt: daysAgo(now, 21),
				isDeleted: true,
				deletedAt: daysAgo(now, 20),
				deletedBy: context.klOwnerId,
			},
		],
	});
}

/**
 * - Every published consumer reward records its approval (reviewer + time).
 * - A reward the admin REJECTED (back to draft, with the reason).
 * - A reward the merchant DELETED (soft delete).
 * - Campaign metadata and a per-user use limit on the grand-opening reward.
 */
async function seedRewardStates(context: RewardLifecycleSeedContext): Promise<void> {
	const { now } = context;
	const organizationId = { in: [context.klOrganizationId, context.mlkOrganizationId] };
	await prisma.reward.updateMany({
		where: { organizationId, rewardKind: "CONSUMER", status: { in: ["PUBLISHED", "EXPIRED", "DISABLED"] } },
		data: { reviewedAt: daysAgo(now, 15), reviewedByUserId: context.adminUserId },
	});

	await prisma.reward.updateMany({
		where: { organizationId: context.klOrganizationId, title: "Free coffee — Grand Opening" },
		data: { rules: { maxUsePerUser: 1 }, metadata: { campaign: "grand-opening", channel: "in-store-poster" } },
	});

	await prisma.reward.createMany({
		data: [
			{
				id: id("kl-reward-rejected"),
				organizationId: context.klOrganizationId,
				title: "Free cake for every visit",
				description: "Unlimited free cake with any purchase.",
				rewardType: "FREE_ITEM",
				rewardValue: 1,
				rewardKind: "CONSUMER",
				category: "cafe",
				placeholderImageKey: "category-cafe",
				quantityTotal: 500,
				quantityRemaining: 500,
				expiryDate: now + 30 * DAY_MS,
				status: "DRAFT",
				referralsEnabled: false,
				submittedForReviewAt: daysAgo(now, 4),
				reviewedAt: daysAgo(now, 3),
				reviewedByUserId: context.adminUserId,
				rejectionReason: "An unlimited reward cannot be honoured: set a per-customer limit and a realistic stock, then resubmit.",
				metadata: { campaign: "loyalty-test" },
			},
			{
				id: id("mlk-reward-deleted"),
				organizationId: context.mlkOrganizationId,
				title: "Deleted: Durian week special",
				description: "Withdrawn before launch.",
				rewardType: "DISCOUNT",
				rewardValue: 15,
				rewardKind: "CONSUMER",
				category: "restaurant",
				placeholderImageKey: "category-restaurant",
				quantityTotal: 40,
				quantityRemaining: 40,
				expiryDate: now + 20 * DAY_MS,
				status: "DRAFT",
				referralsEnabled: false,
				isDeleted: true,
				deletedAt: daysAgo(now, 6),
			},
		],
	});
}

/**
 * A claim that was soft-deleted (the customer removed an expired claim from
 * their wallet), and a paid bill voided by support: the sale and its
 * redemption are soft-deleted, never removed — financial history stays.
 */
async function seedClaimAndSaleStates(context: RewardLifecycleSeedContext): Promise<void> {
	const { now } = context;
	await prisma.rewardClaim.create({
		data: {
			id: id("carol-removed-claim"),
			userId: context.carol.id,
			rewardId: await requireGrandOpeningRewardId(context.klOrganizationId),
			redemptionTokenHash: seedCodeHash(`seed-unissued-token:${id("carol-removed-claim")}`),
			backupCodeHash: seedCodeHash(`seed-unissued-backup:${id("carol-removed-claim")}`),
			status: "EXPIRED",
			claimedAt: daysAgo(now, 30),
			claimExpiresAt: daysAgo(now, 23),
			isDeleted: true,
			deletedAt: daysAgo(now, 20),
		},
	});

	const voidedClaimId = id("bob-voided-claim");
	await prisma.rewardClaim.create({
		data: {
			id: voidedClaimId,
			userId: context.bob.id,
			rewardId: await requireGrandOpeningRewardId(context.klOrganizationId),
			redemptionTokenHash: seedCodeHash(`seed-unissued-token:${voidedClaimId}`),
			backupCodeHash: seedCodeHash(`seed-unissued-backup:${voidedClaimId}`),
			status: "REDEEMED",
			claimedAt: daysAgo(now, 9),
			claimExpiresAt: daysAgo(now, 2),
			redeemedAt: daysAgo(now, 8),
		},
	});
	const saleId = await seedCheckout({
		key: "kl-bob-voided",
		organizationId: context.klOrganizationId,
		locationId: ORGANIZATION_SEED_IDS.klLocation,
		terminalId: "KL-REGISTER-01",
		apiKeyId: context.klKeyId,
		userId: context.bob.id,
		claimId: voidedClaimId,
		billTotalMinor: VOIDED_BILL_MINOR,
		paidAt: daysAgo(now, 8),
	});
	const voidedAt = daysAgo(now, 7);
	await prisma.rewardSale.update({ where: { id: saleId }, data: { isDeleted: true, deletedAt: voidedAt, deletedBy: context.adminUserId } });
	await prisma.rewardRedemption.updateMany({ where: { saleId }, data: { isDeleted: true, deletedAt: voidedAt } });
}

/** RM 12.40 — the bill support voided (keyed twice by the cashier). */
const VOIDED_BILL_MINOR = 1_240;

async function requireGrandOpeningRewardId(organizationId: string): Promise<string> {
	const reward = await prisma.reward.findFirstOrThrow({ where: { organizationId, title: "Free coffee — Grand Opening" }, select: { id: true } });
	return reward.id;
}

/** A referral blocked as self-referral (same device as the referrer), and a withdrawn (soft-deleted) one. */
async function seedReferralStates(context: RewardLifecycleSeedContext): Promise<void> {
	const { now } = context;
	const rewardId = await requireGrandOpeningRewardId(context.klOrganizationId);
	await prisma.rewardReferral.createMany({
		data: [
			{
				id: id("referral-blocked"),
				referrerUserId: context.carol.id,
				refereeUserId: context.alice.id,
				rewardId,
				attributionToken: "seed_ref_token_carol_alice_kl_blocked",
				status: "BLOCKED",
				refereeDeviceHash: sha256Hex("seed-device:carol-iphone"),
				refereeIp: "203.176.12.31",
				blockedReason: "Referee used the referrer's device (self-referral).",
			},
			{
				id: id("referral-withdrawn"),
				referrerUserId: context.bob.id,
				refereeUserId: null,
				rewardId,
				attributionToken: "seed_ref_token_bob_withdrawn",
				status: "PENDING",
				refereeDeviceHash: sha256Hex("seed-device:unknown-android"),
				refereeIp: "203.176.12.44",
				isDeleted: true,
				deletedAt: daysAgo(now, 5),
			},
		],
	});
}

/** Soft-deleted consumer rows, and an OTP challenge that was guessed wrong before it expired. */
async function seedConsumerRowStates(context: RewardLifecycleSeedContext): Promise<void> {
	const { now } = context;
	await prisma.rewardNotification.create({
		data: {
			id: id("alice-dismissed-notification"),
			userId: context.alice.id,
			type: "claim_expired",
			title: "Claim expired",
			body: "Your Merdeka promo claim expired.",
			metadata: { rewardTitle: "Expired: Merdeka promo" },
			readAt: daysAgo(now, 4),
			isDeleted: true,
			deletedAt: daysAgo(now, 3),
		},
	});
	await prisma.rewardLegalAcceptance.create({
		data: {
			id: id("carol-superseded-terms"),
			userId: context.carol.id,
			termsVersion: "2025-07-01",
			privacyVersion: "2025-07-01",
			acceptedAt: daysAgo(now, 120),
			isDeleted: true,
			deletedAt: daysAgo(now, 30),
		},
	});
	await prisma.rewardOtpChallenge.create({
		data: {
			id: id("bob-failed-otp"),
			userId: context.bob.id,
			phone: "+60198765432",
			purpose: "CLAIM",
			codeHash: sha256Hex(`seed-unissued-otp:${id("bob-failed-otp")}`),
			expiresAt: daysAgo(now, 1),
			attempts: 3,
			failedAttempts: 3,
			isDeleted: true,
			deletedAt: daysAgo(now, 1),
		},
	});
}

import type { Prisma } from "@prisma/client";
import { Prisma as PrismaNamespace } from "@prisma/client";

import { RequestContextService } from "../../src/platform/infrastructure/context/request-context";
import type { PrismaService } from "../../src/prisma/prisma.service";
import { TenantTransactionService } from "../../src/prisma/tenant-transaction.service";
import { SEED_TEST_FIXTURE_OPERATION } from "../../src/prisma/seed-test-fixture.operation";

/** Fixed clock for every fixture timestamp so a second seed writes the same columns. */
const FIXTURE_EPOCH_MS = 1_700_000_000_000;

const EPOCH = BigInt(FIXTURE_EPOCH_MS);

/** Past any test clock, so a marketplace filter that compares expiry to `Date.now()` still includes the row. */
const UNEXPIRED_EXPIRY = 2_000_000_000_000n;

/** Fixed uuid v7 ids for the two-tenant e2e fixture (plan §8.1). */
export const TWO_TENANT_FIXTURE = Object.freeze({
	epochMs: FIXTURE_EPOCH_MS,
	tenantA: "019b76da-a810-7000-8000-0000000000a1",
	tenantB: "019b76da-a810-7000-8000-0000000000b1",
	tenantS: "019b76da-a810-7000-8000-0000000000c1",
	locationAKl: "019b76da-a810-7000-8000-0000000000a2",
	locationAMalacca: "019b76da-a810-7000-8000-0000000000a3",
	locationBJb: "019b76da-a810-7000-8000-0000000000b2",
	locationS: "019b76da-a810-7000-8000-0000000000c2",
	userAOwner: "019b76da-a810-7000-8000-0000000000a4",
	userAKlManager: "019b76da-a810-7000-8000-0000000000a5",
	userACashier: "019b76da-a810-7000-8000-0000000000a6",
	userASuspended: "019b76da-a810-7000-8000-0000000000aa",
	userBOwner: "019b76da-a810-7000-8000-0000000000b4",
	userSOwner: "019b76da-a810-7000-8000-0000000000c4",
	userCustomerC: "019b76da-a810-7000-8000-0000000000d1",
	userPlatformP: "019b76da-a810-7000-8000-0000000000e1",
	membershipAOwner: "019b76da-a810-7000-8000-0000000000a7",
	membershipAKlManager: "019b76da-a810-7000-8000-0000000000a8",
	membershipACashier: "019b76da-a810-7000-8000-0000000000a9",
	membershipASuspended: "019b76da-a810-7000-8000-0000000000ab",
	membershipBOwner: "019b76da-a810-7000-8000-0000000000b7",
	membershipSOwner: "019b76da-a810-7000-8000-0000000000c7",
	scopeAOwner: "019b76da-a810-7000-8000-000000000aa1",
	scopeAKlManager: "019b76da-a810-7000-8000-000000000aa2",
	scopeACashier: "019b76da-a810-7000-8000-000000000aa3",
	scopeBOwner: "019b76da-a810-7000-8000-000000000bb1",
	scopeSOwner: "019b76da-a810-7000-8000-000000000cc1",
	rewardA: "019b76da-a810-7000-8000-000000000ab1",
	rewardB: "019b76da-a810-7000-8000-000000000bb2",
	rewardAMarketplace: "019b76da-a810-7000-8000-000000000ac1",
	rewardADraft: "019b76da-a810-7000-8000-000000000ac2",
	rewardBMarketplace: "019b76da-a810-7000-8000-000000000bc1",
	rewardBDraft: "019b76da-a810-7000-8000-000000000bc2",
	rewardScopeA: "019b76da-a810-7000-8000-000000000ab2",
	claimC: "019b76da-a810-7000-8000-000000000d2",
	claimARedeemed: "019b76da-a810-7000-8000-000000000ab3",
	apiKeyA: "019b76da-a810-7000-8000-000000000ab4",
	terminalA: "019b76da-a810-7000-8000-000000000ab5",
	saleA: "019b76da-a810-7000-8000-000000000ab6",
	saleB: "019b76da-a810-7000-8000-000000000bb3",
	redemptionA: "019b76da-a810-7000-8000-000000000ab7",
	redemptionB: "019b76da-a810-7000-8000-000000000bb4",
	claimB: "019b76da-a810-7000-8000-000000000bb5",
});

const BASE = Object.freeze({
	createdAt: EPOCH,
	createdBy: null,
	updatedAt: EPOCH,
	updatedBy: null,
	isDeleted: false,
	deletedAt: null,
	deletedBy: null,
});

function userRow(id: string, email: string, fullName: string, isSuperAdmin: boolean): Prisma.UserUncheckedCreateInput & { readonly id: string } {
	return {
		...BASE,
		id,
		fullName,
		email,
		passwordHash: "fixture-password-hash",
		isActive: true,
		isSuperAdmin,
		profileVersion: 0,
		tokenVersion: 0,
		failedLoginAttempts: 0,
		lockedUntil: null,
		twoFactorEnabled: false,
		twoFactorSecretCiphertext: null,
		twoFactorSecretIv: null,
		twoFactorSecretKeyVersion: null,
		twoFactorLastTotpStep: null,
		mfaEnrolledAt: null,
		mfaEnrollmentDeadline: null,
		mfaAssuredAt: null,
		emailVerifiedAt: EPOCH,
		phone: null,
		phoneVerifiedAt: null,
		lastLoginAt: null,
		pendingAttributionToken: null,
		pendingAttributionExpiresAt: null,
	};
}

/** Idempotent §8.1 rows. A second call writes the same columns. */
export async function seedTwoTenantFixture(prisma: PrismaService): Promise<void> {
	const ids = TWO_TENANT_FIXTURE;
	const transactions = new TenantTransactionService(prisma, new RequestContextService());
	await transactions.withSystemOperation({ operation: SEED_TEST_FIXTURE_OPERATION, reason: "Seed the two-tenant e2e fixture", actorUserId: null }, async (tx) => {
		const users = [
			userRow(ids.userAOwner, "fixture-a-owner@example.com", "A Owner", false),
			userRow(ids.userAKlManager, "fixture-a-kl-manager@example.com", "A KL Manager", false),
			userRow(ids.userACashier, "fixture-a-cashier@example.com", "A Cashier", false),
			userRow(ids.userASuspended, "fixture-a-suspended@example.com", "A Suspended", false),
			userRow(ids.userBOwner, "fixture-b-owner@example.com", "B Owner", false),
			userRow(ids.userSOwner, "fixture-s-owner@example.com", "S Owner", false),
			userRow(ids.userCustomerC, "fixture-customer-c@example.com", "Customer C", false),
			userRow(ids.userPlatformP, "fixture-platform-p@example.com", "Platform P", true),
		];
		for (const row of users) {
			await tx.user.upsert({ where: { id: row.id }, create: row, update: row });
		}

		const tenants = [
			tenant(ids.tenantA, "fixture-tenant-a", "Tenant A", "ACTIVE"),
			tenant(ids.tenantB, "fixture-tenant-b", "Tenant B", "ACTIVE"),
			tenant(ids.tenantS, "fixture-tenant-s", "Tenant S", "SUSPENDED"),
		];
		for (const row of tenants) {
			await tx.tenant.upsert({ where: { id: row.id }, create: row, update: row });
		}

		const locations = [
			location(ids.locationAKl, ids.tenantA, "A-KL", "a-kl", true),
			location(ids.locationAMalacca, ids.tenantA, "A-Malacca", "a-malacca", false),
			location(ids.locationBJb, ids.tenantB, "B-JB", "b-jb", true),
			location(ids.locationS, ids.tenantS, "S", "s-home", true),
		];
		for (const row of locations) {
			await tx.location.upsert({ where: { id: row.id }, create: row, update: row });
		}

		const memberships = [
			membership(ids.membershipAOwner, ids.tenantA, ids.userAOwner, "OWNER", "ACTIVE"),
			membership(ids.membershipAKlManager, ids.tenantA, ids.userAKlManager, "ADMIN", "ACTIVE"),
			membership(ids.membershipACashier, ids.tenantA, ids.userACashier, "CASHIER", "ACTIVE"),
			membership(ids.membershipASuspended, ids.tenantA, ids.userASuspended, "MEMBER", "SUSPENDED"),
			membership(ids.membershipBOwner, ids.tenantB, ids.userBOwner, "OWNER", "ACTIVE"),
			membership(ids.membershipSOwner, ids.tenantS, ids.userSOwner, "OWNER", "ACTIVE"),
		];
		for (const row of memberships) {
			await tx.membership.upsert({ where: { id: row.id }, create: row, update: row });
		}

		const scopes = [
			scope(ids.scopeAOwner, ids.tenantA, ids.membershipAOwner, "ALL_LOCATIONS", null),
			scope(ids.scopeAKlManager, ids.tenantA, ids.membershipAKlManager, "SELECTED", ids.locationAKl),
			scope(ids.scopeACashier, ids.tenantA, ids.membershipACashier, "SELECTED", ids.locationAKl),
			scope(ids.scopeBOwner, ids.tenantB, ids.membershipBOwner, "ALL_LOCATIONS", null),
			scope(ids.scopeSOwner, ids.tenantS, ids.membershipSOwner, "ALL_LOCATIONS", null),
		];
		for (const row of scopes) {
			await tx.membershipLocationScope.upsert({ where: { id: row.id }, create: row, update: row });
		}

		const rewards = [
			// Reward A: customer C's PENDING claim holds one unit; A-Cashier's claim was redeemed.
			reward(ids.rewardA, ids.tenantA, "Reward A", "SELECTED", "PUBLISHED", EPOCH + 86_400_000n, null, { reserved: 1, redeemed: 1 }),
			reward(ids.rewardB, ids.tenantB, "Reward B", "ALL_LOCATIONS", "PUBLISHED", EPOCH + 86_400_000n, null, { reserved: 0, redeemed: 1 }),
			reward(ids.rewardAMarketplace, ids.tenantA, "Reward A marketplace", "ALL_LOCATIONS", "PUBLISHED", UNEXPIRED_EXPIRY, null),
			reward(ids.rewardADraft, ids.tenantA, "Reward A draft", "ALL_LOCATIONS", "DRAFT", UNEXPIRED_EXPIRY, "not for customers"),
			reward(ids.rewardBMarketplace, ids.tenantB, "Reward B marketplace", "ALL_LOCATIONS", "PUBLISHED", UNEXPIRED_EXPIRY, null),
			reward(ids.rewardBDraft, ids.tenantB, "Reward B draft", "ALL_LOCATIONS", "DRAFT", UNEXPIRED_EXPIRY, "not for customers"),
		];
		for (const row of rewards) {
			await tx.reward.upsert({ where: { id: row.id }, create: row, update: row });
		}
		const rewardScope = {
			...BASE,
			id: ids.rewardScopeA,
			tenantId: ids.tenantA,
			rewardId: ids.rewardA,
			locationId: ids.locationAKl,
		};
		await tx.rewardLocationScope.upsert({ where: { id: rewardScope.id }, create: rewardScope, update: rewardScope });

		const claims = [
			claim(ids.claimC, ids.userCustomerC, ids.rewardA, "fixture-claim-c-token", "fixture-claim-c-backup", "PENDING", null),
			claim(ids.claimARedeemed, ids.userACashier, ids.rewardA, "fixture-claim-a-token", "fixture-claim-a-backup", "REDEEMED", EPOCH),
			claim(ids.claimB, ids.userBOwner, ids.rewardB, "fixture-claim-b-token", "fixture-claim-b-backup", "REDEEMED", EPOCH),
		];
		for (const row of claims) {
			await tx.rewardClaim.upsert({ where: { id: row.id }, create: row, update: row });
		}

		const apiKey = apiKeyRow();
		await tx.tenantApiKey.upsert({ where: { id: apiKey.id }, create: apiKey, update: apiKey });

		const terminal = {
			...BASE,
			id: ids.terminalA,
			tenantId: ids.tenantA,
			locationId: ids.locationAKl,
			terminalId: "FIXTURE-A-KL",
			label: "A KL",
			createdByUserId: ids.userAOwner,
			pairingCodeIssuedByUserId: null,
			pairingCodeIssuedAt: null,
			apiKeyId: ids.apiKeyA,
			pairingCodeHash: null,
			pairingCodeExpiresAt: null,
			pairedAt: EPOCH,
			lastSeenAt: null,
		};
		await tx.tenantTerminal.upsert({ where: { id: terminal.id }, create: terminal, update: terminal });

		const sales = [
			sale(ids.saleA, ids.tenantA, ids.locationAKl, ids.userACashier, ids.apiKeyA, "fixture-sale-a"),
			sale(ids.saleB, ids.tenantB, ids.locationBJb, ids.userBOwner, null, "fixture-sale-b"),
		];
		for (const row of sales) {
			await tx.rewardSale.upsert({ where: { id: row.id }, create: row, update: row });
		}

		const redemptions = [
			redemption(ids.redemptionA, ids.claimARedeemed, ids.tenantA, ids.locationAKl, ids.userACashier, ids.saleA),
			redemption(ids.redemptionB, ids.claimB, ids.tenantB, ids.locationBJb, ids.userBOwner, ids.saleB),
		];
		for (const row of redemptions) {
			await tx.rewardRedemption.upsert({ where: { id: row.id }, create: row, update: row });
		}
	});
}

function tenant(id: string, slug: string, displayName: string, lifecycleState: "ACTIVE" | "SUSPENDED"): Prisma.TenantUncheckedCreateInput & { readonly id: string } {
	return { ...BASE, id, slug, displayName, lifecycleState, timeZone: "Asia/Kuala_Lumpur", deletionGraceEndsAt: null };
}

function apiKeyRow(): Prisma.TenantApiKeyUncheckedCreateInput & { readonly id: string } {
	const ids = TWO_TENANT_FIXTURE;
	return {
		...BASE,
		id: ids.apiKeyA,
		tenantId: ids.tenantA,
		locationId: ids.locationAKl,
		name: "A KL till",
		keyHash: "fixture-api-key-hash",
		keyPrefix: "fixture-a-kl",
		scope: "POS",
		createdByUserId: ids.userAOwner,
		revokedAt: null,
		lastUsedAt: null,
		codeFailureCount: 0,
		codeFailureWindowStartedAt: null,
		codeLockedUntil: null,
	};
}

function location(id: string, tenantId: string, name: string, code: string, isPrimary: boolean): Prisma.LocationUncheckedCreateInput & { readonly id: string } {
	return {
		...BASE,
		id,
		tenantId,
		name,
		code,
		addressText: null,
		city: null,
		contactPhone: null,
		status: "ACTIVE",
		rejectionReason: null,
		requestedByUserId: null,
		reviewedByUserId: null,
		reviewedAt: null,
		isPrimary,
		closureReason: null,
	};
}

function membership(
	id: string,
	tenantId: string,
	userId: string,
	role: "OWNER" | "ADMIN" | "CASHIER" | "MEMBER",
	status: "ACTIVE" | "SUSPENDED",
): Prisma.MembershipUncheckedCreateInput & { readonly id: string } {
	return { ...BASE, id, tenantId, userId, role, status, displayName: null };
}

function scope(
	id: string,
	tenantId: string,
	membershipId: string,
	scopeType: "ALL_LOCATIONS" | "SELECTED",
	locationId: string | null,
): Prisma.MembershipLocationScopeUncheckedCreateInput & { readonly id: string } {
	return { ...BASE, id, tenantId, membershipId, scopeType, locationId };
}

/** Units each fixture reward offers. */
const REWARD_QUANTITY = 10;

/** A reward's claim counters, kept consistent with the fixture's claims: a PENDING claim reserves a unit. */
interface RewardInventory {
	readonly reserved: number;
	readonly redeemed: number;
}

const NO_CLAIMS: RewardInventory = Object.freeze({ reserved: 0, redeemed: 0 });

function reward(
	id: string,
	tenantId: string,
	title: string,
	locationScopeType: "SELECTED" | "ALL_LOCATIONS",
	status: "PUBLISHED" | "DRAFT" = "PUBLISHED",
	expiryDate: bigint = EPOCH + 86_400_000n,
	rejectionReason: string | null = null,
	inventory: RewardInventory = NO_CLAIMS,
): Prisma.RewardUncheckedCreateInput & { readonly id: string } {
	return {
		...BASE,
		id,
		tenantId,
		title,
		description: `${title} fixture`,
		rewardType: "DISCOUNT",
		rewardValue: 100,
		termsConditions: null,
		rewardKind: "CONSUMER",
		category: "fixture",
		rules: PrismaNamespace.JsonNull,
		minSpendMinor: null,
		quantityTotal: REWARD_QUANTITY,
		quantityRemaining: REWARD_QUANTITY - inventory.reserved - inventory.redeemed,
		quantityReserved: inventory.reserved,
		startDate: null,
		expiryDate,
		status,
		claimCount: inventory.reserved + inventory.redeemed,
		redemptionCount: inventory.redeemed,
		metadata: PrismaNamespace.JsonNull,
		referralsEnabled: false,
		referralPoolTotal: null,
		referralPoolRemaining: null,
		referrerRewardId: null,
		parentConsumerRewardId: null,
		locationScopeType,
		submittedForReviewAt: null,
		autoPublishAt: null,
		reviewedAt: EPOCH,
		reviewedByUserId: null,
		rejectionReason,
	};
}

function claim(
	id: string,
	userId: string,
	rewardId: string,
	token: string,
	backup: string,
	status: "PENDING" | "REDEEMED",
	redeemedAt: bigint | null,
): Prisma.RewardClaimUncheckedCreateInput & { readonly id: string } {
	return {
		...BASE,
		id,
		userId,
		rewardId,
		referralId: null,
		redemptionTokenHash: token,
		backupCodeHash: backup,
		status,
		isReferrerCredit: false,
		claimedAt: EPOCH,
		// A PENDING claim is live (it holds a reserved unit until it expires); a redeemed one is history.
		claimExpiresAt: status === "PENDING" ? UNEXPIRED_EXPIRY : EPOCH + 86_400_000n,
		redeemedAt,
	};
}

function sale(
	id: string,
	tenantId: string,
	locationId: string,
	userId: string,
	apiKeyId: string | null,
	idempotencyKey: string,
): Prisma.RewardSaleUncheckedCreateInput & { readonly id: string } {
	return {
		...BASE,
		id,
		tenantId,
		locationId,
		userId,
		terminalId: "FIXTURE-A-KL",
		apiKeyId,
		billTotalMinor: 1000n,
		currency: "MYR",
		idempotencyKey,
		requestHash: "fixture-request-hash",
		paidAt: EPOCH,
	};
}

function redemption(
	id: string,
	claimId: string,
	tenantId: string,
	locationId: string,
	userId: string,
	saleId: string,
): Prisma.RewardRedemptionUncheckedCreateInput & { readonly id: string } {
	return {
		...BASE,
		id,
		claimId,
		tenantId,
		locationId,
		userId,
		terminalId: "FIXTURE-A-KL",
		redemptionMethod: "SCAN",
		saleId,
		redeemedAt: EPOCH,
	};
}

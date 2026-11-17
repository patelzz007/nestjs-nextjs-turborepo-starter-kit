// ============================================
// prisma/seed/merchant-network.ts — writes the merchant network (merchant-network-plan.ts)
// ============================================
// Six more merchants with their owners, branches, profiles, data keys and POS keys; 50 rewards at every branch; and a
// year of claims, bills, redemptions and checkout audit rows — written the way analytics-history.ts writes the demo
// tenants' year, so every invariant the API keeps at checkout holds. Runs before customer-tiers.ts, which replays
// every customer's redemptions: the five loyal customers come out Diamond.
//
// Re-runnable: these merchants' re-creatable rows (rewards, claims, bills, redemptions, POS keys, member scopes) are
// removed first, by tenant id — another tenant's rows are never touched — and the merchants, branches, owners and
// memberships are upserted. Audit rows are never deleted (re-runs keep the first copy).

import type { Prisma, Role, User } from "@prisma/client";
import { DAY_MS, DEFAULT_SALE_CURRENCY } from "@workspace/shared";
import * as bcrypt from "bcrypt";

import { API_KEY_PREFIX_LENGTH } from "../../src/contexts/pos/public-api";
import { sha256Hex } from "../../src/platform/infrastructure/crypto/sha256";
import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { upsertLiveUserByEmail } from "./live-user";
import { buildMerchantNetworkPlan, networkTenants, timeZoneOf, type MerchantNetworkInput, type NetworkLocation, type NetworkReward } from "./merchant-network-plan";
import { upsertLiveSeedMembership } from "./memberships";
import { seedCodeHash } from "./reward-code-hashing";
import { linkRewardCoverCopies, seedRewardCoverCopies, type RewardCoverCopyOwner } from "./reward-images";
import { seedLog } from "./seed-log";
import { seedTenantEncryptionKeys } from "./tenant-encryption";
import { upsertSeedTenant } from "./tenants";

const NAMESPACE = "merchant-network";
/** The owners' demo password (printed with the other demo credentials). */
export const MERCHANT_NETWORK_OWNER_PASSWORD = "Owner@123";
const BCRYPT_ROUNDS = 10;
/** Stock left on a running reward after its redemptions. */
const MIN_REMAINING_STOCK = 30;
const MAX_REMAINING_STOCK = 200;
/** A reward went to review two days before it started, and was approved the day before. */
const SUBMITTED_DAYS_BEFORE_START = 2;
const SEN_PER_RINGGIT = 100;
/** Rows per `createMany` (well below the bind-parameter limit). */
const CREATE_MANY_CHUNK = 500;

async function inChunks<TRow>(rows: readonly TRow[], write: (chunk: TRow[]) => Promise<void>): Promise<void> {
	for (let start = 0; start < rows.length; start += CREATE_MANY_CHUNK) {
		await write(rows.slice(start, start + CREATE_MANY_CHUNK));
	}
}

/** A planned bill names a branch the plan doesn't define — a bug in merchant-network-plan.ts. */
export class UnknownNetworkLocationError extends Error {
	public constructor(key: string) {
		super(`Merchant network: unknown branch ${key}`);
		this.name = "UnknownNetworkLocationError";
	}
}

/** Seed-only plaintext of a branch's POS key (only its hash is stored; nothing documents it as a credential). */
function posKeyPlaintext(location: NetworkLocation): string {
	return `mk_live_seedNetwork${sha256Hex(location.key).slice(0, API_KEY_PREFIX_LENGTH * 2)}`;
}

function rewardStatus(reward: NetworkReward, nowMs: number): "PUBLISHED" | "EXPIRED" {
	return reward.endMs < nowMs ? "EXPIRED" : "PUBLISHED";
}

/** Removes the network merchants' re-creatable rows, so a re-run converges. */
async function cleanupMerchantNetwork(tenantIds: readonly string[]): Promise<void> {
	const tenantId = { in: [...tenantIds] };
	await prisma.rewardRedemption.deleteMany({ where: { tenantId } });
	await prisma.rewardSale.deleteMany({ where: { tenantId } });
	await prisma.rewardClaim.deleteMany({ where: { reward: { tenantId } } });
	await prisma.rewardLocationScope.deleteMany({ where: { tenantId } });
	await prisma.rewardImage.deleteMany({ where: { tenantId } });
	await prisma.reward.deleteMany({ where: { tenantId } });
	await prisma.tenantApiKey.deleteMany({ where: { tenantId } });
	await prisma.membershipLocationScope.deleteMany({ where: { tenantId } });
}

export interface MerchantNetworkSummary {
	readonly tenants: number;
	readonly locations: number;
	readonly rewards: number;
	readonly claims: number;
	readonly redemptions: number;
	readonly loyalCustomers: number;
}

export interface MerchantNetworkSeedInput extends MerchantNetworkInput {
	readonly adminUser: User;
	readonly userRole: Role;
}

export async function seedMerchantNetwork(input: MerchantNetworkSeedInput): Promise<MerchantNetworkSummary> {
	const { nowMs, adminUser, userRole } = input;
	const plan = buildMerchantNetworkPlan(input);
	await cleanupMerchantNetwork(plan.tenants.map((tenant) => tenant.id));

	const passwordHash = await bcrypt.hash(MERCHANT_NETWORK_OWNER_PASSWORD, BCRYPT_ROUNDS);
	const now = BigInt(nowMs);
	const coverOwners: RewardCoverCopyOwner[] = [];
	for (const tenant of plan.tenants) {
		const owner = await upsertLiveUserByEmail(
			tenant.ownerEmail,
			{ fullName: tenant.ownerName, isActive: true },
			{ email: tenant.ownerEmail, passwordHash, fullName: tenant.ownerName, isActive: true, isSuperAdmin: false },
		);
		await prisma.userRole.upsert({ where: { userId_roleId: { userId: owner.id, roleId: userRole.id } }, update: {}, create: { userId: owner.id, roleId: userRole.id } });
		coverOwners.push({ tenantId: tenant.id, userId: owner.id, slugs: tenant.imageSets });
		const [primary] = tenant.locations;
		if (primary === undefined) {
			throw new UnknownNetworkLocationError(`${tenant.key}:primary`);
		}
		await upsertSeedTenant(
			{
				id: tenant.id,
				slug: tenant.slug,
				displayName: tenant.displayName,
				owner,
				locations: tenant.locations.map((location) => ({
					id: location.id,
					name: location.name,
					code: location.code,
					addressText: location.addressText,
					city: location.city,
					contactPhone: location.contactPhone,
					isPrimary: location.isPrimary,
					status: "ACTIVE",
				})),
				profile: {
					legalName: tenant.legalName,
					category: tenant.category,
					addressText: primary.addressText,
					city: primary.city,
					kybStatus: "APPROVED",
					kybFields: { registrationNo: tenant.registrationNo },
					contactEmail: tenant.ownerEmail,
					contactPhone: primary.contactPhone,
					requireRegisteredTerminals: false,
				},
				timeZone: timeZoneOf(primary.city),
			},
			adminUser,
			now,
		);
		await upsertLiveSeedMembership({ id: tenant.ownerMembershipId, tenantId: tenant.id, userId: owner.id, role: "OWNER", displayName: null });
		await prisma.membershipLocationScope.create({ data: { tenantId: tenant.id, membershipId: tenant.ownerMembershipId, scopeType: "ALL_LOCATIONS" } });
		await prisma.tenantApiKey.createMany({
			data: tenant.locations.map((location) => {
				const plaintext = posKeyPlaintext(location);
				return {
					id: location.apiKeyId,
					tenantId: tenant.id,
					locationId: location.id,
					name: `${location.area} till`,
					keyHash: sha256Hex(plaintext),
					keyPrefix: plaintext.slice(0, API_KEY_PREFIX_LENGTH),
					scope: "POS",
					createdByUserId: owner.id,
				};
			}),
		});
	}
	await seedTenantEncryptionKeys(plan.tenants.map((tenant) => ({ tenantId: tenant.id, actorUserId: adminUser.id })));

	const random = input.random;
	const claimsByReward = new Map<string, { claims: number; redeemed: number }>();
	for (const claim of plan.claims) {
		const counts = claimsByReward.get(claim.rewardKey) ?? { claims: 0, redeemed: 0 };
		claimsByReward.set(claim.rewardKey, { claims: counts.claims + 1, redeemed: counts.redeemed + (claim.status === "REDEEMED" ? 1 : 0) });
	}
	const rewardRows: Prisma.RewardCreateManyInput[] = plan.rewards.map((reward) => {
		const counts = claimsByReward.get(reward.key) ?? { claims: 0, redeemed: 0 };
		const status = rewardStatus(reward, nowMs);
		const quantityTotal = counts.redeemed + (status === "PUBLISHED" ? random.int(MIN_REMAINING_STOCK, MAX_REMAINING_STOCK) : 0);
		return {
			id: reward.id,
			tenantId: reward.tenantId,
			title: reward.title,
			description: reward.description,
			rewardType: reward.rewardType,
			rewardValue: reward.rewardValue,
			freeItemName: reward.freeItemName,
			freeItemSku: reward.freeItemSku,
			termsConditions: "One per bill. Not combinable with other rewards. While stocks last.",
			rewardKind: "CONSUMER",
			category: reward.category,
			// No per-customer limit: the loyal customers come back for the same year-round offers.
			rules: { minSpendMyr: reward.minSpendMinor / SEN_PER_RINGGIT },
			minSpendMinor: reward.minSpendMinor,
			quantityTotal,
			quantityRemaining: quantityTotal - counts.redeemed,
			quantityReserved: 0,
			startDate: reward.startMs,
			expiryDate: reward.endMs,
			status,
			claimCount: counts.claims,
			redemptionCount: counts.redeemed,
			metadata: { seed: NAMESPACE },
			referralsEnabled: false,
			locationScopeType: "SELECTED",
			audienceType: "EVERYONE",
			minimumTier: reward.minimumTier,
			submittedForReviewAt: reward.startMs - SUBMITTED_DAYS_BEFORE_START * DAY_MS,
			reviewedAt: reward.startMs - DAY_MS,
			reviewedByUserId: adminUser.id,
			createdAt: reward.startMs - SUBMITTED_DAYS_BEFORE_START * DAY_MS,
		};
	});
	await inChunks(rewardRows, async (chunk) => {
		await prisma.reward.createMany({ data: chunk });
	});
	await inChunks(plan.rewards, async (chunk) => {
		await prisma.rewardLocationScope.createMany({ data: chunk.map((reward) => ({ rewardId: reward.id, tenantId: reward.tenantId, locationId: reward.locationId })) });
	});
	// Every published reward shows at least one image (the catalogue refuses one without): the merchant's own cover copies.
	await seedRewardCoverCopies(coverOwners);
	await linkRewardCoverCopies(plan.rewards.map((reward) => ({ rewardId: reward.id, tenantId: reward.tenantId, slug: reward.imageSet })));

	const locationByKey = new Map(plan.tenants.flatMap((tenant) => tenant.locations.map((location): [string, NetworkLocation] => [location.key, location])));
	const claimId = (key: string): string => deterministicUuid(NAMESPACE, `claim:${key}`);
	const saleId = (key: string): string => deterministicUuid(NAMESPACE, `sale:${key}`);
	const claimRows: Prisma.RewardClaimCreateManyInput[] = plan.claims.map((claim) => ({
		id: claimId(claim.key),
		userId: claim.userId,
		rewardId: claim.rewardId,
		redemptionTokenHash: seedCodeHash(`seed_network_qr_${claim.key}`),
		backupCodeHash: seedCodeHash(`seed_network_backup_${claim.key}`),
		status: claim.status,
		claimedAt: claim.claimedAt,
		claimExpiresAt: claim.claimExpiresAt,
		redeemedAt: claim.checkout?.paidAt ?? null,
		createdAt: claim.claimedAt,
		updatedAt: claim.checkout?.paidAt ?? claim.claimExpiresAt,
	}));
	const redeemed = plan.claims.flatMap((claim) => {
		if (claim.checkout === null) {
			return [];
		}
		const location = locationByKey.get(claim.checkout.locationKey);
		if (location === undefined) {
			throw new UnknownNetworkLocationError(claim.checkout.locationKey);
		}
		return [{ claim, checkout: claim.checkout, location }];
	});
	const saleRows: Prisma.RewardSaleCreateManyInput[] = redeemed.map(({ claim, checkout, location }) => ({
		id: saleId(claim.key),
		tenantId: location.tenantId,
		locationId: location.id,
		userId: claim.userId,
		terminalId: location.terminalId,
		apiKeyId: location.apiKeyId,
		billTotalMinor: checkout.billTotalMinor,
		currency: DEFAULT_SALE_CURRENCY,
		idempotencyKey: deterministicUuid(NAMESPACE, `checkout-key:${claim.key}`),
		requestHash: sha256Hex(`seed-network-checkout:${claim.key}`),
		paidAt: checkout.paidAt,
		createdAt: checkout.paidAt,
		updatedAt: checkout.paidAt,
	}));
	const redemptionRows: Prisma.RewardRedemptionCreateManyInput[] = redeemed.map(({ claim, checkout, location }) => ({
		id: deterministicUuid(NAMESPACE, `redemption:${claim.key}`),
		claimId: claimId(claim.key),
		tenantId: location.tenantId,
		locationId: location.id,
		userId: claim.userId,
		terminalId: location.terminalId,
		redemptionMethod: checkout.redemptionMethod,
		saleId: saleId(claim.key),
		redeemedAt: checkout.paidAt,
		// Bronze until customer-tiers.ts replays every customer's history and records the tier each redemption had.
		customerTier: "BRONZE",
		createdAt: checkout.paidAt,
		updatedAt: checkout.paidAt,
	}));
	const auditRows: Prisma.RewardAuditLogCreateManyInput[] = redeemed.map(({ claim, checkout, location }) => ({
		id: deterministicUuid(NAMESPACE, `audit-checkout:${claim.key}`),
		tenantId: location.tenantId,
		action: "merchant.checkout",
		metadata: {
			saleId: saleId(claim.key),
			claimIds: [claimId(claim.key)],
			terminalId: location.terminalId,
			apiKeyId: location.apiKeyId,
			locationId: location.id,
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
	await inChunks(auditRows, async (chunk) => {
		await prisma.rewardAuditLog.createMany({ data: chunk, skipDuplicates: true });
	});

	return {
		tenants: plan.tenants.length,
		locations: plan.tenants.reduce((total, tenant) => total + tenant.locations.length, 0),
		rewards: plan.rewards.length,
		claims: claimRows.length,
		redemptions: redemptionRows.length,
		loyalCustomers: input.loyalCustomerIds.length,
	};
}

/** The new merchants' owners and branches, with the seed's other demo credentials. */
export function printMerchantNetworkCredentials(): void {
	const lines = networkTenants().map(
		(tenant) =>
			`${tenant.displayName} — ${tenant.ownerEmail} / ${MERCHANT_NETWORK_OWNER_PASSWORD}\n  Branches:      ${tenant.locations.map((location) => location.area).join(", ")}`,
	);
	seedLog(`
🏬 Merchant network (six more merchants, 50 rewards a branch)
──────────────────────────────────────────────
${lines.join("\n\n")}

Diamond customers (11 redemptions at each of five merchants this year): user-01 … user-05@example.com / User@123
`);
}

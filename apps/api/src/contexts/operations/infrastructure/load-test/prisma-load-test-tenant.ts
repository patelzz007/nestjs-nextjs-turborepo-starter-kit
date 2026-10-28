// ============================================
// infrastructure/load-test/prisma-load-test-tenant.ts — provisioning and purging the Load Test tenant
// ============================================
// Design patterns:
//   - ADAPTER for `LoadTestProvisioningPort` and `LoadTestPurgePort` on the caller's transaction.
//   - Idempotent provisioning: fixed slug and e-mail patterns, upserts and `createMany(skipDuplicates)`,
//     so a second call changes only the password and adds missing customers.
//   - The purge deletes in foreign-key order (children first) and reports what it removed. It is the
//     one hard delete in the platform (ADR 068, exception 2), confined by `WHERE` to the Load Test
//     tenant and its load-test users.

import type { Prisma } from "@prisma/client";
import type { LoadTestPurgeResult } from "@workspace/shared";

import { TenantRoleCopies } from "../../../authorization/public-api";
import type { LoadTestProvisioningPort, LoadTestPurgePort, ProvisionedLoadTestTenant } from "../../application/ports/load-test-tenant.port";

type Db = Prisma.TransactionClient;

/** The Load Test tenant's fixed identity. */
export const LOAD_TEST_TENANT_SLUG = "load-test";
const LOAD_TEST_TENANT_NAME = "Load Test";
/** Load-test users' addresses: `.invalid` (RFC 2606) can never be delivered to, even by mistake. */
export const LOAD_TEST_EMAIL_DOMAIN = "loadtest.invalid";
/** Staff accounts the merchant scenarios sign in as (shared by their virtual users). */
const LOAD_TEST_STAFF_COUNT = 5;
/** Published rewards the customer scenarios browse and claim. */
const LOAD_TEST_REWARD_COUNT = 10;
/** Each reward's stock: more than any run can claim. */
const LOAD_TEST_REWARD_QUANTITY = 1_000_000_000;
/** The rewards' face value (RM 5.00, in sen). */
const LOAD_TEST_REWARD_VALUE = 500;
const ZERO_PAD = 4;
const PHONE_DIGITS = 7;
/** The legal versions recorded on a load-test customer's acceptance (any version counts for a claim). */
const LOAD_TEST_LEGAL_VERSION = "load-test";
const STORE_CODE = "LOADTEST-1";
/** Rewards stay claimable for ten years from provisioning. */
const REWARD_LIFETIME_MS = 10 * 365 * 24 * 3_600_000;

export function loadTestCustomerEmail(index: number): string {
	return `customer-${String(index + 1).padStart(ZERO_PAD, "0")}@${LOAD_TEST_EMAIL_DOMAIN}`;
}

/** A customer's verified phone: a claim with it needs no one-time code (the claims phone policy). */
export function loadTestCustomerPhone(index: number): string {
	return `+60109${String(index + 1).padStart(PHONE_DIGITS, "0")}`;
}

export function loadTestStaffEmail(index: number): string {
	return `staff-${String(index + 1).padStart(ZERO_PAD, "0")}@${LOAD_TEST_EMAIL_DOMAIN}`;
}

export class PrismaLoadTestTenant implements LoadTestProvisioningPort, LoadTestPurgePort {
	public constructor(
		private readonly db: Db,
		private readonly now: () => number = Date.now,
	) {}

	public async provision(input: { readonly customers: number; readonly passwordHash: string }): Promise<ProvisionedLoadTestTenant> {
		const tenant = await this.db.tenant.upsert({
			where: { slug: LOAD_TEST_TENANT_SLUG },
			update: {},
			create: { slug: LOAD_TEST_TENANT_SLUG, displayName: LOAD_TEST_TENANT_NAME, lifecycleState: "ACTIVE", isLoadTest: true },
		});
		await this.db.tenantMerchantProfile.upsert({
			where: { tenantId: tenant.id },
			update: {},
			create: {
				tenantId: tenant.id,
				legalName: LOAD_TEST_TENANT_NAME,
				category: "cafe",
				city: "KUALA_LUMPUR",
				kybStatus: "APPROVED",
				contactEmail: `ops@${LOAD_TEST_EMAIL_DOMAIN}`,
			},
		});
		const location =
			(await this.db.location.findFirst({ where: { tenantId: tenant.id, code: STORE_CODE } })) ??
			(await this.db.location.create({ data: { tenantId: tenant.id, name: "Load Test store", code: STORE_CODE, city: "KUALA_LUMPUR", status: "ACTIVE", isPrimary: true } }));
		const roles = new TenantRoleCopies(this.db);
		await roles.provision(tenant.id, null);

		const customerEmails: string[] = Array.from({ length: input.customers }, (_unused, index) => loadTestCustomerEmail(index));
		const staffEmails: string[] = Array.from({ length: LOAD_TEST_STAFF_COUNT }, (_unused, index) => loadTestStaffEmail(index));
		const verifiedAt = BigInt(this.now());
		await this.db.user.createMany({
			data: [
				...customerEmails.map((email, index) => ({ email, fullName: "Load-test customer", phone: loadTestCustomerPhone(index), phoneVerifiedAt: verifiedAt })),
				...staffEmails.map((email) => ({ email, fullName: "Load-test staff", phone: null, phoneVerifiedAt: null })),
			].map((user) => ({ ...user, passwordHash: input.passwordHash, isActive: true, isLoadTestUser: true, emailVerifiedAt: verifiedAt })),
			skipDuplicates: true,
		});
		// Every customer has accepted the reward terms, as a real one has before claiming.
		const customers = await this.db.user.findMany({ where: { email: { in: customerEmails } }, select: { id: true } });
		const accepted = await this.db.rewardLegalAcceptance.findMany({
			where: { userId: { in: customers.map((customer) => customer.id) }, isDeleted: false },
			select: { userId: true },
		});
		const acceptedIds = new Set<string>(accepted.map((row) => row.userId));
		await this.db.rewardLegalAcceptance.createMany({
			data: customers
				.filter((customer) => !acceptedIds.has(customer.id))
				.map((customer) => ({ userId: customer.id, termsVersion: LOAD_TEST_LEGAL_VERSION, privacyVersion: LOAD_TEST_LEGAL_VERSION, acceptedAt: verifiedAt })),
		});
		// One fresh password for every load-test user (and never a lockout carried over from a run).
		await this.db.user.updateMany({
			where: { isLoadTestUser: true, email: { endsWith: `@${LOAD_TEST_EMAIL_DOMAIN}` } },
			data: { passwordHash: input.passwordHash, failedLoginAttempts: 0, lockedUntil: null, isActive: true },
		});

		const staff = await this.db.user.findMany({ where: { email: { in: staffEmails } }, select: { id: true, email: true } });
		const managerRoleId: string = await roles.roleIdFor(tenant.id, "MANAGER");
		for (const member of staff) {
			const existing = await this.db.membership.findFirst({ where: { tenantId: tenant.id, userId: member.id, isDeleted: false } });
			if (existing === null) {
				const membership = await this.db.membership.create({ data: { tenantId: tenant.id, userId: member.id, roleId: managerRoleId, role: "MANAGER", status: "ACTIVE" } });
				await this.db.membershipLocationScope.create({ data: { tenantId: tenant.id, membershipId: membership.id, scopeType: "ALL_LOCATIONS" } });
			}
		}

		const published = await this.db.reward.count({ where: { tenantId: tenant.id, status: "PUBLISHED", createdBy: null, isDeleted: false } });
		const expiry = BigInt(this.now() + REWARD_LIFETIME_MS);
		for (let index = published; index < LOAD_TEST_REWARD_COUNT; index += 1) {
			const reward = await this.db.reward.create({
				data: {
					tenantId: tenant.id,
					title: `Load-test reward ${String(index + 1)}`,
					description: "A reward the load-test scenarios browse and claim.",
					rewardType: "DISCOUNT",
					rewardValue: LOAD_TEST_REWARD_VALUE,
					rewardKind: "CONSUMER",
					category: "cafe",
					quantityTotal: LOAD_TEST_REWARD_QUANTITY,
					quantityRemaining: LOAD_TEST_REWARD_QUANTITY,
					quantityReserved: 0,
					expiryDate: expiry,
					status: "PUBLISHED",
					claimCount: 0,
					redemptionCount: 0,
					referralsEnabled: false,
					locationScopeType: "SELECTED",
				},
			});
			await this.db.rewardLocationScope.create({ data: { tenantId: tenant.id, rewardId: reward.id, locationId: location.id } });
		}
		return { tenantId: tenant.id, tenantSlug: tenant.slug, customerEmails, customerPhones: customerEmails.map((_email, index) => loadTestCustomerPhone(index)), staffEmails };
	}

	public async loadTestUserCount(): Promise<number> {
		return this.db.user.count({ where: { isLoadTestUser: true, isDeleted: false } });
	}

	public async purge(): Promise<LoadTestPurgeResult> {
		const tenant = await this.db.tenant.findFirst({ where: { slug: LOAD_TEST_TENANT_SLUG, isLoadTest: true } });
		const users = await this.db.user.findMany({ where: { isLoadTestUser: true }, select: { id: true } });
		const userIds: string[] = users.map((user) => user.id);
		const tenantId: string | null = tenant?.id ?? null;
		const tables: { table: string; rows: number }[] = [];
		const record = async (table: string, work: Promise<{ readonly count: number }>): Promise<void> => {
			tables.push({ table, rows: (await work).count });
		};
		// The rewards the merchant scenarios created (provisioned rewards have no creator).
		const createdRewards = tenantId === null ? [] : await this.db.reward.findMany({ where: { tenantId, createdBy: { in: userIds } }, select: { id: true } });
		const createdRewardIds: string[] = createdRewards.map((reward) => reward.id);
		const claims = await this.db.rewardClaim.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
		const claimIds: string[] = claims.map((claim) => claim.id);

		await record("RewardRedemption", this.db.rewardRedemption.deleteMany({ where: { OR: [{ claimId: { in: claimIds } }, ...(tenantId === null ? [] : [{ tenantId }])] } }));
		await record("RewardSale", this.db.rewardSale.deleteMany({ where: tenantId === null ? { userId: { in: userIds } } : { tenantId } }));
		await record("RewardOtpChallenge", this.db.rewardOtpChallenge.deleteMany({ where: { userId: { in: userIds } } }));
		await record("RewardNotification", this.db.rewardNotification.deleteMany({ where: { userId: { in: userIds } } }));
		await record("RewardClaim", this.db.rewardClaim.deleteMany({ where: { id: { in: claimIds } } }));
		await record("RewardAuditLog", this.db.rewardAuditLog.deleteMany({ where: { actorUserId: { in: userIds } } }));
		await record("RewardImage", this.db.rewardImage.deleteMany({ where: { rewardId: { in: createdRewardIds } } }));
		await record("RewardLocationScope", this.db.rewardLocationScope.deleteMany({ where: { rewardId: { in: createdRewardIds } } }));
		await record("Reward", this.db.reward.deleteMany({ where: { id: { in: createdRewardIds } } }));
		await record("RefreshToken", this.db.refreshToken.deleteMany({ where: { userId: { in: userIds } } }));
		await record("TwoFactorLoginChallenge", this.db.twoFactorLoginChallenge.deleteMany({ where: { userId: { in: userIds } } }));
		if (tenantId !== null) {
			// The provisioned rewards' counters go back to a full stock.
			await this.db.reward.updateMany({
				where: { tenantId, createdBy: null },
				data: { quantityRemaining: LOAD_TEST_REWARD_QUANTITY, quantityReserved: 0, claimCount: 0, redemptionCount: 0 },
			});
		}
		return { deletedRows: tables.reduce((total, entry) => total + entry.rows, 0), tables };
	}
}

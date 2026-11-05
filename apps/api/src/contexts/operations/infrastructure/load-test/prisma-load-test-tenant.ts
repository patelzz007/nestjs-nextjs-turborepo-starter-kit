// ============================================
// infrastructure/load-test/prisma-load-test-tenant.ts — provisioning and purging the Load Test tenant
// ============================================
// Design patterns:
//   - ADAPTER for `LoadTestProvisioningPort` and `LoadTestPurgePort` on the caller's transaction.
//   - Idempotent provisioning: fixed slug and e-mail patterns, upserts and `createMany(skipDuplicates)`,
//     so a second call changes only the password and adds what is missing (customers, staff, rewards).
//   - A provisioned reward is marked in `Reward.metadata` with its slot (1…LOAD_TEST_REWARD_COUNT):
//     nothing else writes that column (no API accepts it), so the mark survives anything a run or
//     the audit capture does to the row — unlike `createdBy`, which the data-change capture fills.
//   - Every provisioned reward shows the tenant's READY load-test picture, locked through the files
//     context's `FileReferencePort` as a reward save locks its images: a published reward always
//     shows at least one READY image (the reward responses rely on it).
//   - The purge deletes in foreign-key order (children first) and reports what it removed. It is the
//     one hard delete in the platform (ADR 068, exception 2), confined by `WHERE` to the Load Test
//     tenant and its load-test users. It keeps the provisioned rewards and their picture rows, so the
//     picture stays in use (the files context refuses to delete an image a live reward shows).

import type { Prisma } from "@prisma/client";
import type { LoadTestPurgeResult } from "@workspace/shared";
import { z } from "zod";

import { TenantRoleCopies } from "../../../authorization/public-api";
import { createFilesTransactionalPorts, type FileReferencePort } from "../../../files/public-api";
import type { LoadTestProvisioningPort, LoadTestProvisionRequest, LoadTestPurgePort, ProvisionedLoadTestTenant } from "../../application/ports/load-test-tenant.port";

type Db = Prisma.TransactionClient;

/** The tenant's role copies, on the same transaction (authorization's `TenantRoleCopies`). */
export type LoadTestTenantRoles = Pick<TenantRoleCopies, "provision" | "roleIdFor">;

/** The Load Test tenant's fixed identity. */
export const LOAD_TEST_TENANT_SLUG = "load-test";
const LOAD_TEST_TENANT_NAME = "Load Test";
/** Load-test users' addresses: `.invalid` (RFC 2606) can never be delivered to, even by mistake. */
export const LOAD_TEST_EMAIL_DOMAIN = "loadtest.invalid";
/** Published rewards the customer scenarios browse and claim. */
export const LOAD_TEST_REWARD_COUNT = 10;
/** Each reward's stock: more than any run can claim. */
const LOAD_TEST_REWARD_QUANTITY = 1_000_000_000;
/** The rewards' face value (RM 5.00, in sen). */
const LOAD_TEST_REWARD_VALUE = 500;
/** A reward's first image is its cover. */
const COVER_POSITION = 0;
const ZERO_PAD = 4;
const PHONE_DIGITS = 7;
/** The legal versions recorded on a load-test customer's acceptance (any version counts for a claim). */
const LOAD_TEST_LEGAL_VERSION = "load-test";
const STORE_CODE = "LOADTEST-1";
/** Rewards stay claimable for ten years from provisioning. */
const REWARD_LIFETIME_MS = 10 * 365 * 24 * 3_600_000;

/** The `Reward.metadata` key that marks a provisioned reward, holding its slot. */
const PROVISIONED_SLOT_KEY = "loadTestRewardSlot";
const FIRST_SLOT = 1;
/** A provisioned reward's metadata: exactly its slot. */
const ProvisionedRewardMetadataSchema = z.object({ [PROVISIONED_SLOT_KEY]: z.number().int().min(FIRST_SLOT).max(LOAD_TEST_REWARD_COUNT) });
/** Selects the rewards that carry the mark (the slot is validated again on read). */
const PROVISIONED_MARK = { path: [PROVISIONED_SLOT_KEY], gte: FIRST_SLOT } satisfies Prisma.JsonNullableFilter<"Reward">;

/** The metadata a provisioned reward is created with. */
export function provisionedRewardMetadata(slot: number): Prisma.JsonObject {
	return { [PROVISIONED_SLOT_KEY]: slot };
}

/** The slot of a provisioned reward, or `null` for any other reward. */
export function provisionedRewardSlot(metadata: Prisma.JsonValue): number | null {
	const parsed = ProvisionedRewardMetadataSchema.safeParse(metadata);
	return parsed.success ? parsed.data[PROVISIONED_SLOT_KEY] : null;
}

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

/** The picture handed to `provision` is not a READY reward image of the Load Test tenant (deleted, or never one). */
export class LoadTestRewardImageUnusableError extends Error {
	public constructor(public readonly fileId: string) {
		super(`Load-test reward picture ${fileId} is not a READY reward image of the Load Test tenant`);
		this.name = "LoadTestRewardImageUnusableError";
	}
}

/** The provisioner on `db`, with the files and authorization ports bound to the same transaction. */
export function createPrismaLoadTestTenant(db: Db): PrismaLoadTestTenant {
	return new PrismaLoadTestTenant(db, createFilesTransactionalPorts(db).fileReferences, new TenantRoleCopies(db));
}

export class PrismaLoadTestTenant implements LoadTestProvisioningPort, LoadTestPurgePort {
	public constructor(
		private readonly db: Db,
		private readonly files: FileReferencePort,
		private readonly roles: LoadTestTenantRoles,
		private readonly now: () => number = Date.now,
	) {}

	public async ensureTenant(): Promise<string> {
		return (await this.upsertTenant()).id;
	}

	public async provision(input: LoadTestProvisionRequest): Promise<ProvisionedLoadTestTenant> {
		const tenant = await this.upsertTenant();
		const location =
			(await this.db.location.findFirst({ where: { tenantId: tenant.id, code: STORE_CODE, isDeleted: false } })) ??
			(await this.db.location.create({ data: { tenantId: tenant.id, name: "Load Test store", code: STORE_CODE, city: "KUALA_LUMPUR", status: "ACTIVE", isPrimary: true } }));
		await this.roles.provision(tenant.id, null);

		const customerEmails: string[] = Array.from({ length: input.customers }, (_unused, index) => loadTestCustomerEmail(index));
		const staffEmails: string[] = Array.from({ length: input.staff }, (_unused, index) => loadTestStaffEmail(index));
		const verifiedAt = BigInt(this.now());
		await this.db.user.createMany({
			data: [
				...customerEmails.map((email, index) => ({ email, fullName: "Load-test customer", phone: loadTestCustomerPhone(index), phoneVerifiedAt: verifiedAt })),
				...staffEmails.map((email) => ({ email, fullName: "Load-test staff", phone: null, phoneVerifiedAt: null })),
			].map((user) => ({ ...user, passwordHash: input.passwordHash, isActive: true, isLoadTestUser: true, emailVerifiedAt: verifiedAt })),
			skipDuplicates: true,
		});
		// Every customer has accepted the reward terms, as a real one has before claiming.
		const customers = await this.db.user.findMany({ where: { email: { in: customerEmails }, isDeleted: false }, select: { id: true } });
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
			where: { isLoadTestUser: true, isDeleted: false, email: { endsWith: `@${LOAD_TEST_EMAIL_DOMAIN}` } },
			data: { passwordHash: input.passwordHash, failedLoginAttempts: 0, lockedUntil: null, isActive: true },
		});

		const staff = await this.db.user.findMany({ where: { email: { in: staffEmails }, isDeleted: false }, select: { id: true, email: true } });
		const managerRoleId: string = await this.roles.roleIdFor(tenant.id, "MANAGER");
		for (const member of staff) {
			const existing = await this.db.membership.findFirst({ where: { tenantId: tenant.id, userId: member.id, isDeleted: false } });
			if (existing === null) {
				const membership = await this.db.membership.create({ data: { tenantId: tenant.id, userId: member.id, roleId: managerRoleId, role: "MANAGER", status: "ACTIVE" } });
				await this.db.membershipLocationScope.create({ data: { tenantId: tenant.id, membershipId: membership.id, scopeType: "ALL_LOCATIONS" } });
			}
		}

		await this.provisionRewards(tenant.id, location.id, input.rewardImageFileId);
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
		// The tenant holds load-test data only: every reward but the live provisioned ones was made by a
		// load test (a scenario, or a provisioning run from before the rewards were marked).
		const rewards = tenantId === null ? [] : await this.db.reward.findMany({ where: { tenantId }, select: { id: true, isDeleted: true, metadata: true } });
		const keptRewardIds: string[] = rewards.filter((reward) => !reward.isDeleted && provisionedRewardSlot(reward.metadata) !== null).map((reward) => reward.id);
		const kept = new Set<string>(keptRewardIds);
		const createdRewardIds: string[] = rewards.filter((reward) => !kept.has(reward.id)).map((reward) => reward.id);
		const claims = await this.db.rewardClaim.findMany({ where: { userId: { in: userIds } }, select: { id: true } });
		const claimIds: string[] = claims.map((claim) => claim.id);

		await record("RewardRedemption", this.db.rewardRedemption.deleteMany({ where: { OR: [{ claimId: { in: claimIds } }, ...(tenantId === null ? [] : [{ tenantId }])] } }));
		await record("RewardSale", this.db.rewardSale.deleteMany({ where: tenantId === null ? { userId: { in: userIds } } : { tenantId } }));
		await record("RewardOtpChallenge", this.db.rewardOtpChallenge.deleteMany({ where: { userId: { in: userIds } } }));
		await record("RewardNotification", this.db.rewardNotification.deleteMany({ where: { userId: { in: userIds } } }));
		await record("RewardClaim", this.db.rewardClaim.deleteMany({ where: { id: { in: claimIds } } }));
		await record("RewardAuditLog", this.db.rewardAuditLog.deleteMany({ where: { actorUserId: { in: userIds } } }));
		// Only the deleted rewards' image rows: the provisioned rewards keep showing the picture.
		await record("RewardImage", this.db.rewardImage.deleteMany({ where: { rewardId: { in: createdRewardIds } } }));
		await record("RewardLocationScope", this.db.rewardLocationScope.deleteMany({ where: { rewardId: { in: createdRewardIds } } }));
		await record("Reward", this.db.reward.deleteMany({ where: { id: { in: createdRewardIds } } }));
		await record("RefreshToken", this.db.refreshToken.deleteMany({ where: { userId: { in: userIds } } }));
		await record("TwoFactorLoginChallenge", this.db.twoFactorLoginChallenge.deleteMany({ where: { userId: { in: userIds } } }));
		if (keptRewardIds.length > 0) {
			// The provisioned rewards' counters go back to a full stock.
			await this.db.reward.updateMany({
				where: { id: { in: keptRewardIds } },
				data: { quantityRemaining: LOAD_TEST_REWARD_QUANTITY, quantityReserved: 0, claimCount: 0, redemptionCount: 0 },
			});
		}
		return { deletedRows: tables.reduce((total, entry) => total + entry.rows, 0), tables };
	}

	private async upsertTenant(): Promise<{ readonly id: string; readonly slug: string }> {
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
		return tenant;
	}

	/**
	 * Creates the provisioned rewards missing a slot, then gives every provisioned reward without a
	 * live image the picture as its cover — new ones, and ones from before the picture existed — in
	 * this transaction, so no published reward is ever seen without one.
	 */
	private async provisionRewards(tenantId: string, locationId: string, imageFileId: string): Promise<void> {
		await this.lockUsablePicture(tenantId, imageFileId);
		const marked = await this.db.reward.findMany({ where: { tenantId, isDeleted: false, metadata: PROVISIONED_MARK }, select: { id: true, metadata: true } });
		const provisioned = marked.flatMap((reward) => {
			const slot = provisionedRewardSlot(reward.metadata);
			return slot === null ? [] : [{ id: reward.id, slot }];
		});
		const takenSlots = new Set<number>(provisioned.map((reward) => reward.slot));
		const expiry = BigInt(this.now() + REWARD_LIFETIME_MS);
		const rewardIds: string[] = provisioned.map((reward) => reward.id);
		for (let slot = FIRST_SLOT; slot <= LOAD_TEST_REWARD_COUNT; slot += 1) {
			if (takenSlots.has(slot)) {
				continue;
			}
			const reward = await this.db.reward.create({
				data: {
					tenantId,
					title: `Load-test reward ${String(slot)}`,
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
					metadata: provisionedRewardMetadata(slot),
				},
			});
			await this.db.rewardLocationScope.create({ data: { tenantId, rewardId: reward.id, locationId } });
			rewardIds.push(reward.id);
		}
		const pictured = await this.db.rewardImage.findMany({ where: { rewardId: { in: rewardIds }, isDeleted: false }, select: { rewardId: true } });
		const withImage = new Set<string>(pictured.map((image) => image.rewardId));
		const missing: string[] = rewardIds.filter((rewardId) => !withImage.has(rewardId));
		if (missing.length > 0) {
			await this.db.rewardImage.createMany({ data: missing.map((rewardId) => ({ tenantId, rewardId, fileId: imageFileId, position: COVER_POSITION })) });
		}
	}

	/** Locks the picture as a reward save locks its images (a concurrent delete waits), and requires a READY reward image of this tenant. */
	private async lockUsablePicture(tenantId: string, fileId: string): Promise<void> {
		const locked = await this.files.lockForBinding({ category: "REWARD_IMAGE", tenantId, uploadedById: null, fileIds: [fileId] });
		if (!locked.some((file) => file.id === fileId && file.status === "READY")) {
			throw new LoadTestRewardImageUnusableError(fileId);
		}
	}
}

import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createTestTypedConfig } from "../../../../../../e2e/support/test-api-env";
import { PrismaService } from "../../../../../prisma/prisma.service";
import type { BindableFile, FileBindingRequest, FileReferencePort } from "../../../../files/public-api";
import type { LoadTestProvisionRequest } from "../../../application/ports/load-test-tenant.port";
import {
	LOAD_TEST_REWARD_COUNT,
	LoadTestRewardImageUnusableError,
	PrismaLoadTestTenant,
	loadTestStaffEmail,
	provisionedRewardMetadata,
	provisionedRewardSlot,
	type LoadTestTenantRoles,
} from "../prisma-load-test-tenant";

vi.mock("../../../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

const NOW = 1_800_000_000_000;
const TENANT_ID = "019a0000-0000-7000-8000-000000000001";
const LOCATION_ID = "019a0000-0000-7000-8000-000000000002";
const PICTURE_ID = "019a0000-0000-7000-8000-000000000003";
const OPERATOR_ID = "019a0000-0000-7000-8000-000000000004";
const MANAGER_ROLE_ID = "019a0000-0000-7000-8000-000000000005";
const SLOTS: number[] = Array.from({ length: LOAD_TEST_REWARD_COUNT }, (_unused, index) => index + 1);

/** One `Reward` row as the fake database holds it. */
interface RewardRow {
	readonly id: string;
	readonly tenantId: string;
	readonly isDeleted: boolean;
	readonly createdBy: string | null;
	readonly metadata: Prisma.JsonValue;
}

/** One `RewardImage` row. */
interface RewardImageRow {
	readonly tenantId: string;
	readonly rewardId: string;
	readonly fileId: string;
	readonly position: number;
}

function reward(id: string, overrides: Partial<RewardRow> = {}): RewardRow {
	return { id, tenantId: TENANT_ID, isDeleted: false, createdBy: OPERATOR_ID, metadata: null, ...overrides };
}

/** The ten rewards an earlier run provisioned — each with the operator as its creator, as the audit capture records it. */
function provisionedRewards(): RewardRow[] {
	return SLOTS.map((slot) => reward(`provisioned-${String(slot)}`, { metadata: provisionedRewardMetadata(slot) }));
}

/** Whether the fake row matches the subset of a `where` the provisioner uses (tenant, live, the provisioned mark). */
function matches(row: RewardRow, where: Prisma.RewardWhereInput | undefined): boolean {
	return (
		(where?.tenantId === undefined || where.tenantId === row.tenantId) &&
		(where?.isDeleted === undefined || where.isDeleted === row.isDeleted) &&
		(where?.metadata === undefined || provisionedRewardSlot(row.metadata) !== null)
	);
}

const InFilterSchema = z.object({ in: z.array(z.string()) });
/** What the provisioner writes into `Reward.metadata` (numbers only), read back as the row's JSON. */
const WrittenMetadataSchema = z.object({}).catchall(z.number()).nullable();

/** The values an `{ in: [...] }` filter names (none for any other filter). */
function valuesIn(filter: Prisma.StringFilter<"User"> | Prisma.StringFilter<"Reward"> | Prisma.StringFilter<"RewardImage"> | string | undefined): readonly string[] {
	const parsed = InFilterSchema.safeParse(filter);
	return parsed.success ? parsed.data.in : [];
}

/** A transaction client over in-memory reward rows; every other table answers what a fresh Load Test tenant would. */
class FakeLoadTestDatabase {
	public readonly rewards: RewardRow[];
	public readonly images: RewardImageRow[];
	public readonly createdUsers: string[] = [];
	public readonly storedFileTouched = vi.fn();
	public readonly rewardUpdates: Prisma.RewardUpdateManyArgs[] = [];
	public readonly rewardDeletes: Prisma.RewardDeleteManyArgs[] = [];
	public readonly imageDeletes: Prisma.RewardImageDeleteManyArgs[] = [];
	public readonly tx: PrismaService;
	private created = 0;

	public constructor(rewards: readonly RewardRow[] = [], images: readonly RewardImageRow[] = []) {
		this.rewards = [...rewards];
		this.images = [...images];
		const deleted = vi.fn().mockResolvedValue({ count: 0 });
		this.tx = Object.assign(new PrismaService(createTestTypedConfig()), {
			tenant: {
				upsert: vi.fn().mockResolvedValue({ id: TENANT_ID, slug: "load-test" }),
				findFirst: vi.fn().mockResolvedValue({ id: TENANT_ID, slug: "load-test" }),
			},
			tenantMerchantProfile: { upsert: vi.fn().mockResolvedValue({}) },
			location: { findFirst: vi.fn().mockResolvedValue({ id: LOCATION_ID }), create: vi.fn() },
			user: {
				createMany: vi.fn((args: Prisma.UserCreateManyArgs) => {
					for (const user of [args.data].flat()) {
						this.createdUsers.push(user.email);
					}
					return Promise.resolve({ count: this.createdUsers.length });
				}),
				findMany: vi.fn((args: Prisma.UserFindManyArgs) => Promise.resolve(valuesIn(args.where?.email).map((email) => ({ id: `user-${email}`, email })))),
				updateMany: vi.fn().mockResolvedValue({ count: 0 }),
				count: vi.fn().mockResolvedValue(0),
			},
			rewardLegalAcceptance: { findMany: vi.fn().mockResolvedValue([]), createMany: vi.fn().mockResolvedValue({ count: 0 }) },
			membership: {
				findFirst: vi.fn().mockResolvedValue(null),
				create: vi.fn().mockResolvedValue({ id: "membership" }),
			},
			membershipLocationScope: { create: vi.fn().mockResolvedValue({}) },
			reward: {
				findMany: vi.fn((args: Prisma.RewardFindManyArgs) => Promise.resolve(this.rewards.filter((row) => matches(row, args.where)))),
				create: vi.fn((args: Prisma.RewardCreateArgs) => {
					this.created += 1;
					const row = reward(`created-${String(this.created)}`, { metadata: WrittenMetadataSchema.parse(args.data.metadata ?? null) });
					this.rewards.push(row);
					return Promise.resolve(row);
				}),
				updateMany: vi.fn((args: Prisma.RewardUpdateManyArgs) => {
					this.rewardUpdates.push(args);
					return Promise.resolve({ count: valuesIn(args.where?.id).length });
				}),
				deleteMany: vi.fn((args: Prisma.RewardDeleteManyArgs) => {
					this.rewardDeletes.push(args);
					return Promise.resolve({ count: valuesIn(args.where?.id).length });
				}),
			},
			rewardLocationScope: { create: vi.fn().mockResolvedValue({}), deleteMany: deleted },
			rewardImage: {
				findMany: vi.fn((args: Prisma.RewardImageFindManyArgs) => {
					const ids = new Set<string>(valuesIn(args.where?.rewardId));
					return Promise.resolve(this.images.filter((image) => ids.has(image.rewardId)));
				}),
				createMany: vi.fn((args: Prisma.RewardImageCreateManyArgs) => {
					const rows = [args.data].flat();
					for (const row of rows) {
						this.images.push({ tenantId: row.tenantId, rewardId: row.rewardId, fileId: row.fileId, position: row.position });
					}
					return Promise.resolve({ count: rows.length });
				}),
				deleteMany: vi.fn((args: Prisma.RewardImageDeleteManyArgs) => {
					this.imageDeletes.push(args);
					return Promise.resolve({ count: 0 });
				}),
			},
			rewardClaim: { findMany: vi.fn().mockResolvedValue([]), deleteMany: deleted },
			rewardRedemption: { deleteMany: deleted },
			rewardSale: { deleteMany: deleted },
			rewardOtpChallenge: { deleteMany: deleted },
			rewardClaimHold: { deleteMany: deleted },
			rewardNotification: { deleteMany: deleted },
			rewardAuditLog: { deleteMany: deleted },
			refreshToken: { deleteMany: deleted },
			twoFactorLoginChallenge: { deleteMany: deleted },
			storedFile: { deleteMany: this.storedFileTouched, updateMany: this.storedFileTouched, delete: this.storedFileTouched, update: this.storedFileTouched },
		});
	}

	/** The rewards a run would see: live, of the tenant. */
	public liveRewards(): RewardRow[] {
		return this.rewards.filter((row) => !row.isDeleted);
	}
}

/** The files context's lock: answers the picture with `status`, and records each request. */
class RecordingFileReferences implements FileReferencePort {
	public readonly requests: FileBindingRequest[] = [];

	public constructor(private readonly status: BindableFile["status"] = "READY") {}

	public lockForBinding(request: FileBindingRequest): Promise<readonly BindableFile[]> {
		this.requests.push(request);
		return Promise.resolve(
			request.fileIds.map((id) => ({
				id,
				category: "REWARD_IMAGE",
				status: this.status,
				tenantId: TENANT_ID,
				uploadedById: OPERATOR_ID,
				originalName: "load-test-reward.png",
				mimeType: "image/png",
			})),
		);
	}
}

const ROLES: LoadTestTenantRoles = { provision: () => Promise.resolve(), roleIdFor: () => Promise.resolve(MANAGER_ROLE_ID) };

function provisioner(db: FakeLoadTestDatabase, files: FileReferencePort = new RecordingFileReferences()): PrismaLoadTestTenant {
	return new PrismaLoadTestTenant(db.tx, files, ROLES, () => NOW);
}

function request(overrides: Partial<LoadTestProvisionRequest> = {}): LoadTestProvisionRequest {
	return { customers: 2, staff: 1, passwordHash: "hash", rewardImageFileId: PICTURE_ID, ...overrides };
}

describe("PrismaLoadTestTenant.provision", () => {
	it("gives every reward it publishes the READY load-test picture as its cover, locked like a reward save locks its images", async () => {
		const db = new FakeLoadTestDatabase();
		const files = new RecordingFileReferences();

		await provisioner(db, files).provision(request());

		expect(db.liveRewards()).toHaveLength(LOAD_TEST_REWARD_COUNT);
		expect(db.images).toEqual(db.liveRewards().map((row) => ({ tenantId: TENANT_ID, rewardId: row.id, fileId: PICTURE_ID, position: 0 })));
		expect(files.requests).toEqual([{ category: "REWARD_IMAGE", tenantId: TENANT_ID, uploadedById: null, fileIds: [PICTURE_ID] }]);
	});

	it("gives the picture to provisioned rewards from before it existed, and no second image to one that has it", async () => {
		const earlier = provisionedRewards();
		const [first] = earlier;
		const db = new FakeLoadTestDatabase(earlier, first === undefined ? [] : [{ tenantId: TENANT_ID, rewardId: first.id, fileId: PICTURE_ID, position: 0 }]);

		await provisioner(db).provision(request());

		expect(db.images.map((image) => image.rewardId).sort()).toEqual(earlier.map((row) => row.id).sort());
	});

	it("creates no reward when the ten are already provisioned, though the audit capture recorded a creator on each", async () => {
		const db = new FakeLoadTestDatabase(provisionedRewards());

		await provisioner(db).provision(request());
		await provisioner(db).provision(request());

		expect(db.liveRewards()).toHaveLength(LOAD_TEST_REWARD_COUNT);
		expect(new Set(db.liveRewards().map((row) => provisionedRewardSlot(row.metadata)))).toEqual(new Set(SLOTS));
	});

	it("creates only the missing slots, and counts neither a deleted provisioned reward nor an unmarked one", async () => {
		const rows = provisionedRewards().slice(1);
		const db = new FakeLoadTestDatabase([
			...rows,
			reward("deleted-slot-1", { isDeleted: true, metadata: provisionedRewardMetadata(1) }),
			reward("legacy", { createdBy: null }),
		]);

		await provisioner(db).provision(request());

		const slots = db
			.liveRewards()
			.map((row) => provisionedRewardSlot(row.metadata))
			.filter((slot) => slot !== null);
		expect(slots.sort((left, right) => left - right)).toEqual(SLOTS);
		expect(db.rewards.filter((row) => row.id.startsWith("created-"))).toHaveLength(1);
	});

	it("provisions and hands out exactly the staff accounts the run asks for", async () => {
		const db = new FakeLoadTestDatabase();

		const tenant = await provisioner(db).provision(request({ staff: 6 }));

		const staffEmails: string[] = Array.from({ length: 6 }, (_unused, index) => loadTestStaffEmail(index));
		expect(tenant.staffEmails).toEqual(staffEmails);
		expect(db.createdUsers.filter((email) => email.startsWith("staff-"))).toEqual(staffEmails);
	});

	it("refuses a picture that is not a READY reward image of the tenant before publishing anything", async () => {
		const db = new FakeLoadTestDatabase();

		await expect(provisioner(db, new RecordingFileReferences("SCANNING")).provision(request())).rejects.toBeInstanceOf(LoadTestRewardImageUnusableError);

		expect(db.rewards).toEqual([]);
		expect(db.images).toEqual([]);
	});
});

describe("PrismaLoadTestTenant.purge", () => {
	it("keeps the live provisioned rewards and their picture rows, resets their stock, and deletes every other reward of the tenant", async () => {
		const provisioned = provisionedRewards();
		const others = [
			reward("scenario-made"),
			reward("legacy-unmarked", { createdBy: null }),
			reward("deleted-provisioned", { isDeleted: true, metadata: provisionedRewardMetadata(1) }),
		];
		const db = new FakeLoadTestDatabase([...provisioned, ...others]);

		await provisioner(db).purge();

		const otherIds: string[] = others.map((row) => row.id);
		expect(db.rewardDeletes).toEqual([{ where: { id: { in: otherIds } } }]);
		expect(db.imageDeletes).toEqual([{ where: { rewardId: { in: otherIds } } }]);
		expect(db.rewardUpdates.map((update) => update.where)).toEqual([{ id: { in: provisioned.map((row) => row.id) } }]);
		expect(db.storedFileTouched).not.toHaveBeenCalled();
	});
});

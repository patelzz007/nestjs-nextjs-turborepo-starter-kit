import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { PrismaService } from "../../../prisma/prisma.service";
import { OwnProfileRepository } from "./own-profile.repository";

const USER_ID = "7d3e9a10-2b4c-4d6e-8f01-23456789abcd";
const AVATAR_FILE_ID = "1b2c3d4e-5f60-4718-89ab-cdef01234567";
const AVATAR_URL = "https://cdn.example.com/users/7d3e9a10/avatar/1b2c3d4e.png";
const CREATED_AT_MS = 1_788_000_000_000;
const UPDATED_AT_MS = 1_788_253_200_000;
const AVATAR_BOUND_AT_MS = 1_788_100_000_000;
/** `Date.now()` during each test — the `updatedAt` every write stamps. */
const FROZEN_NOW_MS = 1_790_000_000_000;

interface AvatarRow {
	readonly fileId: string;
	readonly isDeleted: boolean;
	readonly updatedAt: bigint;
	readonly file: { readonly status: string; readonly isDeleted: boolean; readonly publicPath: string | null };
}

interface UserRow {
	readonly id: string;
	readonly email: string;
	readonly fullName: string;
	readonly profileVersion: number;
	readonly createdAt: bigint;
	readonly updatedAt: bigint;
	readonly avatar: AvatarRow | null;
}

interface MockDatabase {
	row: UserRow | null;
	updatedCount: number;
	readonly findFirstArgs: object[];
	readonly updateManyArgs: object[];
}

const mocks = vi.hoisted((): MockDatabase => ({
	row: null,
	updatedCount: 0,
	findFirstArgs: [],
	updateManyArgs: [],
}));

vi.mock("../../../prisma/prisma.service", () => ({
	PrismaService: class {
		public readonly user = {
			findFirst: (args: object): Promise<UserRow | null> => {
				mocks.findFirstArgs.push(args);
				return Promise.resolve(mocks.row);
			},
			updateMany: (args: object): Promise<{ count: number }> => {
				mocks.updateManyArgs.push(args);
				return Promise.resolve({ count: mocks.updatedCount });
			},
		};
	},
}));

const LIVE_AVATAR: AvatarRow = {
	fileId: AVATAR_FILE_ID,
	isDeleted: false,
	updatedAt: BigInt(AVATAR_BOUND_AT_MS),
	file: { status: "READY", isDeleted: false, publicPath: AVATAR_URL },
};

function userRow(avatar: AvatarRow | null): UserRow {
	return {
		id: USER_ID,
		email: "user@example.com",
		fullName: "Regular User",
		profileVersion: 1,
		createdAt: BigInt(CREATED_AT_MS),
		updatedAt: BigInt(UPDATED_AT_MS),
		avatar,
	};
}

function repository(): { readonly repository: OwnProfileRepository; readonly prisma: PrismaService } {
	const prisma = new PrismaService(createTestTypedConfig());
	return { repository: new OwnProfileRepository(prisma), prisma };
}

describe("OwnProfileRepository", () => {
	beforeEach(() => {
		vi.spyOn(Date, "now").mockReturnValue(FROZEN_NOW_MS);
		mocks.row = null;
		mocks.updatedCount = 0;
		mocks.findFirstArgs.length = 0;
		mocks.updateManyArgs.length = 0;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("findLive", () => {
		it("reads only the live row of that user", async () => {
			await repository().repository.findLive(USER_ID);

			expect(mocks.findFirstArgs).toEqual([expect.objectContaining({ where: { id: USER_ID, isDeleted: false } })]);
		});

		it("returns null when the account does not exist or is soft-deleted", async () => {
			await expect(repository().repository.findLive(USER_ID)).resolves.toBeNull();
		});

		it("maps the row and its live, scanned avatar onto the profile contract", async () => {
			mocks.row = userRow(LIVE_AVATAR);

			await expect(repository().repository.findLive(USER_ID)).resolves.toEqual({
				id: USER_ID,
				email: "user@example.com",
				fullName: "Regular User",
				avatar: { fileId: AVATAR_FILE_ID, url: AVATAR_URL, updatedAt: AVATAR_BOUND_AT_MS },
				version: 1,
				createdAt: CREATED_AT_MS,
				updatedAt: UPDATED_AT_MS,
			});
		});

		it.each<[string, AvatarRow]>([
			["the avatar binding was soft-deleted", { ...LIVE_AVATAR, isDeleted: true }],
			["the avatar file was soft-deleted", { ...LIVE_AVATAR, file: { ...LIVE_AVATAR.file, isDeleted: true } }],
			["the avatar file still awaits its scan verdict", { ...LIVE_AVATAR, file: { ...LIVE_AVATAR.file, status: "SCANNING" } }],
			["the avatar file has no public URL", { ...LIVE_AVATAR, file: { ...LIVE_AVATAR.file, publicPath: null } }],
		])("reports no avatar when %s", async (situation: string, avatar: AvatarRow) => {
			mocks.row = userRow(avatar);

			const profile = await repository().repository.findLive(USER_ID);

			expect(profile?.avatar, situation).toBeNull();
		});

		it("reports no avatar when the user never uploaded one", async () => {
			mocks.row = userRow(null);

			expect((await repository().repository.findLive(USER_ID))?.avatar).toBeNull();
		});
	});

	describe("existsLive", () => {
		it("is true only for a live row", async () => {
			const { repository: profiles } = repository();
			await expect(profiles.existsLive(USER_ID)).resolves.toBe(false);

			mocks.row = userRow(null);
			await expect(profiles.existsLive(USER_ID)).resolves.toBe(true);
			expect(mocks.findFirstArgs.at(-1)).toEqual({ where: { id: USER_ID, isDeleted: false }, select: { id: true } });
		});
	});

	describe("updateIfVersionMatches (optimistic lock)", () => {
		it("updates only the live row still at the expected version, and moves the version forward", async () => {
			mocks.updatedCount = 1;
			const { repository: profiles, prisma } = repository();

			await expect(profiles.updateIfVersionMatches(prisma, USER_ID, 4, { fullName: "Jane Doe" })).resolves.toBe(true);

			expect(mocks.updateManyArgs).toEqual([
				{
					where: { id: USER_ID, isDeleted: false, profileVersion: 4 },
					data: { fullName: "Jane Doe", profileVersion: { increment: 1 }, updatedAt: FROZEN_NOW_MS },
				},
			]);
		});

		it("reports a lost race (stale version or vanished row) as false", async () => {
			mocks.updatedCount = 0;
			const { repository: profiles, prisma } = repository();

			await expect(profiles.updateIfVersionMatches(prisma, USER_ID, 4, { fullName: "Jane Doe" })).resolves.toBe(false);
		});

		it("writes no column for a field that is not being changed", async () => {
			mocks.updatedCount = 1;
			const { repository: profiles, prisma } = repository();

			await profiles.updateIfVersionMatches(prisma, USER_ID, 0, {});

			expect(mocks.updateManyArgs.at(0)).toEqual(expect.objectContaining({ data: { profileVersion: { increment: 1 }, updatedAt: FROZEN_NOW_MS } }));
		});
	});
});

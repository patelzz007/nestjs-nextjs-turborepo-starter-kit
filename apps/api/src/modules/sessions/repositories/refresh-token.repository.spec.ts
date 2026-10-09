import { LIST_SLOT_INDEX, epochMs } from "@workspace/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { PrismaService } from "../../../prisma/prisma.service";
import { REFRESH_SUPERSEDED_GRACE_MS } from "../constants/refresh-token-rotation.constants";
import { revokedBySystem, revokedByUser } from "../device/session-revoker";
import { MAX_ACTIVE_SESSIONS_PER_USER, RefreshTokenRepository } from "./refresh-token.repository";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";

interface StoredRow {
	readonly id: string;
	readonly token: string;
	readonly previousTokenHash: string | null;
	readonly isDeleted: boolean;
	readonly updatedAt: number;
}

/** The single refresh-token "table" the transaction client sees, plus a log of the writes. */
interface RepositoryMockState {
	updateManyCount: number;
	current: StoredRow | null;
	/** What `findFirst` (ownership of a non-live session) answers. */
	owned: { readonly id: string } | null;
	/** What each `findMany` answers, in call order. */
	readonly findManyResults: { readonly id: string }[][];
	readonly updateManyArgs: object[];
	readonly createArgs: object[];
	readonly findManyArgs: object[];
}

const mocks = vi.hoisted((): RepositoryMockState => ({
	updateManyCount: 0,
	current: null,
	owned: null,
	findManyResults: [],
	updateManyArgs: [],
	createArgs: [],
	findManyArgs: [],
}));

vi.mock("../../../prisma/prisma.service", () => {
	const refreshToken = {
		updateMany: (args: object): Promise<{ count: number }> => {
			mocks.updateManyArgs.push(args);
			return Promise.resolve({ count: mocks.updateManyCount });
		},
		findUnique: (): Promise<StoredRow | null> => Promise.resolve(mocks.current),
		findFirst: (): Promise<{ readonly id: string } | null> => Promise.resolve(mocks.owned),
		findMany: (args: object): Promise<{ readonly id: string }[]> => {
			mocks.findManyArgs.push(args);
			return Promise.resolve(mocks.findManyResults.shift() ?? []);
		},
		create: (args: object): Promise<object> => {
			mocks.createArgs.push(args);
			return Promise.resolve({});
		},
	};
	return {
		PrismaService: class {
			public readonly refreshToken = refreshToken;
			public readonly $transaction = async <T>(work: (tx: object) => Promise<T>): Promise<T> => work({ refreshToken });
		},
	};
});

const ROTATION_DATA = { token: "new-hash", expiresAt: epochMs(Date.now() + 60_000), lastIpAddress: null };

/** The `data` of a recorded `updateMany` (only the fields these tests read). */
const UpdateDataSchema = z.object({ data: z.looseObject({ lastActiveAt: z.number().optional() }) });

function repository(): RefreshTokenRepository {
	return new RefreshTokenRepository(new PrismaService(createTestTypedConfig()));
}

describe("RefreshTokenRepository", () => {
	beforeEach(() => {
		mocks.updateManyCount = 0;
		mocks.current = null;
		mocks.owned = null;
		mocks.findManyResults.length = 0;
		mocks.updateManyArgs.length = 0;
		mocks.createArgs.length = 0;
		mocks.findManyArgs.length = 0;
	});

	describe("rotateTokenIfHashMatches (compare-and-set)", () => {
		it("rotates and runs the caller's in-transaction write when the stored hash still matches", async () => {
			mocks.updateManyCount = 1;
			const onRotated = vi.fn<(tx: object) => Promise<void>>().mockResolvedValue(undefined);

			await expect(repository().rotateTokenIfHashMatches("rt-1", "presented-hash", ROTATION_DATA, onRotated)).resolves.toBe("rotated");

			expect(onRotated).toHaveBeenCalledTimes(1);
		});

		it("reports superseded only when the presented hash is the IMMEDIATE predecessor inside the grace window", async () => {
			mocks.current = { id: "rt-1", token: "concurrent-hash", previousTokenHash: "presented-hash", isDeleted: false, updatedAt: Date.now() };

			await expect(repository().rotateTokenIfHashMatches("rt-1", "presented-hash", ROTATION_DATA, vi.fn())).resolves.toBe("superseded");
		});

		it("reports reuse when the token moved on and the presented hash is NOT the immediate predecessor (even inside the grace window)", async () => {
			mocks.current = { id: "rt-1", token: "newest-hash", previousTokenHash: "intermediate-hash", isDeleted: false, updatedAt: Date.now() };
			const onRotated = vi.fn<(tx: object) => Promise<void>>();

			await expect(repository().rotateTokenIfHashMatches("rt-1", "presented-hash", ROTATION_DATA, onRotated)).resolves.toBe("reused");

			expect(onRotated).not.toHaveBeenCalled();
		});

		it("reports reuse when the immediate predecessor arrives after the grace window", async () => {
			mocks.current = {
				id: "rt-1",
				token: "concurrent-hash",
				previousTokenHash: "presented-hash",
				isDeleted: false,
				updatedAt: Date.now() - REFRESH_SUPERSEDED_GRACE_MS - 1_000,
			};

			await expect(repository().rotateTokenIfHashMatches("rt-1", "presented-hash", ROTATION_DATA, vi.fn())).resolves.toBe("reused");
		});

		it("reports missing for a revoked session", async () => {
			mocks.current = { id: "rt-1", token: "presented-hash", previousTokenHash: null, isDeleted: true, updatedAt: Date.now() };

			await expect(repository().rotateTokenIfHashMatches("rt-1", "presented-hash", ROTATION_DATA, vi.fn())).resolves.toBe("missing");
		});

		it("reports missing when the hash still matches but the token expired", async () => {
			mocks.current = { id: "rt-1", token: "presented-hash", previousTokenHash: null, isDeleted: false, updatedAt: Date.now() };

			await expect(repository().rotateTokenIfHashMatches("rt-1", "presented-hash", ROTATION_DATA, vi.fn())).resolves.toBe("missing");
		});
	});

	describe("rotation writes", () => {
		it("records the activity (lastActiveAt, lastIpAddress) and moves rotationVersion, leaving every device detail as it was", async () => {
			mocks.updateManyCount = 1;

			await repository().rotateTokenIfHashMatches("rt-1", "presented-hash", { ...ROTATION_DATA, lastIpAddress: "198.51.100.7" }, vi.fn().mockResolvedValue(undefined));

			const data = UpdateDataSchema.parse(mocks.updateManyArgs[LIST_SLOT_INDEX.first]).data;
			expect(data).toMatchObject({ token: "new-hash", previousTokenHash: "presented-hash", lastIpAddress: "198.51.100.7", rotationVersion: { increment: 1 } });
			expect(data.lastActiveAt).toEqual(expect.any(Number));
			for (const detail of ["clientType", "browserName", "osName", "deviceModel", "deviceName", "appVersion", "signInMethod", "ipAddress", "createdAt"]) {
				expect(data).not.toHaveProperty(detail);
			}
		});

		it("keeps the last IP when the refreshing request's IP is unknown", async () => {
			mocks.updateManyCount = 1;

			await repository().rotateTokenIfHashMatches("rt-1", "presented-hash", ROTATION_DATA, vi.fn().mockResolvedValue(undefined));

			expect(UpdateDataSchema.parse(mocks.updateManyArgs[LIST_SLOT_INDEX.first]).data).not.toHaveProperty("lastIpAddress");
		});
	});

	describe("revokeOwnSession", () => {
		it("revokes only a live session owned by the user, records deletedBy, and runs the caller's write in the same transaction", async () => {
			mocks.updateManyCount = 1;
			const withinTransaction = vi.fn<(tx: object) => Promise<void>>().mockResolvedValue(undefined);

			await expect(repository().revokeOwnSession("rt-1", "user-1", revokedByUser("user-1"), withinTransaction)).resolves.toBe("revoked");

			expect(mocks.updateManyArgs[LIST_SLOT_INDEX.first]).toMatchObject({
				where: { id: "rt-1", userId: "user-1", isDeleted: false },
				data: { isDeleted: true, deletedBy: "user-1", rotationVersion: { increment: 1 } },
			});
			expect(withinTransaction).toHaveBeenCalledTimes(1);
		});

		it("reports already_revoked (and writes nothing else) for the user's own session revoked before", async () => {
			mocks.updateManyCount = 0;
			mocks.owned = { id: "rt-1" };
			const withinTransaction = vi.fn<(tx: object) => Promise<void>>();

			await expect(repository().revokeOwnSession("rt-1", "user-1", revokedByUser("user-1"), withinTransaction)).resolves.toBe("already_revoked");

			expect(withinTransaction).not.toHaveBeenCalled();
		});

		it("reports not_found for a session of another user, or an unknown id", async () => {
			mocks.updateManyCount = 0;
			mocks.owned = null;
			const withinTransaction = vi.fn<(tx: object) => Promise<void>>();

			await expect(repository().revokeOwnSession("rt-1", "user-1", revokedByUser("user-1"), withinTransaction)).resolves.toBe("not_found");

			expect(withinTransaction).not.toHaveBeenCalled();
		});
	});

	describe("revokeAllForUsers", () => {
		it("revokes every live session of the users with the revoker as deletedBy", async () => {
			await repository().revokeAllForUsers(["user-1", "user-2"], revokedBySystem("system:rotation-reuse"));

			expect(mocks.updateManyArgs[LIST_SLOT_INDEX.first]).toMatchObject({
				where: { userId: { in: ["user-1", "user-2"] }, isDeleted: false },
				data: { isDeleted: true, deletedBy: "system:rotation-reuse" },
			});
		});

		it("writes nothing for no users", async () => {
			await repository().revokeAllForUsers([], revokedByUser("admin-1"));

			expect(mocks.updateManyArgs).toEqual([]);
		});
	});

	describe("createSession", () => {
		it("stores every device detail, the sign-in IP as the first last IP, the location and the sign-in method", async () => {
			const createdAt = epochMs(Date.now());
			await repository().createSession({
				id: "session-1",
				userId: "user-1",
				tokenHash: "digest",
				device: {
					clientType: "mobile",
					browserName: "CFNetwork",
					browserVersion: "1568",
					osName: "iOS",
					osVersion: "26.0",
					deviceType: "MOBILE",
					deviceModel: "iPhone 15 Pro",
					deviceName: "Alex’s iPhone",
					appVersion: "1.4.0",
				},
				ipAddress: "203.0.113.24",
				location: { country: "MY", region: "Selangor", city: null },
				signInMethod: "PASSWORD_TOTP_NEW_DEVICE_CODE",
				createdAt,
				expiresAt: epochMs(createdAt + 60_000),
			});

			expect(mocks.createArgs[LIST_SLOT_INDEX.first]).toEqual({
				data: {
					id: "session-1",
					userId: "user-1",
					token: "digest",
					clientType: "mobile",
					browserName: "CFNetwork",
					browserVersion: "1568",
					osName: "iOS",
					osVersion: "26.0",
					deviceType: "MOBILE",
					deviceModel: "iPhone 15 Pro",
					deviceName: "Alex’s iPhone",
					appVersion: "1.4.0",
					signInMethod: "PASSWORD_TOTP_NEW_DEVICE_CODE",
					ipAddress: "203.0.113.24",
					lastIpAddress: "203.0.113.24",
					locationCountry: "MY",
					locationRegion: "Selangor",
					locationCity: null,
					lastActiveAt: createdAt,
					expiresAt: createdAt + 60_000,
					createdAt,
					updatedAt: createdAt,
				},
			});
		});
	});

	describe("retireStaleSessions (the sweep at sign-in)", () => {
		it("retires expired live sessions as system:expired-cleanup, then the oldest beyond the cap as system:session-limit", async () => {
			mocks.findManyResults.push([{ id: "expired-1" }], [{ id: "oldest-1" }]);

			await expect(repository().retireStaleSessions("user-1")).resolves.toEqual(["expired-1", "oldest-1"]);

			expect(mocks.updateManyArgs).toMatchObject([
				{ where: { id: { in: ["expired-1"] }, isDeleted: false }, data: { isDeleted: true, deletedBy: "system:expired-cleanup" } },
				{ where: { id: { in: ["oldest-1"] }, isDeleted: false }, data: { isDeleted: true, deletedBy: "system:session-limit" } },
			]);
			// Only live sessions are considered — a revoked session keeps the deletedBy it has.
			expect(mocks.findManyArgs).toMatchObject([
				{ where: { userId: "user-1", isDeleted: false } },
				{ where: { userId: "user-1", isDeleted: false }, skip: MAX_ACTIVE_SESSIONS_PER_USER },
			]);
		});

		it("writes nothing when no session is stale", async () => {
			await expect(repository().retireStaleSessions("user-1")).resolves.toEqual([]);

			expect(mocks.updateManyArgs).toEqual([]);
		});
	});
});

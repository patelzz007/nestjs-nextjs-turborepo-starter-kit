import { LIST_SLOT_INDEX, epochMs } from "@workspace/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { REFRESH_SUPERSEDED_GRACE_MS } from "../constants/refresh-token-rotation.constants";
import { RefreshTokenRepository } from "./refresh-token.repository";
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
	readonly updateManyArgs: object[];
}

const mocks = vi.hoisted((): RepositoryMockState => ({
	updateManyCount: 0,
	current: null,
	updateManyArgs: [],
}));

vi.mock("../../../prisma/prisma.service", () => ({
	PrismaService: class {
		public readonly refreshToken = {};
		public readonly $transaction = async <T>(work: (tx: object) => Promise<T>): Promise<T> =>
			work({
				refreshToken: {
					updateMany: (args: object): Promise<{ count: number }> => {
						mocks.updateManyArgs.push(args);
						return Promise.resolve({ count: mocks.updateManyCount });
					},
					findUnique: (): Promise<StoredRow | null> => Promise.resolve(mocks.current),
				},
			});
	},
}));

const ROTATION_DATA = { token: "new-hash", deviceInfo: null, ipAddress: null, expiresAt: epochMs(Date.now() + 60_000) };

function repository(): RefreshTokenRepository {
	return new RefreshTokenRepository(new PrismaService(createTestTypedConfig()));
}

describe("RefreshTokenRepository", () => {
	beforeEach(() => {
		mocks.updateManyCount = 0;
		mocks.current = null;
		mocks.updateManyArgs.length = 0;
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

	describe("revokeLiveToken", () => {
		it("revokes only a live token owned by the user and runs the caller's write in the same transaction", async () => {
			mocks.updateManyCount = 1;
			const withinTransaction = vi.fn<(tx: object) => Promise<void>>().mockResolvedValue(undefined);

			await expect(repository().revokeLiveToken("rt-1", "user-1", withinTransaction)).resolves.toBe(true);

			expect(mocks.updateManyArgs[LIST_SLOT_INDEX.first]).toMatchObject({ where: { id: "rt-1", userId: "user-1", isDeleted: false }, data: { isDeleted: true } });
			expect(withinTransaction).toHaveBeenCalledTimes(1);
		});

		it("reports false and writes nothing else when the token is already revoked, foreign, or unknown", async () => {
			mocks.updateManyCount = 0;
			const withinTransaction = vi.fn<(tx: object) => Promise<void>>();

			await expect(repository().revokeLiveToken("rt-1", "user-1", withinTransaction)).resolves.toBe(false);

			expect(withinTransaction).not.toHaveBeenCalled();
		});
	});
});

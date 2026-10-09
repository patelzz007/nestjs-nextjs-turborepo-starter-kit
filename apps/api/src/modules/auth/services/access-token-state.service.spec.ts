import { UnauthorizedException } from "@nestjs/common";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { PrismaService } from "../../../prisma/prisma.service";

import { AccessTokenStateService, REVOKED_SESSION_LOOKBACK_MARGIN_MS } from "./access-token-state.service";
import { TypedConfigService } from "../../../config/typed-config.service";
import { createTestApiConfig, createTestTypedConfig } from "../../../../test/support/test-api-env";

const mocks = vi.hoisted(() => ({
	userFindUnique: vi.fn(),
	userUpdate: vi.fn(),
}));

vi.mock("../../../config/typed-config.service", () => ({
	TypedConfigService: class {
		public readonly caches = { accessTokenStateTtlMs: 30_000, accessTokenStateMaxEntries: 50_000 };
		public readonly auth = { jwtAccessExpiry: "15m" };
	},
}));

vi.mock("../../../prisma/prisma.service", () => ({
	PrismaService: class {
		public readonly user = { findUnique: mocks.userFindUnique, update: mocks.userUpdate };
	},
}));

describe("AccessTokenStateService", () => {
	let service: AccessTokenStateService;

	const userId = "user-1";
	const accountState = {
		tokenVersion: 3,
		isActive: true,
		isDeleted: false,
		refreshTokens: [{ id: "session-revoked" }],
	};
	/** `JWT_ACCESS_EXPIRY` of the mocked config ("15m"). */
	const ACCESS_TOKEN_LIFETIME_MS = 15 * 60 * 1000;

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.userFindUnique.mockResolvedValue(accountState);
		service = new AccessTokenStateService(new PrismaService(createTestTypedConfig()), new TypedConfigService(createTestApiConfig()));
	});

	it("uses the cache on a second validation for the same user", async () => {
		await service.assertTokenValid(userId, 3);
		await service.assertTokenValid(userId, 3);

		expect(mocks.userFindUnique).toHaveBeenCalledTimes(1);
	});

	it("throws TOKEN_VERSION_MISMATCH when the JWT version is stale", async () => {
		await expect(service.assertTokenValid(userId, 2)).rejects.toMatchObject({
			response: {
				error: "TOKEN_VERSION_MISMATCH",
			},
		});
		expect(mocks.userFindUnique).toHaveBeenCalledTimes(1);
	});

	it("invalidate clears the cache so the next check re-fetches from the database", async () => {
		await service.assertTokenValid(userId, 3);
		service.invalidate(userId);
		await service.assertTokenValid(userId, 3);

		expect(mocks.userFindUnique).toHaveBeenCalledTimes(2);
	});

	it("rejects deleted accounts before checking tokenVersion", async () => {
		mocks.userFindUnique.mockResolvedValue({
			...accountState,
			isDeleted: true,
		});

		await expect(service.assertTokenValid(userId, 3)).rejects.toBeInstanceOf(UnauthorizedException);
	});

	describe("device session (sid) revocation — ADR 034", () => {
		it("rejects a token whose device session was revoked with SESSION_REVOKED", async () => {
			await expect(service.assertTokenValid(userId, 3, "session-revoked")).rejects.toMatchObject({ response: { error: "SESSION_REVOKED" } });
		});

		it("accepts a token of a live session, and a token without sid (minted before the claim existed)", async () => {
			await expect(service.assertTokenValid(userId, 3, "session-live")).resolves.toBeUndefined();
			await expect(service.assertTokenValid(userId, 3)).resolves.toBeUndefined();
		});

		it("serves the revoked sessions from the same cache entry (no query per request)", async () => {
			await service.assertTokenValid(userId, 3, "session-live");
			await expect(service.assertTokenValid(userId, 3, "session-revoked")).rejects.toBeInstanceOf(UnauthorizedException);

			expect(mocks.userFindUnique).toHaveBeenCalledTimes(1);
		});

		it("rejects a session revoked after the state was cached once the revocation invalidated it", async () => {
			mocks.userFindUnique.mockResolvedValueOnce({ ...accountState, refreshTokens: [] });
			await service.assertTokenValid(userId, 3, "session-later-revoked");

			mocks.userFindUnique.mockResolvedValueOnce({ ...accountState, refreshTokens: [{ id: "session-later-revoked" }] });
			service.invalidate(userId);

			await expect(service.assertTokenValid(userId, 3, "session-later-revoked")).rejects.toMatchObject({ response: { error: "SESSION_REVOKED" } });
		});

		it("looks back one access-token lifetime (plus the skew margin) for revoked sessions", async () => {
			const before: number = Date.now();
			await service.assertTokenValid(userId, 3);
			const after: number = Date.now();

			const since = z
				.object({ select: z.object({ refreshTokens: z.object({ where: z.object({ isDeleted: z.literal(true), deletedAt: z.object({ gte: z.number() }) }) }) }) })
				.parse(mocks.userFindUnique.mock.lastCall?.[LIST_SLOT_INDEX.first]).select.refreshTokens.where.deletedAt.gte;
			expect(since).toBeGreaterThanOrEqual(before - ACCESS_TOKEN_LIFETIME_MS - REVOKED_SESSION_LOOKBACK_MARGIN_MS);
			expect(since).toBeLessThanOrEqual(after - ACCESS_TOKEN_LIFETIME_MS - REVOKED_SESSION_LOOKBACK_MARGIN_MS);
		});
	});
});

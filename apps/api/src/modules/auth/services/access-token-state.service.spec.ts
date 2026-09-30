import { UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TypedConfigService } from "../../../config/typed-config.service";
import { PrismaService } from "../../../prisma/prisma.service";

import { AccessTokenStateService } from "./access-token-state.service";

const mocks = vi.hoisted(() => ({
	userFindUnique: vi.fn(),
	userUpdate: vi.fn(),
}));

vi.mock("../../../config/typed-config.service", () => ({
	TypedConfigService: class {
		public readonly accessTokenStateCacheTtlMs = 30_000;
		public readonly accessTokenStateCacheMaxEntries = 50_000;
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
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.userFindUnique.mockResolvedValue(accountState);
		service = new AccessTokenStateService(new PrismaService(), new TypedConfigService());
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
});

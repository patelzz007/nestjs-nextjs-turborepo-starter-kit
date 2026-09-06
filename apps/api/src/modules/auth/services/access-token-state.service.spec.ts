import { UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../prisma/prisma.service";

import { AccessTokenStateService } from "./access-token-state.service";

describe("AccessTokenStateService", () => {
	let service: AccessTokenStateService;
	let prisma: {
		user: {
			findUnique: ReturnType<typeof vi.fn>;
			update: ReturnType<typeof vi.fn>;
		};
	};

	const userId = "user-1";
	const accountState = {
		tokenVersion: 3,
		isActive: true,
		isDeleted: false,
	};

	beforeEach(() => {
		prisma = {
			user: {
				findUnique: vi.fn().mockResolvedValue(accountState),
				update: vi.fn(),
			},
		};

		service = new AccessTokenStateService(prisma as unknown as PrismaService);
	});

	it("uses the cache on a second validation for the same user", async () => {
		await service.assertTokenValid(userId, 3);
		await service.assertTokenValid(userId, 3);

		expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
	});

	it("throws TOKEN_VERSION_MISMATCH when the JWT version is stale", async () => {
		await expect(service.assertTokenValid(userId, 2)).rejects.toMatchObject({
			response: {
				error: "TOKEN_VERSION_MISMATCH",
			},
		});
		expect(prisma.user.findUnique).toHaveBeenCalledTimes(1);
	});

	it("invalidate clears the cache so the next check re-fetches from the database", async () => {
		await service.assertTokenValid(userId, 3);
		service.invalidate(userId);
		await service.assertTokenValid(userId, 3);

		expect(prisma.user.findUnique).toHaveBeenCalledTimes(2);
	});

	it("rejects deleted accounts before checking tokenVersion", async () => {
		prisma.user.findUnique.mockResolvedValue({
			...accountState,
			isDeleted: true,
		});

		await expect(service.assertTokenValid(userId, 3)).rejects.toBeInstanceOf(UnauthorizedException);
	});
});

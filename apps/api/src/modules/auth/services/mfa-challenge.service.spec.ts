import { UnauthorizedException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TypedConfigService } from "../../../config/typed-config.service";
import type { PrismaService } from "../../../prisma/prisma.service";
import type { AccountLockoutService } from "./account-lockout.service";
import type { JwtService } from "@nestjs/jwt";

import { MfaChallengeService } from "./mfa-challenge.service";

describe("MfaChallengeService", () => {
	let service: MfaChallengeService;
	let prisma: {
		twoFactorLoginChallenge: {
			create: ReturnType<typeof vi.fn>;
			findUnique: ReturnType<typeof vi.fn>;
			update: ReturnType<typeof vi.fn>;
			updateMany: ReturnType<typeof vi.fn>;
		};
	};
	let accountLockoutService: { recordFailedAttempt: ReturnType<typeof vi.fn> };

	const challengeId = "challenge-abc";
	const userId = "user-123";
	const now = Date.now();

	beforeEach(() => {
		prisma = {
			twoFactorLoginChallenge: {
				create: vi.fn(),
				findUnique: vi.fn(),
				update: vi.fn(),
				updateMany: vi.fn(),
			},
		};
		accountLockoutService = {
			recordFailedAttempt: vi.fn().mockResolvedValue(undefined),
		};

		const jwtService = { signAsync: vi.fn(), verifyAsync: vi.fn() };
		const config = { twoFactorPendingSecret: "test-pending-secret" };

		service = new MfaChallengeService(
			prisma as unknown as PrismaService,
			jwtService as unknown as JwtService,
			config as TypedConfigService,
			accountLockoutService as unknown as AccountLockoutService,
		);
	});

	describe("createLoginChallenge", () => {
		it("creates a challenge row and returns its id", async () => {
			prisma.twoFactorLoginChallenge.create.mockResolvedValue({ id: challengeId });

			const id = await service.createLoginChallenge(userId, "login", "web", "Chrome", "127.0.0.1");

			expect(id).toBe(challengeId);
			expect(prisma.twoFactorLoginChallenge.create).toHaveBeenCalledWith({
				data: {
					userId,
					purpose: "login",
					clientType: "web",
					deviceInfo: "Chrome",
					ipAddress: "127.0.0.1",
					expiresAt: expect.any(Number),
				},
				select: { id: true },
			});
		});
	});

	describe("recordFailedAttempt", () => {
		it("consumes the challenge and records account lockout when attempts are exhausted", async () => {
			prisma.twoFactorLoginChallenge.findUnique.mockResolvedValue({
				id: challengeId,
				userId,
				clientType: "web",
				attemptCount: 4,
				maxAttempts: 5,
				consumedAt: null,
				expiresAt: BigInt(now + 60_000),
				user: {
					id: userId,
					email: "user@example.com",
					failedLoginAttempts: 0,
				},
			});
			prisma.twoFactorLoginChallenge.update.mockResolvedValue({});
			prisma.twoFactorLoginChallenge.updateMany.mockResolvedValue({ count: 1 });

			await expect(service.recordFailedAttempt(challengeId)).rejects.toBeInstanceOf(UnauthorizedException);

			expect(prisma.twoFactorLoginChallenge.update).toHaveBeenCalledWith({
				where: { id: challengeId },
				data: { attemptCount: 5 },
			});
			expect(prisma.twoFactorLoginChallenge.updateMany).toHaveBeenCalledWith({
				where: { id: challengeId, consumedAt: null },
				data: { consumedAt: expect.any(Number) },
			});
			expect(accountLockoutService.recordFailedAttempt).toHaveBeenCalledTimes(1);
		});
	});

	describe("consumeChallenge", () => {
		it("marks the challenge as consumed", async () => {
			prisma.twoFactorLoginChallenge.updateMany.mockResolvedValue({ count: 1 });

			await service.consumeChallenge(challengeId);

			expect(prisma.twoFactorLoginChallenge.updateMany).toHaveBeenCalledWith({
				where: { id: challengeId, consumedAt: null },
				data: { consumedAt: expect.any(Number) },
			});
		});
	});
});

import { UnauthorizedException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { TwoFactorLoginChallengePurpose } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { AccountLockoutService } from "./account-lockout.service";

import { MfaChallengeService } from "./mfa-challenge.service";
import { TypedConfigService } from "../../../config/typed-config.service";
import { createTestApiConfig, createTestTypedConfig } from "../../../../test/support/test-api-env";

const mocks = vi.hoisted(() => ({
	challengeCreate: vi.fn(),
	challengeFindUnique: vi.fn(),
	challengeUpdate: vi.fn(),
	challengeUpdateMany: vi.fn(),
	recordFailedAttempt: vi.fn(),
	signAsync: vi.fn(),
	verifyAsync: vi.fn(),
}));

vi.mock("../../../prisma/prisma.service", () => ({
	PrismaService: class {
		public readonly twoFactorLoginChallenge = {
			create: mocks.challengeCreate,
			findUnique: mocks.challengeFindUnique,
			update: mocks.challengeUpdate,
			updateMany: mocks.challengeUpdateMany,
		};
	},
}));

vi.mock("@nestjs/jwt", () => ({
	JwtService: class {
		public readonly signAsync = mocks.signAsync;
		public readonly verifyAsync = mocks.verifyAsync;
	},
}));

vi.mock("../../../config/typed-config.service", () => ({
	TypedConfigService: class {
		public readonly twoFactorPendingSecret = "test-pending-secret";
	},
}));

/** Resolve a typed `AccountLockoutService` stand-in from a Nest testing container (its real constructor pulls in the email stack). */
async function createAccountLockoutService(): Promise<AccountLockoutService> {
	const moduleRef = await Test.createTestingModule({
		providers: [{ provide: AccountLockoutService, useValue: { recordFailedAttempt: mocks.recordFailedAttempt } }],
	}).compile();
	return moduleRef.get(AccountLockoutService);
}

describe("MfaChallengeService", () => {
	let service: MfaChallengeService;

	const challengeId = "challenge-abc";
	const userId = "user-123";
	const now = Date.now();
	/** Login challenges live 10 minutes (MfaChallengeService's CHALLENGE_TTL_MS). */
	const CHALLENGE_TTL_MS = 10 * 60 * 1000;

	beforeEach(async () => {
		vi.clearAllMocks();
		// Freeze the clock so epoch-ms timestamps written by the service are exact.
		vi.spyOn(Date, "now").mockReturnValue(now);
		mocks.recordFailedAttempt.mockResolvedValue(undefined);

		service = new MfaChallengeService(
			new PrismaService(createTestTypedConfig()),
			new JwtService(),
			new TypedConfigService(createTestApiConfig()),
			await createAccountLockoutService(),
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("createLoginChallenge", () => {
		it("creates a challenge row and returns its id", async () => {
			mocks.challengeCreate.mockResolvedValue({ id: challengeId });

			const id = await service.createLoginChallenge(userId, TwoFactorLoginChallengePurpose.LOGIN, "web", "Chrome", "127.0.0.1");

			expect(id).toBe(challengeId);
			expect(mocks.challengeCreate).toHaveBeenCalledWith({
				data: {
					userId,
					purpose: TwoFactorLoginChallengePurpose.LOGIN,
					clientType: "web",
					deviceInfo: "Chrome",
					ipAddress: "127.0.0.1",
					expiresAt: now + CHALLENGE_TTL_MS,
				},
				select: { id: true },
			});
		});
	});

	describe("recordFailedAttempt", () => {
		it("consumes the challenge and records account lockout when attempts are exhausted", async () => {
			mocks.challengeFindUnique.mockResolvedValue({
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
			mocks.challengeUpdate.mockResolvedValue({});
			mocks.challengeUpdateMany.mockResolvedValue({ count: 1 });

			await expect(service.recordFailedAttempt(challengeId)).rejects.toBeInstanceOf(UnauthorizedException);

			expect(mocks.challengeUpdate).toHaveBeenCalledWith({
				where: { id: challengeId },
				data: { attemptCount: 5 },
			});
			expect(mocks.challengeUpdateMany).toHaveBeenCalledWith({
				where: { id: challengeId, consumedAt: null },
				data: { consumedAt: now },
			});
			expect(mocks.recordFailedAttempt).toHaveBeenCalledTimes(1);
		});
	});

	describe("consumeChallenge", () => {
		it("marks the challenge as consumed", async () => {
			mocks.challengeUpdateMany.mockResolvedValue({ count: 1 });

			await service.consumeChallenge(challengeId);

			expect(mocks.challengeUpdateMany).toHaveBeenCalledWith({
				where: { id: challengeId, consumedAt: null },
				data: { consumedAt: now },
			});
		});
	});
});

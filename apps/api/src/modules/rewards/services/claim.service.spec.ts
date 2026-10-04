import { ConflictException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { RewardClaim } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RewardCodeHasher } from "../crypto/reward-code-hasher";
import { RewardClaimRepository } from "../repositories/reward-claim.repository";
import { RewardRepository, type RewardClaimableSummary } from "../repositories/reward.repository";
import { RewardUserRepository } from "../repositories/reward-user.repository";
import { ClaimService } from "./claim.service";
import { RewardLegalService } from "./reward-legal.service";
import { RewardOtpService } from "./reward-otp.service";

vi.mock("../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

const NOW = 1_790_000_000_000;
const DAY_MS = 86_400_000;
const USER = "1c8d3b6f-7a2e-4d3f-8e4b-2a3f4e5d6c7b";
const REWARD = "2d9e4c7a-8b3f-4e5a-9f5c-3b4a5f6e7d8c";
const PHONE = "+60123456789";
const HASHER = new RewardCodeHasher({ 1: Buffer.alloc(32, 4).toString("base64") });

function reward(overrides: Partial<RewardClaimableSummary> = {}): RewardClaimableSummary {
	return { id: REWARD, title: "Free latte", expiryDate: BigInt(NOW + 30 * DAY_MS), quantityRemaining: 5, rules: null, minSpendMinor: null, ...overrides };
}

function createdClaim(): RewardClaim {
	return {
		id: "3e0f5d8b-9c4a-4f6b-8a6d-4c5b6a7f8e9d",
		userId: USER,
		rewardId: REWARD,
		referralId: null,
		redemptionTokenHash: "v1:x",
		backupCodeHash: "v1:y",
		status: "PENDING",
		isReferrerCredit: false,
		claimedAt: BigInt(NOW),
		claimExpiresAt: BigInt(NOW + 7 * DAY_MS),
		redeemedAt: null,
		isDeleted: false,
		deletedAt: null,
		createdAt: BigInt(NOW),
		updatedAt: BigInt(NOW),
	};
}

describe("ClaimService.createClaim", () => {
	let service: ClaimService;
	const rewards = { findClaimableConsumer: vi.fn<RewardRepository["findClaimableConsumer"]>() };
	const claims = { createReservedClaim: vi.fn<RewardClaimRepository["createReservedClaim"]>() };
	const users = { findAttributionById: vi.fn<RewardUserRepository["findAttributionById"]>(), findClaimCheckoutById: vi.fn<RewardUserRepository["findClaimCheckoutById"]>() };
	const legal = { hasAccepted: vi.fn<RewardLegalService["hasAccepted"]>() };

	beforeEach(async () => {
		vi.clearAllMocks();
		vi.spyOn(Date, "now").mockReturnValue(NOW);
		legal.hasAccepted.mockResolvedValue(true);
		users.findClaimCheckoutById.mockResolvedValue({ phone: PHONE, phoneVerifiedAt: BigInt(NOW - DAY_MS) });
		users.findAttributionById.mockResolvedValue({ pendingAttributionToken: "ref-token", pendingAttributionExpiresAt: BigInt(NOW + DAY_MS) });
		rewards.findClaimableConsumer.mockResolvedValue(reward());
		claims.createReservedClaim.mockResolvedValue({ kind: "created", claim: createdClaim() });

		const moduleRef = await Test.createTestingModule({
			providers: [
				ClaimService,
				{ provide: RewardRepository, useValue: rewards },
				{ provide: RewardClaimRepository, useValue: claims },
				{ provide: RewardUserRepository, useValue: users },
				{ provide: RewardLegalService, useValue: legal },
				{ provide: RewardOtpService, useValue: {} },
				{ provide: RewardCodeHasher, useValue: HASHER },
			],
		}).compile();
		service = moduleRef.get(ClaimService);
	});

	it("claims in ONE atomic repository call: keyed code hashes, the live attribution, and the per-customer limit from the rules", async () => {
		rewards.findClaimableConsumer.mockResolvedValue(reward({ rules: { maxUsePerUser: 2 } }));

		const created = await service.createClaim(USER, { rewardId: REWARD, phone: PHONE });

		const [input] = claims.createReservedClaim.mock.calls[0] ?? [];
		expect(input).toMatchObject({ userId: USER, rewardId: REWARD, maxClaimsPerUser: 2, attributionToken: "ref-token", phone: PHONE, claimedAt: NOW });
		expect(input?.backupCodeHash).toBe(HASHER.hash(created.backupCode));
	});

	it("passes no limit when the reward has none, and drops an expired attribution", async () => {
		users.findAttributionById.mockResolvedValue({ pendingAttributionToken: "ref-token", pendingAttributionExpiresAt: BigInt(NOW - 1) });

		await service.createClaim(USER, { rewardId: REWARD, phone: PHONE });

		expect(claims.createReservedClaim).toHaveBeenCalledWith(expect.objectContaining({ maxClaimsPerUser: null, attributionToken: null }));
	});

	it("answers 409 REWARD_OUT_OF_STOCK when the last unit went to a concurrent claim", async () => {
		claims.createReservedClaim.mockResolvedValue({ kind: "out_of_stock" });

		await expect(service.createClaim(USER, { rewardId: REWARD, phone: PHONE })).rejects.toBeInstanceOf(ConflictException);
		await expect(service.createClaim(USER, { rewardId: REWARD, phone: PHONE })).rejects.toMatchObject({ response: { error: "REWARD_OUT_OF_STOCK" } });
	});

	it("answers 409 CLAIM_LIMIT_REACHED when the customer already holds the maximum", async () => {
		rewards.findClaimableConsumer.mockResolvedValue(reward({ rules: { maxUsePerUser: 1 } }));
		claims.createReservedClaim.mockResolvedValue({ kind: "limit_reached", limit: 1 });

		await expect(service.createClaim(USER, { rewardId: REWARD, phone: PHONE })).rejects.toMatchObject({ response: { error: "CLAIM_LIMIT_REACHED", limit: 1 } });
	});
});

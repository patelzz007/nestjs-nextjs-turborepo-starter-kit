import { describe, expect, it, vi } from "vitest";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { PrismaService } from "../../../prisma/prisma.service";
import { RewardClaimRepository, type ReservedClaimInput } from "./reward-claim.repository";

vi.mock("../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

const CLAIM_INPUT: ReservedClaimInput = {
	userId: "user-1",
	rewardId: "reward-1",
	maxClaimsPerUser: null,
	redemptionTokenHash: "token-hash",
	backupCodeHash: "backup-hash",
	claimedAt: 1,
	claimExpiresAt: 2,
	attributionToken: null,
	phone: "+60123456789",
};

describe("RewardClaimRepository closed-store handling", () => {
	it("reserves stock only for rewards available everywhere or at a still-open ACTIVE store (a reward offered only at closed stores is out of stock)", async () => {
		const updateMany = vi.fn().mockResolvedValue({ count: 0 });
		const prisma = Object.assign(new PrismaService(createTestTypedConfig()), {
			$transaction: vi.fn(async (work: (tx: { reward: { updateMany: typeof updateMany } }) => Promise<object>) => work({ reward: { updateMany } })),
		});

		const outcome = await new RewardClaimRepository(prisma).createReservedClaim(CLAIM_INPUT);

		expect(outcome).toEqual({ kind: "out_of_stock" });
		expect(updateMany.mock.lastCall).toMatchObject([
			{ where: { OR: [{ locationScopeType: "ALL_LOCATIONS" }, { locationScopes: { some: { location: { isDeleted: false, status: "ACTIVE" } } } }] } },
		]);
	});

	it("drops closed stores from the locations a claim may be redeemed at", async () => {
		const findFirst = vi.fn().mockResolvedValue(null);
		const prisma = Object.assign(new PrismaService(createTestTypedConfig()), { rewardClaim: { findFirst } });

		await new RewardClaimRepository(prisma).findMerchantClaimByTokenHash(["hash"], "org-1");

		expect(findFirst.mock.lastCall).toMatchObject([{ include: { reward: { include: { locationScopes: { where: { location: { isDeleted: false } } } } } } }]);
	});
});

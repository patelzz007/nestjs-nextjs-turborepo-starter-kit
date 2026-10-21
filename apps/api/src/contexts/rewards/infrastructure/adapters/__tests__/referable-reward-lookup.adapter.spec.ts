import type { Prisma } from "@prisma/client";
import { epochMs } from "@workspace/shared";
import { describe, expect, it, vi } from "vitest";

import { createTestTypedConfig } from "../../../../../../test/support/test-api-env";
import { PrismaService } from "../../../../../prisma/prisma.service";
import { REWARDS_REFERABLE_REWARD_LOOKUP_FACTORY, referableRewardWhere } from "../referable-reward-lookup.adapter";

vi.mock("../../../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

const NOW = epochMs(1_800_000_000_000);

describe("referableRewardWhere", () => {
	it("matches only a live, published, in-stock, started consumer reward with referrals on", () => {
		expect(referableRewardWhere("reward-1", NOW)).toEqual({
			id: "reward-1",
			isDeleted: false,
			status: "PUBLISHED",
			rewardKind: "CONSUMER",
			referralsEnabled: true,
			quantityRemaining: { gt: 0 },
			expiryDate: { gte: BigInt(NOW) },
			OR: [{ startDate: null }, { startDate: { lte: BigInt(NOW) } }],
		});
	});
});

describe("REWARDS_REFERABLE_REWARD_LOOKUP_FACTORY", () => {
	it("answers on the caller's transaction: referable exactly when the one reward matches", async () => {
		const count = vi.fn<(args: Prisma.RewardCountArgs) => Promise<number>>().mockResolvedValueOnce(1).mockResolvedValueOnce(0);
		const tx = Object.assign(new PrismaService(createTestTypedConfig()), { reward: { count } });
		const lookup = REWARDS_REFERABLE_REWARD_LOOKUP_FACTORY.forTransaction(tx);

		expect(await lookup.isReferable("reward-1", NOW)).toBe(true);
		expect(await lookup.isReferable("reward-2", NOW)).toBe(false);
		expect(count).toHaveBeenNthCalledWith(1, { where: referableRewardWhere("reward-1", NOW) });
	});
});

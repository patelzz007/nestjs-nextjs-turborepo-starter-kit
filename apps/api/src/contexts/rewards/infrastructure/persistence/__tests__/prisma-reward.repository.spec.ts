import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi, type Mock } from "vitest";

import { createTestTypedConfig } from "../../../../../../test/support/test-api-env";
import { ConcurrentModificationError } from "../../../../../platform/infrastructure/persistence/persistence.errors";
import { PrismaService } from "../../../../../prisma/prisma.service";
import { Reward } from "../../../domain/aggregates/reward.aggregate";
import { LOADED_UPDATED_AT, NOW, REFERRER_ID, REWARD_ID, referrerRow, rewardState } from "../../../domain/__tests__/reward-state.fixture";
import { PrismaRewardRepository } from "../prisma-reward.repository";

vi.mock("../../../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

type QueryRaw = (query: TemplateStringsArray, ...values: readonly Prisma.Sql[]) => Promise<object[]>;
type UpdateMany = (args: Prisma.RewardUpdateManyArgs) => Promise<Prisma.BatchPayload>;

function database(): { readonly prisma: PrismaService; readonly queryRaw: Mock<QueryRaw>; readonly updateMany: Mock<UpdateMany> } {
	const queryRaw = vi.fn<QueryRaw>().mockResolvedValue([]);
	const updateMany = vi.fn<UpdateMany>().mockResolvedValue({ count: 1 });
	return { prisma: Object.assign(new PrismaService(createTestTypedConfig()), { $queryRaw: queryRaw, reward: { updateMany } }), queryRaw, updateMany };
}

/** A published consumer reward with a referral pool and a stocked referrer child. */
function referredReward(): Reward {
	return Reward.rehydrate(rewardState("PUBLISHED", { referrer: referrerRow("PUBLISHED"), referralsEnabled: true, referralPoolTotal: 2, referralPoolRemaining: 2 }));
}

describe("PrismaRewardRepository.lockForCheckout", () => {
	it("locks every distinct reward and its referrer child in ONE statement, ordered by id before the rows are locked", async () => {
		const db = database();

		await new PrismaRewardRepository(db.prisma).lockForCheckout(["reward-b", "reward-a", "reward-b"]);

		expect(db.queryRaw).toHaveBeenCalledOnce();
		const [strings, ...values] = db.queryRaw.mock.calls.at(0) ?? [];
		const sql = strings?.join("?").replace(/\s+/gu, " ");
		expect(sql).toContain('"referrerRewardId"');
		expect(sql).toMatch(/ORDER BY id FOR UPDATE$/u);
		expect(values.map((value) => value.values)).toEqual([
			["reward-b", "reward-a"],
			["reward-b", "reward-a"],
		]);
	});

	it("locks nothing for a checkout without rewards", async () => {
		const db = database();

		await new PrismaRewardRepository(db.prisma).lockForCheckout([]);

		expect(db.queryRaw).not.toHaveBeenCalled();
	});
});

describe("PrismaRewardRepository.save of a referral credit", () => {
	it("compare-and-sets the reward on its loaded token with a non-negative pool, then the child with non-negative stock", async () => {
		const db = database();
		const reward = referredReward();
		reward.creditReferral(NOW);

		await new PrismaRewardRepository(db.prisma).save(reward);

		const [root, child] = db.updateMany.mock.calls.map(([args]) => args);
		expect(root?.where).toMatchObject({ id: REWARD_ID, isDeleted: false, status: "PUBLISHED", updatedAt: LOADED_UPDATED_AT, referralPoolRemaining: { gte: 1 } });
		expect(root?.data).toMatchObject({ referralPoolRemaining: { increment: -1 }, updatedAt: NOW });
		expect(child?.where).toMatchObject({ id: REFERRER_ID, isDeleted: false, status: "PUBLISHED", updatedAt: LOADED_UPDATED_AT, quantityRemaining: { gte: 1 } });
		expect(child?.data).toMatchObject({ quantityRemaining: { increment: -1 }, quantityReserved: { increment: 1 } });
	});

	it("answers a lost compare-and-set on the reward or on its child as a concurrent modification (409)", async () => {
		const db = database();
		const repository = new PrismaRewardRepository(db.prisma);
		db.updateMany.mockResolvedValueOnce({ count: 0 });
		const first = referredReward();
		first.creditReferral(NOW);

		await expect(repository.save(first)).rejects.toBeInstanceOf(ConcurrentModificationError);

		db.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
		const second = referredReward();
		second.creditReferral(NOW);
		await expect(repository.save(second)).rejects.toBeInstanceOf(ConcurrentModificationError);
	});
});

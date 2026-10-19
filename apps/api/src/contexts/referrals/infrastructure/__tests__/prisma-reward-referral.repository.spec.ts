import type { Prisma } from "@prisma/client";
import { epochMs } from "@workspace/shared";
import { describe, expect, it, vi, type Mock } from "vitest";

import { createTestTypedConfig } from "../../../../../test/support/test-api-env";
import { ConcurrentModificationError } from "../../../../platform/infrastructure/persistence/persistence.errors";
import { PrismaService } from "../../../../prisma/prisma.service";
import { PrismaRewardReferralRepository } from "../persistence/prisma-reward-referral.repository";

vi.mock("../../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

const NOW = epochMs(1_800_000_000_000);
const BONUS = { referrerRewardId: "referrer-reward-1", title: "Free cake", expiryDate: epochMs(NOW + 1) };

type QueryRaw = (query: TemplateStringsArray, ...values: readonly string[]) => Promise<readonly object[]>;
type UpdateMany = (args: Prisma.RewardReferralUpdateManyArgs) => Promise<Prisma.BatchPayload>;

function database(rows: readonly object[]): { readonly prisma: PrismaService; readonly queryRaw: Mock<QueryRaw>; readonly updateMany: Mock<UpdateMany> } {
	const queryRaw = vi.fn<QueryRaw>().mockResolvedValue(rows);
	const updateMany = vi.fn<UpdateMany>().mockResolvedValue({ count: 1 });
	return { prisma: Object.assign(new PrismaService(createTestTypedConfig()), { $queryRaw: queryRaw, rewardReferral: { updateMany } }), queryRaw, updateMany };
}

describe("PrismaRewardReferralRepository", () => {
	it("locks the referee's PENDING referral of the reward FOR UPDATE, oldest id first", async () => {
		const db = database([{ id: "referral-1", referrerUserId: "referrer-1" }]);

		const referral = await new PrismaRewardReferralRepository(db.prisma).lockPendingFor("reward-1", "referee-1");

		expect(referral?.id).toBe("referral-1");
		const [strings, ...values] = db.queryRaw.mock.calls.at(0) ?? [];
		expect(strings?.join("?").replace(/\s+/gu, " ")).toMatch(/status = 'PENDING' AND "isDeleted" = false ORDER BY id LIMIT 1 FOR UPDATE$/u);
		expect(values).toEqual(["reward-1", "referee-1"]);
	});

	it("finds nothing to credit when the referee has no PENDING referral of the reward", async () => {
		await expect(new PrismaRewardReferralRepository(database([]).prisma).lockPendingFor("reward-1", "referee-1")).resolves.toBeNull();
	});

	it("credits with a compare-and-set on PENDING, a lost race being a concurrent modification", async () => {
		const db = database([{ id: "referral-1", referrerUserId: "referrer-1" }]);
		const repository = new PrismaRewardReferralRepository(db.prisma);
		const referral = await repository.lockPendingFor("reward-1", "referee-1");
		referral?.credit(BONUS, NOW);

		if (referral === null) {
			throw new Error("the referral was not locked");
		}
		await repository.save(referral);
		expect(db.updateMany).toHaveBeenCalledWith({
			where: { id: "referral-1", status: "PENDING", isDeleted: false },
			data: { status: "CREDITED", creditedAt: NOW, updatedAt: NOW },
		});
		db.updateMany.mockResolvedValueOnce({ count: 0 });
		await expect(repository.save(referral)).rejects.toBeInstanceOf(ConcurrentModificationError);
	});

	it("writes nothing for a referral that was not credited in this unit of work", async () => {
		const db = database([{ id: "referral-1", referrerUserId: "referrer-1" }]);
		const repository = new PrismaRewardReferralRepository(db.prisma);
		const referral = await repository.lockPendingFor("reward-1", "referee-1");

		if (referral === null) {
			throw new Error("the referral was not locked");
		}
		await repository.save(referral);
		expect(db.updateMany).not.toHaveBeenCalled();
	});
});

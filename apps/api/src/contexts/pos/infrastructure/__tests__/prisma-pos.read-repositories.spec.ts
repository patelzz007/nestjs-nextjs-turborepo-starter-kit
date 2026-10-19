import type { Prisma } from "@prisma/client";
import { epochMs, MerchantApiKeyListQuerySchema, MerchantRedemptionListQuerySchema } from "@workspace/shared";
import { describe, expect, it, vi, type Mock } from "vitest";

import { createTestTypedConfig } from "../../../../../test/support/test-api-env";
import type { ActorContext } from "../../../../platform/application/actor-context";
import type { MerchantAccessGrant } from "../../../../platform/application/ports/authorization.port";
import type { RlsTransactionScope } from "../../../../platform/infrastructure/unit-of-work/actor-to-rls-context";
import { PrismaReadExecutor } from "../../../../platform/infrastructure/unit-of-work/prisma-read-executor";
import type { RlsTransactionRunner } from "../../../../platform/infrastructure/unit-of-work/prisma-unit-of-work";
import { PrismaService } from "../../../../prisma/prisma.service";
import { PrismaApiKeyReadRepository, PrismaRedemptionReadRepository, PrismaTerminalReadRepository } from "../persistence/prisma-pos.read-repositories";

vi.mock("../../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

const NOW = epochMs(1_800_000_000_000);
const REQUEST = { requestId: "req-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null };
const MEMBER: ActorContext = {
	kind: "user",
	userId: "member-1",
	sessionId: "session-1",
	organizationId: "org-1",
	isSuperAdmin: false,
	accessScope: "tenant",
	impersonatorUserId: null,
	request: REQUEST,
};
const STORE_GRANT: MerchantAccessGrant = { organizationId: "org-1", locationScope: "SELECTED", locationIds: ["store-a"] };

/** Runs every read on the fake client, recording the RLS scope it was asked for. */
class RecordingRunner implements RlsTransactionRunner<Prisma.TransactionClient> {
	public readonly scopes: RlsTransactionScope[] = [];

	public constructor(private readonly db: Prisma.TransactionClient) {}

	public withRlsContext<TResult>(scope: RlsTransactionScope, handler: (db: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult> {
		this.scopes.push(scope);
		return handler(this.db);
	}
}

describe("PrismaRedemptionReadRepository", () => {
	it("reads one page of the history within the granted stores, in one query per page, under the caller's RLS session", async () => {
		const count = vi.fn<(args: Prisma.RewardRedemptionCountArgs) => Promise<number>>().mockResolvedValue(1);
		const findMany = vi
			.fn<(args: Prisma.RewardRedemptionFindManyArgs) => Promise<readonly object[]>>()
			.mockResolvedValue([
				{ id: "redemption-1", redeemedAt: BigInt(NOW), terminalId: "TERM-AAAA2222", redemptionMethod: "MANUAL", claim: { reward: { title: "Free latte" } } },
			]);
		const runner = new RecordingRunner(Object.assign(new PrismaService(createTestTypedConfig()), { rewardRedemption: { count, findMany } }));

		await expect(
			new PrismaRedemptionReadRepository(new PrismaReadExecutor(runner)).list(MEMBER, STORE_GRANT, MerchantRedemptionListQuerySchema.parse({ limit: "10" })),
		).resolves.toMatchObject({
			items: [{ redemptionId: "redemption-1", rewardTitle: "Free latte", redeemedAt: NOW, terminalId: "TERM-AAAA2222", redemptionMethod: "MANUAL" }],
			total: 1,
			limit: 10,
		});
		expect(findMany).toHaveBeenCalledOnce();
		expect(findMany.mock.calls.at(0)?.at(0)).toMatchObject({ include: { claim: { select: { reward: { select: { title: true } } } } }, take: 10 });
		expect(count.mock.calls.at(0)?.at(0)?.where).toEqual({
			AND: [{ organizationId: "org-1", isDeleted: false, claim: { isDeleted: false, reward: { isDeleted: false } } }, { locationId: { in: ["store-a"] } }],
		});
		expect(runner.scopes).toHaveLength(1);
	});
});

describe("PrismaApiKeyReadRepository", () => {
	it("maps each key with its store's name, and excludes organization-wide keys from a store-limited grant", async () => {
		const count = vi.fn<(args: Prisma.OrganizationApiKeyCountArgs) => Promise<number>>().mockResolvedValue(1);
		const findMany = vi.fn<(args: Prisma.OrganizationApiKeyFindManyArgs) => Promise<readonly object[]>>().mockResolvedValue([
			{
				id: "key-1",
				name: "Front till",
				locationId: "store-a",
				location: { name: "Store A" },
				scope: "POS",
				revokedAt: null,
				createdAt: BigInt(NOW),
				updatedAt: BigInt(NOW),
				isDeleted: false,
				deletedAt: null,
			},
		]);
		const runner = new RecordingRunner(Object.assign(new PrismaService(createTestTypedConfig()), { organizationApiKey: { count, findMany } }));

		await expect(new PrismaApiKeyReadRepository(new PrismaReadExecutor(runner)).list(MEMBER, STORE_GRANT, MerchantApiKeyListQuerySchema.parse({}))).resolves.toMatchObject({
			items: [{ id: "key-1", locationName: "Store A", scope: "POS", revokedAt: null, createdAt: NOW }],
		});
		expect(count.mock.calls.at(0)?.at(0)?.where).toEqual({ AND: [{ organizationId: "org-1", isDeleted: false }, { locationId: { in: ["store-a"] } }] });
	});
});

describe("PrismaTerminalReadRepository.summary", () => {
	it("counts the live tills per derived status and the stores they cover, the rest being unpaired", async () => {
		const count: Mock<(args: Prisma.OrganizationTerminalCountArgs) => Promise<number>> = vi.fn<(args: Prisma.OrganizationTerminalCountArgs) => Promise<number>>();
		count.mockResolvedValueOnce(5).mockResolvedValueOnce(1).mockResolvedValueOnce(3);
		const groupBy = vi
			.fn<(args: Prisma.OrganizationTerminalGroupByArgs) => Promise<readonly object[]>>()
			.mockResolvedValue([{ locationId: "store-a" }, { locationId: "store-b" }]);
		const runner = new RecordingRunner(Object.assign(new PrismaService(createTestTypedConfig()), { organizationTerminal: { count, groupBy } }));

		await expect(new PrismaTerminalReadRepository(new PrismaReadExecutor(runner)).summary(MEMBER, STORE_GRANT, NOW)).resolves.toEqual({
			total: 5,
			byStatus: { AWAITING_PAIRING: 1, ACTIVE: 3, UNPAIRED: 1 },
			storesWithTerminals: 2,
		});
		expect(count.mock.calls.at(0)?.at(0)?.where).toEqual({ AND: [{ organizationId: "org-1", isDeleted: false }, { locationId: { in: ["store-a"] } }] });
	});
});

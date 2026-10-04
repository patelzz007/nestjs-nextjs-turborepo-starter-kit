import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RewardListQuerySchema } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";
import { RewardRepository, type RewardWithOrganization } from "./reward.repository";
import { ALL_LOCATIONS_SCOPE, selectedLocationsScope } from "../types/merchant-location-scope";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";

const REWARD_ID = "7f1c1b9e-8a43-4c2e-9d1a-3b7e6f2a9c01";
const ORGANIZATION_ID = "0b6a3c55-2f1d-4e8a-a7b9-5c4d3e2f1a10";
const STORE_ID = "7c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f";

const mocks = vi.hoisted(() => ({
	findFirst: vi.fn<(args: Prisma.RewardFindFirstArgs) => Promise<RewardWithOrganization | null>>(),
	findMany: vi.fn<(args: Prisma.RewardFindManyArgs) => Promise<RewardWithOrganization[]>>(),
	count: vi.fn<(args: Prisma.RewardCountArgs) => Promise<number>>(),
}));

vi.mock("../../../prisma/prisma.service", () => ({
	PrismaService: class {
		public readonly reward = { findFirst: mocks.findFirst, findMany: mocks.findMany, count: mocks.count };
	},
}));

/**
 * The merchant logo rides along in the reward query itself (no N+1): only the
 * organization's live LOGO asset whose file is READY, not deleted and public.
 */
const EXPECTED_ORGANIZATION_INCLUDE = {
	select: {
		displayName: true,
		assets: {
			where: {
				assetType: "LOGO",
				isDeleted: false,
				file: { status: "READY", isDeleted: false, publicPath: { not: null } },
			},
			select: { file: { select: { publicPath: true } } },
			take: 1,
		},
	},
};

function createRepository(): RewardRepository {
	return new RewardRepository(new PrismaService(createTestTypedConfig()));
}

describe("RewardRepository merchant logo include", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.findFirst.mockResolvedValue(null);
		mocks.findMany.mockResolvedValue([]);
		mocks.count.mockResolvedValue(0);
	});

	it("loads the READY logo with the published reward detail in the same query", async () => {
		await createRepository().findPublishedConsumerWithOrganization(REWARD_ID);

		expect(mocks.findFirst).toHaveBeenCalledTimes(1);
		expect(mocks.findFirst.mock.calls[0]?.[0].include?.organization).toEqual(EXPECTED_ORGANIZATION_INCLUDE);
	});

	it("loads the READY logo with every marketplace page row in the same query", async () => {
		await createRepository().listMarketplace(RewardListQuerySchema.parse({}));

		expect(mocks.findMany).toHaveBeenCalledTimes(1);
		expect(mocks.findMany.mock.calls[0]?.[0].include?.organization).toEqual(EXPECTED_ORGANIZATION_INCLUDE);
	});

	it("loads the READY logo for the merchant's own reward list", async () => {
		await createRepository().listConsumerByOrganization(ORGANIZATION_ID, ALL_LOCATIONS_SCOPE);

		expect(mocks.findMany.mock.calls[0]?.[0].include?.organization).toEqual(EXPECTED_ORGANIZATION_INCLUDE);
	});

	it("lists only the rewards offered at a store-limited member's stores (organization-wide ones included)", async () => {
		await createRepository().listConsumerByOrganization(ORGANIZATION_ID, selectedLocationsScope([STORE_ID]));

		expect(mocks.findMany.mock.calls[0]?.[0].where).toEqual({
			AND: [
				{ organizationId: ORGANIZATION_ID, isDeleted: false, rewardKind: "CONSUMER" },
				{ OR: [{ locationScopeType: "ALL_LOCATIONS" }, { locationScopes: { some: { locationId: { in: [STORE_ID] } } } }] },
			],
		});
	});
});

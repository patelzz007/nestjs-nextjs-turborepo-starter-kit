import { randomUUID } from "node:crypto";

import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ORGANIZATION_SEED_IDS } from "../prisma/seed/organizations";
import { RewardClaimRepository, type ReservedClaimOutcome } from "../src/modules/rewards/repositories/reward-claim.repository";
import { PrismaService } from "../src/prisma/prisma.service";
import { runWithSystemRlsContext } from "../src/prisma/rls-context";
import { createE2eApp } from "./e2e-helpers";

const DAY_MS = 86_400_000;
const PARALLEL = 5;

/**
 * Real-Postgres proof that claiming is atomic: the stock reservation, the
 * per-customer limit and the claim insert commit together, so parallel claims
 * can neither oversell a reward nor exceed `maxUsePerUser`.
 */
describe("Reward claim reservation (integration)", () => {
	let app: NestFastifyApplication;
	let prisma: PrismaService;
	let claims: RewardClaimRepository;
	const rewardIds: string[] = [];

	function asSystem<T>(work: () => Promise<T>): Promise<T> {
		return runWithSystemRlsContext("route.rls_bypass", work);
	}

	async function createReward(quantity: number): Promise<string> {
		const id = randomUUID();
		await asSystem(async () =>
			prisma.reward.create({
				data: {
					id,
					organizationId: ORGANIZATION_SEED_IDS.klOrganization,
					title: "E2E reservation reward",
					description: "Created by reward-claim-reservation.e2e-spec.ts",
					rewardType: "FREE_ITEM",
					category: "cafe",
					placeholderImageKey: "category-cafe",
					quantityTotal: quantity,
					quantityRemaining: quantity,
					expiryDate: Date.now() + 30 * DAY_MS,
					status: "PUBLISHED",
					referralsEnabled: false,
				},
			}),
		);
		rewardIds.push(id);
		return id;
	}

	function claim(userId: string, rewardId: string, maxClaimsPerUser: number | null): Promise<ReservedClaimOutcome> {
		const now = Date.now();
		return asSystem(async () =>
			claims.createReservedClaim({
				userId,
				rewardId,
				maxClaimsPerUser,
				redemptionTokenHash: `v1:e2e-token-${randomUUID()}`,
				backupCodeHash: `v1:e2e-backup-${randomUUID()}`,
				claimedAt: now,
				claimExpiresAt: now + DAY_MS,
				attributionToken: null,
				phone: "+60123000000",
			}),
		);
	}

	beforeAll(async () => {
		app = await createE2eApp();
		prisma = app.get(PrismaService);
		claims = app.get(RewardClaimRepository);
	});

	afterAll(async () => {
		await asSystem(async () => {
			await prisma.rewardClaim.deleteMany({ where: { rewardId: { in: rewardIds } } });
			await prisma.reward.deleteMany({ where: { id: { in: rewardIds } } });
		});
		await app.close();
	});

	it("never lets one customer exceed maxUsePerUser, even with parallel claims", async () => {
		const rewardId = await createReward(PARALLEL);
		const user = await asSystem(async () => prisma.user.findUniqueOrThrow({ where: { email: "alice.johnson@example.com" }, select: { id: true } }));

		const outcomes = await Promise.all(Array.from({ length: PARALLEL }, async () => claim(user.id, rewardId, 1)));

		expect(outcomes.filter((outcome) => outcome.kind === "created")).toHaveLength(1);
		expect(outcomes.filter((outcome) => outcome.kind === "limit_reached")).toHaveLength(PARALLEL - 1);
		// Refused claims returned their reserved unit: exactly one unit is gone.
		const after = await asSystem(async () => prisma.reward.findUniqueOrThrow({ where: { id: rewardId } }));
		expect({ remaining: after.quantityRemaining, reserved: after.quantityReserved, claims: after.claimCount }).toEqual({ remaining: PARALLEL - 1, reserved: 1, claims: 1 });
	});

	it("never oversells: parallel claims of the last unit by different customers succeed exactly once", async () => {
		const rewardId = await createReward(1);
		const users = await asSystem(async () =>
			prisma.user.findMany({ where: { email: { endsWith: "@example.com" } }, select: { id: true }, take: PARALLEL, orderBy: { email: "asc" } }),
		);
		expect(users).toHaveLength(PARALLEL);

		const outcomes = await Promise.all(users.map(async (user) => claim(user.id, rewardId, null)));

		expect(outcomes.filter((outcome) => outcome.kind === "created")).toHaveLength(1);
		expect(outcomes.filter((outcome) => outcome.kind === "out_of_stock")).toHaveLength(PARALLEL - 1);
		const after = await asSystem(async () => prisma.reward.findUniqueOrThrow({ where: { id: rewardId } }));
		expect(after.quantityRemaining).toBe(0);
		expect(await asSystem(async () => prisma.rewardClaim.count({ where: { rewardId } }))).toBe(1);
	});
});

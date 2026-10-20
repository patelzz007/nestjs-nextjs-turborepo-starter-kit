import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { epochMs } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { TENANT_SEED_IDS } from "../prisma/seed/tenants";
import { rewardCoverImageSeedId } from "../prisma/seed/reward-images";
import { Reward } from "../src/contexts/rewards/domain/aggregates/reward.aggregate";
import type { ReferrerRewardSnapshot, RewardSnapshot } from "../src/contexts/rewards/domain/aggregates/reward.state";
import { RewardLocationScope } from "../src/contexts/rewards/domain/value-objects/reward-location-scope.value-object";
import { RewardRulesValue } from "../src/contexts/rewards/domain/value-objects/reward-rules.value-object";
import { PrismaRewardRepository } from "../src/contexts/rewards/infrastructure/persistence/prisma-reward.repository";
import { createE2eApp, withTenantMember } from "./e2e-helpers";

const DAY_MS = 86_400_000;

/** The test-only failure D02 asks for: the referrer child cannot be written. */
class ReferrerInsertFailed extends Error {}

class FailingReferrerRepository extends PrismaRewardRepository {
	protected override insertReferrer(_parent: RewardSnapshot, _child: ReferrerRewardSnapshot): Promise<void> {
		return Promise.reject(new ReferrerInsertFailed("forced referrer failure"));
	}
}

/** D02: a consumer reward and its referrer child are created in ONE transaction — a failed child leaves no reward behind. */
describe("Reward creation atomicity (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let merchantUserId: string;

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		merchantUserId = z.object({ id: z.string() }).parse((await pool.query(`SELECT id FROM public."User" WHERE email = 'brew.owner@kl-rewards.demo'`)).rows.at(0)).id;
	});

	afterAll(async () => {
		await pool.end();
		await app.close();
	});

	it("rolls the consumer reward back when its referrer child fails", async () => {
		const rewardId = randomUUID();
		const referrerId = randomUUID();
		const reward = Reward.create(
			{
				id: rewardId,
				referrerId,
				tenantId: TENANT_SEED_IDS.klTenant,
				title: "E2E atomic reward",
				description: "Created by reward-create-atomicity.e2e-spec.ts",
				offer: { rewardType: "FREE_ITEM", rewardValue: 0, termsConditions: null, category: "cafe" },
				rules: RewardRulesValue.none(),
				quantityTotal: 5,
				startDate: null,
				expiryDate: epochMs(Date.now() + 30 * DAY_MS),
				referralsEnabled: true,
				referralPoolTotal: 2,
				referrerRewardTitle: null,
				saveAsDraft: true,
				locationScope: RewardLocationScope.allLocations(),
				imageFileIds: [rewardCoverImageSeedId("free-coffee")],
			},
			epochMs(Date.now()),
		);

		await expect(withTenantMember(app, merchantUserId, TENANT_SEED_IDS.klTenant, (tx) => new FailingReferrerRepository(tx).add(reward))).rejects.toBeInstanceOf(
			ReferrerInsertFailed,
		);

		const remaining = await pool.query(`SELECT count(*)::int AS count FROM public."Reward" WHERE id = ANY($1)`, [[rewardId, referrerId]]);
		expect(z.object({ count: z.number() }).parse(remaining.rows.at(0)).count).toBe(0);
	});
});

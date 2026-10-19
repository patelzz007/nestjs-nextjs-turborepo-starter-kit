import { randomUUID } from "node:crypto";

import { CommandBus } from "@nestjs/cqrs";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { ORGANIZATION_SEED_IDS } from "../prisma/seed/organizations";
import { rewardCoverImageSeedId } from "../prisma/seed/reward-images";
import { ApproveRewardCommand } from "../src/contexts/rewards/application/commands/approve-reward/approve-reward.command";
import { RejectRewardCommand } from "../src/contexts/rewards/application/commands/reject-reward/reject-reward.command";
import { ActorContextSchema, type ActorContext } from "../src/platform/application/actor-context";
import { PrismaService } from "../src/prisma/prisma.service";
import { runWithSystemRlsContext } from "../src/prisma/rls-context";
import { createE2eApp } from "./e2e-helpers";

const DAY_MS = 86_400_000;

const IdRowSchema = z.object({ id: z.string() });
const NoticeRowSchema = z.object({ userId: z.string(), type: z.string(), body: z.string() });

/**
 * A moderation decision tells the organization's owners in the decision's own transaction: claims'
 * in-transaction handler writes one reward-inbox notice per active owner (mechanism 1).
 */
describe("Reward review notices (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let reviewer: ActorContext;
	let ownerIds: string[];
	const rewardIds: string[] = [];

	async function pendingReward(): Promise<string> {
		const id = randomUUID();
		await runWithSystemRlsContext("route.rls_bypass", async () =>
			app.get(PrismaService).reward.create({
				data: {
					id,
					organizationId: ORGANIZATION_SEED_IDS.klOrganization,
					title: `E2E review ${id}`,
					description: "Created by reward-review-notices.e2e-spec.ts",
					rewardType: "FREE_ITEM",
					category: "cafe",
					images: { create: [{ organizationId: ORGANIZATION_SEED_IDS.klOrganization, fileId: rewardCoverImageSeedId("free-coffee"), position: 0 }] },
					quantityTotal: 5,
					quantityRemaining: 5,
					expiryDate: Date.now() + 30 * DAY_MS,
					status: "PENDING_REVIEW",
					submittedForReviewAt: Date.now(),
					autoPublishAt: Date.now() + DAY_MS,
					referralsEnabled: false,
				},
			}),
		);
		rewardIds.push(id);
		return id;
	}

	async function noticesFor(rewardId: string): Promise<z.output<typeof NoticeRowSchema>[]> {
		const result = await pool.query(`SELECT "userId" AS "userId", type, body FROM public."RewardNotification" WHERE metadata->>'rewardId' = $1 ORDER BY "userId"`, [rewardId]);
		return z.array(NoticeRowSchema).parse(result.rows);
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		const superAdminId = IdRowSchema.parse((await pool.query(`SELECT id FROM public."User" WHERE email = 'superadmin@example.com'`)).rows.at(0)).id;
		reviewer = ActorContextSchema.parse({
			kind: "user",
			userId: superAdminId,
			sessionId: randomUUID(),
			organizationId: null,
			isSuperAdmin: true,
			accessScope: "superadmin",
			impersonatorUserId: null,
			request: { requestId: randomUUID(), ip: null, userAgent: null, deviceLabel: null, endpoint: null },
		});
		const owners = await pool.query(
			`SELECT "userId" AS id FROM public."OrganizationMembership" WHERE "organizationId" = $1 AND role = 'OWNER' AND status = 'ACTIVE' AND "isDeleted" = false ORDER BY "userId"`,
			[ORGANIZATION_SEED_IDS.klOrganization],
		);
		ownerIds = z
			.array(IdRowSchema)
			.parse(owners.rows)
			.map((row) => row.id);
		expect(ownerIds.length).toBeGreaterThan(0);
	});

	afterAll(async () => {
		// Fixture teardown through the superuser pool: this spec's rewards and their notices.
		await pool.query(`DELETE FROM public."RewardNotification" WHERE metadata->>'rewardId' = ANY($1)`, [rewardIds]);
		await pool.query(`DELETE FROM public."RewardImage" WHERE "rewardId" = ANY($1)`, [rewardIds]);
		await pool.query(`DELETE FROM public."Reward" WHERE id = ANY($1)`, [rewardIds]);
		await pool.end();
		await app.close();
	});

	it("tells every active owner that the reward went live when it is approved", async () => {
		const rewardId = await pendingReward();

		await app.get(CommandBus).execute(new ApproveRewardCommand(reviewer, { rewardId }));

		const notices = await noticesFor(rewardId);
		expect(notices.map((notice) => notice.userId)).toEqual(ownerIds);
		expect(notices.every((notice) => notice.type === "reward_approved")).toBe(true);
	});

	it("tells the owners why when it is rejected", async () => {
		const rewardId = await pendingReward();

		await app.get(CommandBus).execute(new RejectRewardCommand(reviewer, { rewardId, reason: "The photo shows another shop's product." }));

		const notices = await noticesFor(rewardId);
		expect(notices.map((notice) => [notice.userId, notice.type, notice.body])).toEqual(
			ownerIds.map((id) => [id, "reward_rejected", "The photo shows another shop's product."]),
		);
	});
});

import { randomUUID } from "node:crypto";

import { CommandBus } from "@nestjs/cqrs";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { ORGANIZATION_SEED_IDS } from "../prisma/seed/organizations";
import { rewardCoverImageSeedId } from "../prisma/seed/reward-images";
import { ApproveRewardCommand } from "../src/contexts/rewards/application/commands/approve-reward/approve-reward.command";
import { AutoPublishDueRewardsCommand } from "../src/contexts/rewards/application/commands/auto-publish-due-rewards/auto-publish-due-rewards.command";
import { RejectRewardCommand } from "../src/contexts/rewards/application/commands/reject-reward/reject-reward.command";
import { ReviseRewardCommand } from "../src/contexts/rewards/application/commands/revise-reward/revise-reward.command";
import { SubmitRewardForReviewCommand } from "../src/contexts/rewards/application/commands/submit-reward-for-review/submit-reward-for-review.command";
import { ActorContextSchema, systemActor, type ActorContext } from "../src/platform/application/actor-context";
import { PrismaService } from "../src/prisma/prisma.service";
import { runWithSystemRlsContext } from "../src/prisma/rls-context";
import { createE2eApp } from "./e2e-helpers";

const DAY_MS = 86_400_000;
const ORGANIZATION: string = ORGANIZATION_SEED_IDS.klOrganization;

const IdRowSchema = z.object({ id: z.string() });
const RewardRowSchema = z.object({ status: z.string(), title: z.string(), reviewedBy: z.string().nullable(), rejectionReason: z.string().nullable() });
const ErrorCodeSchema = z.object({ code: z.string() });

type Outcome = { readonly ok: true } | { readonly ok: false; readonly code: string };

/**
 * Real-Postgres races on the review lifecycle (plan D01, D03, D04, D10): every transition is a
 * compare-and-set on the reward row, so of two concurrent commands at most one applies a conflicting
 * decision, and the stored row reflects every command that reported success (no lost update).
 */
describe("Reward review races (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let reviewer: ActorContext;
	let owner: ActorContext;
	const rewardIds: string[] = [];

	function userActor(userId: string, isSuperAdmin: boolean): ActorContext {
		return ActorContextSchema.parse({
			kind: "user",
			userId,
			sessionId: randomUUID(),
			organizationId: isSuperAdmin ? null : ORGANIZATION,
			isSuperAdmin,
			accessScope: isSuperAdmin ? "superadmin" : "tenant",
			impersonatorUserId: null,
			request: { requestId: randomUUID(), ip: null, userAgent: null, deviceLabel: null, endpoint: null },
		});
	}

	async function createReward(status: "DRAFT" | "PENDING_REVIEW", autoPublishAt: number | null = null): Promise<string> {
		const id = randomUUID();
		await runWithSystemRlsContext("route.rls_bypass", async () =>
			app.get(PrismaService).reward.create({
				data: {
					id,
					organizationId: ORGANIZATION,
					title: `E2E race ${id}`,
					description: "Created by rewards-races.e2e-spec.ts",
					rewardType: "FREE_ITEM",
					category: "cafe",
					images: { create: [{ organizationId: ORGANIZATION, fileId: rewardCoverImageSeedId("free-coffee"), position: 0 }] },
					quantityTotal: 5,
					quantityRemaining: 5,
					expiryDate: Date.now() + 30 * DAY_MS,
					status,
					...(status === "PENDING_REVIEW" ? { submittedForReviewAt: Date.now(), autoPublishAt: autoPublishAt ?? Date.now() + DAY_MS } : {}),
					referralsEnabled: false,
				},
			}),
		);
		rewardIds.push(id);
		return id;
	}

	async function outcome(work: Promise<object>): Promise<Outcome> {
		try {
			await work;
			return { ok: true };
		} catch (error) {
			return { ok: false, code: ErrorCodeSchema.parse(error).code };
		}
	}

	async function rewardRow(rewardId: string): Promise<z.output<typeof RewardRowSchema>> {
		const result = await pool.query(`SELECT status, title, "reviewedByUserId" AS "reviewedBy", "rejectionReason" AS "rejectionReason" FROM public."Reward" WHERE id = $1`, [
			rewardId,
		]);
		return RewardRowSchema.parse(result.rows.at(0));
	}

	async function decisionEvents(rewardId: string): Promise<string[]> {
		const result = await pool.query(
			`SELECT payload->'payload'->>'event' AS event FROM public."OutboxEvent" WHERE payload->'payload'->'metadata'->>'rewardId' = $1 ORDER BY "createdAt"`,
			[rewardId],
		);
		return z
			.array(z.object({ event: z.string() }))
			.parse(result.rows)
			.map((row) => row.event);
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		reviewer = userActor(IdRowSchema.parse((await pool.query(`SELECT id FROM public."User" WHERE email = 'superadmin@example.com'`)).rows.at(0)).id, true);
		owner = userActor(IdRowSchema.parse((await pool.query(`SELECT id FROM public."User" WHERE email = 'brew.owner@kl-rewards.demo'`)).rows.at(0)).id, false);
	});

	afterAll(async () => {
		// Fixture teardown through the superuser pool: this spec's rewards and every record about them.
		await pool.query(`DELETE FROM public."OutboxEvent" WHERE payload->'payload'->'metadata'->>'rewardId' = ANY($1)`, [rewardIds]);
		await pool.query(`DELETE FROM public."RewardNotification" WHERE metadata->>'rewardId' = ANY($1)`, [rewardIds]);
		await pool.query(`DELETE FROM public."RewardAuditLog" WHERE metadata->>'rewardId' = ANY($1)`, [rewardIds]);
		await pool.query(`DELETE FROM public."RewardImage" WHERE "rewardId" = ANY($1)`, [rewardIds]);
		await pool.query(`DELETE FROM public."Reward" WHERE id = ANY($1)`, [rewardIds]);
		await pool.end();
		await app.close();
	});

	it("D01: approve vs reject — exactly one decision wins, and only its event is recorded", async () => {
		const rewardId = await createReward("PENDING_REVIEW");
		const bus = app.get(CommandBus);

		const [approved, rejected] = await Promise.all([
			outcome(bus.execute(new ApproveRewardCommand(reviewer, { rewardId }))),
			outcome(bus.execute(new RejectRewardCommand(reviewer, { rewardId, reason: "Needs a clearer photo." }))),
		]);

		expect([approved.ok, rejected.ok].filter(Boolean)).toHaveLength(1);
		const row = await rewardRow(rewardId);
		expect(row.status).toBe(approved.ok ? "PUBLISHED" : "DRAFT");
		expect(await decisionEvents(rewardId)).toEqual([approved.ok ? "reward.approved" : "reward.rejected"]);
	});

	it("D04: a double submit for review — one wins, the other is refused", async () => {
		const rewardId = await createReward("DRAFT");
		const bus = app.get(CommandBus);

		const outcomes = await Promise.all([
			outcome(bus.execute(new SubmitRewardForReviewCommand(owner, { organizationId: ORGANIZATION, rewardId }))),
			outcome(bus.execute(new SubmitRewardForReviewCommand(owner, { organizationId: ORGANIZATION, rewardId }))),
		]);

		expect(outcomes.filter((result) => result.ok)).toHaveLength(1);
		expect((await rewardRow(rewardId)).status).toBe("PENDING_REVIEW");
	});

	it("D03: a merchant's revision vs an approval — every reported success is in the stored row", async () => {
		const rewardId = await createReward("PENDING_REVIEW");
		const revisedTitle = `Revised ${rewardId}`;
		const bus = app.get(CommandBus);

		const [revised, approved] = await Promise.all([
			outcome(bus.execute(new ReviseRewardCommand(owner, { organizationId: ORGANIZATION, rewardId, title: revisedTitle }))),
			outcome(bus.execute(new ApproveRewardCommand(reviewer, { rewardId }))),
		]);

		expect(revised.ok || approved.ok).toBe(true);
		const row = await rewardRow(rewardId);
		if (revised.ok) {
			expect(row.title).toBe(revisedTitle);
		}
		if (approved.ok) {
			expect(row.reviewedBy).toBe(reviewer.kind === "user" ? reviewer.userId : null);
		}
	});

	it("D10: auto-publish never overwrites a rejection", async () => {
		const rejectedFirst = await createReward("PENDING_REVIEW", Date.now() - 1000);
		const bus = app.get(CommandBus);
		await bus.execute(new RejectRewardCommand(reviewer, { rewardId: rejectedFirst, reason: "Wrong store address." }));
		const job = systemActor("queue.rewards.auto_publish", "job", null, "Publish rewards whose review window has elapsed", null);

		await bus.execute(new AutoPublishDueRewardsCommand(job));

		expect(await rewardRow(rejectedFirst)).toMatchObject({ status: "DRAFT", rejectionReason: "Wrong store address." });

		const raced = await createReward("PENDING_REVIEW", Date.now() - 1000);
		const [published, rejected] = await Promise.all([
			outcome(bus.execute(new AutoPublishDueRewardsCommand(job))),
			outcome(bus.execute(new RejectRewardCommand(reviewer, { rewardId: raced, reason: "Raced rejection." }))),
		]);
		expect(published.ok).toBe(true);
		const row = await rewardRow(raced);
		expect(row.status).toBe(rejected.ok ? "DRAFT" : "PUBLISHED");
		expect(await decisionEvents(raced)).toEqual([rejected.ok ? "reward.rejected" : "reward.auto_published"]);
	});
});

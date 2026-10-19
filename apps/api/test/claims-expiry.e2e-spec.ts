import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { ORGANIZATION_SEED_IDS } from "../prisma/seed/organizations";
import { rewardCoverImageSeedId } from "../prisma/seed/reward-images";
import { ExpireOverdueClaimsCommand } from "../src/contexts/claims/application/commands/expire-overdue-claims/expire-overdue-claims.command";
import { systemActor } from "../src/platform/application/actor-context";
import { SystemCommandDispatcher } from "../src/platform/application/system-command-dispatcher";
import { PrismaService } from "../src/prisma/prisma.service";
import { runWithSystemRlsContext } from "../src/prisma/rls-context";
import { createE2eApp } from "./e2e-helpers";

const DAY_MS = 86_400_000;

const StockRowSchema = z.object({ remaining: z.number(), reserved: z.number() });
const OutboxRowSchema = z.object({
	eventType: z.string(),
	payload: z.object({
		type: z.string(),
		payload: z.object({ event: z.string(), organizationId: z.string(), metadata: z.object({ claimId: z.string(), isReferrerCredit: z.boolean() }) }),
	}),
});

/**
 * Claim expiry through the audited system command: the overdue claim moves to EXPIRED, its unit goes
 * back to the reward, and the reward audit row and the `reward.platform` outbox record commit with it.
 */
describe("Claim expiry (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	const rewardId: string = randomUUID();
	const overdueClaimId: string = randomUUID();
	const liveClaimId: string = randomUUID();

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		await runWithSystemRlsContext("route.rls_bypass", async () =>
			app.get(PrismaService).reward.create({
				data: {
					id: rewardId,
					organizationId: ORGANIZATION_SEED_IDS.klOrganization,
					title: "E2E expiry reward",
					description: "Created by claims-expiry.e2e-spec.ts",
					rewardType: "FREE_ITEM",
					category: "cafe",
					images: { create: [{ organizationId: ORGANIZATION_SEED_IDS.klOrganization, fileId: rewardCoverImageSeedId("free-coffee"), position: 0 }] },
					quantityTotal: 5,
					quantityRemaining: 3,
					quantityReserved: 2,
					claimCount: 2,
					expiryDate: Date.now() + 30 * DAY_MS,
					status: "PUBLISHED",
					referralsEnabled: false,
				},
			}),
		);
		const userId = z.object({ id: z.string() }).parse((await pool.query(`SELECT id FROM public."User" WHERE email = 'alice.johnson@example.com'`)).rows.at(0)).id;
		const now = Date.now();
		const fixtures: readonly (readonly [string, number])[] = [
			[overdueClaimId, now - DAY_MS],
			[liveClaimId, now + DAY_MS],
		];
		for (const [id, expiresAt] of fixtures) {
			await pool.query(
				`INSERT INTO public."RewardClaim" (id, "userId", "rewardId", "redemptionTokenHash", "backupCodeHash", status, "claimedAt", "claimExpiresAt") VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, $7)`,
				[id, userId, rewardId, `e2e-token-${id}`, `e2e-backup-${id}`, now - 2 * DAY_MS, expiresAt],
			);
		}
	});

	afterAll(async () => {
		// Fixture teardown through the superuser pool: this spec's reward, claims and their records.
		await pool.query(`DELETE FROM public."OutboxEvent" WHERE payload->'payload'->'metadata'->>'claimId' = ANY($1)`, [[overdueClaimId, liveClaimId]]);
		await pool.query(`DELETE FROM public."RewardAuditLog" WHERE metadata->>'claimId' = ANY($1)`, [[overdueClaimId, liveClaimId]]);
		await pool.query(`DELETE FROM public."RewardClaim" WHERE "rewardId" = $1`, [rewardId]);
		await pool.query(`DELETE FROM public."RewardImage" WHERE "rewardId" = $1`, [rewardId]);
		await pool.query(`DELETE FROM public."Reward" WHERE id = $1`, [rewardId]);
		await pool.end();
		await app.close();
	});

	it("expires only the overdue claim, returning its unit, with its audit row and outbox record", async () => {
		const actor = systemActor("queue.claims.expire_pending", "job", null, "Expire overdue consumer reward claims", null);

		const result = await app.get(SystemCommandDispatcher).dispatch(new ExpireOverdueClaimsCommand(actor), { kind: "job", name: "claims-expiry-e2e" });

		expect(result.expired).toBeGreaterThanOrEqual(1);
		const statuses = await pool.query(`SELECT id, status FROM public."RewardClaim" WHERE "rewardId" = $1 ORDER BY id`, [rewardId]);
		expect(
			Object.fromEntries(
				z
					.array(z.object({ id: z.string(), status: z.string() }))
					.parse(statuses.rows)
					.map((row) => [row.id, row.status]),
			),
		).toEqual({
			[overdueClaimId]: "EXPIRED",
			[liveClaimId]: "PENDING",
		});
		const stock = StockRowSchema.parse(
			(await pool.query(`SELECT "quantityRemaining" AS remaining, "quantityReserved" AS reserved FROM public."Reward" WHERE id = $1`, [rewardId])).rows.at(0),
		);
		expect(stock).toEqual({ remaining: 4, reserved: 1 });
		const audits = await pool.query(`SELECT action FROM public."RewardAuditLog" WHERE metadata->>'claimId' = $1`, [overdueClaimId]);
		expect(audits.rows).toEqual([{ action: "reward.claim_expired" }]);
		const outbox = await pool.query(`SELECT "eventType" AS "eventType", payload FROM public."OutboxEvent" WHERE payload->'payload'->'metadata'->>'claimId' = $1`, [
			overdueClaimId,
		]);
		const [record] = z.array(OutboxRowSchema).parse(outbox.rows);
		expect(outbox.rows).toHaveLength(1);
		expect(record).toMatchObject({
			eventType: "reward.platform",
			payload: {
				type: "reward.platform",
				payload: { event: "reward.claim_expired", organizationId: ORGANIZATION_SEED_IDS.klOrganization, metadata: { claimId: overdueClaimId, isReferrerCredit: false } },
			},
		});
	});
});

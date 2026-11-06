import { randomUUID } from "node:crypto";

import { CommandBus } from "@nestjs/cqrs";
import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { TENANT_SEED_IDS } from "../prisma/seed/tenants";
import { rewardCoverImageSeedId } from "../prisma/seed/reward-images";
import { ClaimRewardCommand } from "../src/contexts/claims/application/commands/claim-reward/claim-reward.command";
import { ActorContextSchema, systemActor, type ActorContext } from "../src/platform/application/actor-context";
import { createE2eApp, withTenantMember } from "./e2e-helpers";
import type { RequestClaimOtpResponse } from "@workspace/shared";
import { ExpireOverdueClaimHoldsCommand } from "../src/contexts/claims/application/commands/expire-overdue-claim-holds/expire-overdue-claim-holds.command";
import { RequestClaimOtpCommand } from "../src/contexts/claims/application/commands/request-claim-otp/request-claim-otp.command";

const DAY_MS = 86_400_000;
const PARALLEL = 5;

const CustomerRowSchema = z.object({ id: z.string(), phone: z.string() });
const StoredPhoneSchema = z.object({ id: z.string(), phone: z.string().nullable(), phoneVerifiedAt: z.string().nullable() });
const ErrorCodeSchema = z.object({ code: z.string() });

/** `created`, or the refusing error's code. */
type ClaimOutcome = string;

/**
 * Real-Postgres proof that claiming is atomic through the claims context's `ClaimReward` command:
 * the claimant's row lock serializes one customer's claims, the reward's row lock serializes the
 * stock, and the reservation, the per-customer limit and the claim insert commit together. So
 * parallel claims can neither oversell a reward nor exceed `maxUsePerUser`.
 */
describe("Reward claim reservation (integration)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let merchantUserId: string;
	let customers: z.output<typeof CustomerRowSchema>[] = [];
	const rewardIds: string[] = [];
	const insertedAcceptanceIds: string[] = [];
	let storedPhones: z.output<typeof StoredPhoneSchema>[] = [];

	async function createReward(quantity: number, maxUsePerUser: number | null): Promise<string> {
		const id = randomUUID();
		await withTenantMember(app, merchantUserId, TENANT_SEED_IDS.klTenant, (tx) =>
			tx.reward.create({
				data: {
					id,
					tenantId: TENANT_SEED_IDS.klTenant,
					title: "E2E reservation reward",
					description: "Created by reward-claim-reservation.e2e-spec.ts",
					rewardType: "FREE_ITEM",
					freeItemName: "Coffee (12 oz)",
					freeItemSku: "E2E-COFFEE-12OZ",
					category: "cafe",
					images: { create: [{ fileId: rewardCoverImageSeedId("free-coffee"), position: 0 }] },
					quantityTotal: quantity,
					quantityRemaining: quantity,
					expiryDate: Date.now() + 30 * DAY_MS,
					status: "PUBLISHED",
					referralsEnabled: false,
					...(maxUsePerUser === null ? {} : { rules: { maxUsePerUser } }),
				},
			}),
		);
		rewardIds.push(id);
		return id;
	}

	function customerActor(userId: string): ActorContext {
		return ActorContextSchema.parse({
			kind: "user",
			userId,
			sessionId: randomUUID(),
			tenantId: null,
			isSuperAdmin: false,
			accessScope: "tenant",
			impersonatorUserId: null,
			request: { requestId: randomUUID(), ip: null, userAgent: null, deviceLabel: null, endpoint: null },
		});
	}

	async function claim(customer: z.output<typeof CustomerRowSchema>, rewardId: string): Promise<ClaimOutcome> {
		try {
			await app.get(CommandBus).execute(new ClaimRewardCommand(customerActor(customer.id), { rewardId, phone: customer.phone }));
			return "created";
		} catch (error) {
			return ErrorCodeSchema.parse(error).code;
		}
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		merchantUserId = z.object({ id: z.string() }).parse((await pool.query(`SELECT id FROM public."User" WHERE email = 'brew.owner@kl-rewards.demo'`)).rows.at(0)).id;
		const rows = await pool.query(
			`SELECT id, phone, "phoneVerifiedAt"::text AS "phoneVerifiedAt" FROM public."User"
			 WHERE email IN ('alice.johnson@example.com', 'bob.smith@example.com', 'carol.white@example.com', 'david.lee@example.com', 'user@example.com') ORDER BY email`,
		);
		storedPhones = z.array(StoredPhoneSchema).parse(rows.rows);
		const ids = storedPhones;
		expect(ids).toHaveLength(PARALLEL);
		// Fixture: each customer accepted the terms and verified a distinct phone, so no claim needs an OTP.
		customers = ids.map((row, index) => CustomerRowSchema.parse({ id: row.id, phone: `+6012999000${String(index)}` }));
		for (const customer of customers) {
			await pool.query(`UPDATE public."User" SET phone = $2, "phoneVerifiedAt" = $3 WHERE id = $1`, [customer.id, customer.phone, Date.now()]);
			const acceptanceId: string = randomUUID();
			const inserted = await pool.query(
				`INSERT INTO public."RewardLegalAcceptance" (id, "userId", "termsVersion", "privacyVersion", "acceptedAt") SELECT $1, $2, 'e2e', 'e2e', $3
				 WHERE NOT EXISTS (SELECT 1 FROM public."RewardLegalAcceptance" WHERE "userId" = $2 AND "isDeleted" = false)`,
				[acceptanceId, customer.id, Date.now()],
			);
			if (inserted.rowCount === 1) {
				insertedAcceptanceIds.push(acceptanceId);
			}
		}
	});

	afterAll(async () => {
		await pool.query(`DELETE FROM public."RewardClaim" WHERE "rewardId" = ANY($1)`, [rewardIds]);
		await pool.query(`DELETE FROM public."RewardImage" WHERE "rewardId" = ANY($1)`, [rewardIds]);
		await pool.query(`DELETE FROM public."Reward" WHERE id = ANY($1)`, [rewardIds]);
		// Fixture teardown: the seeded customers get their own phones back, and only this spec's acceptances go.
		for (const stored of storedPhones) {
			await pool.query(`UPDATE public."User" SET phone = $2, "phoneVerifiedAt" = $3::bigint WHERE id = $1`, [stored.id, stored.phone, stored.phoneVerifiedAt]);
		}
		await pool.query(`DELETE FROM public."RewardLegalAcceptance" WHERE id = ANY($1)`, [insertedAcceptanceIds]);
		await pool.end();
		await app.close();
	});

	it("never lets one customer exceed maxUsePerUser, even with parallel claims", async () => {
		const rewardId = await createReward(PARALLEL, 1);
		const [customer] = customers;
		if (customer === undefined) {
			throw new Error("fixture customers are missing");
		}

		const outcomes = await Promise.all(Array.from({ length: PARALLEL }, async () => claim(customer, rewardId)));

		expect(outcomes.filter((outcome) => outcome === "created")).toHaveLength(1);
		expect(outcomes.filter((outcome) => outcome === "CLAIM_LIMIT_REACHED")).toHaveLength(PARALLEL - 1);
		// Refused claims rolled back their reservation: exactly one unit is gone.
		const after = await withTenantMember(app, merchantUserId, TENANT_SEED_IDS.klTenant, (tx) => tx.reward.findUniqueOrThrow({ where: { id: rewardId } }));
		expect({ remaining: after.quantityRemaining, reserved: after.quantityReserved, claims: after.claimCount }).toEqual({ remaining: PARALLEL - 1, reserved: 1, claims: 1 });
	});

	it("holds the last unit for one of many parallel code requests, and an unclaimed hold gives it back", async () => {
		const rewardId = await createReward(1, null);
		const stock = async (): Promise<{ readonly remaining: number; readonly reserved: number; readonly claims: number }> => {
			const reward = await withTenantMember(app, merchantUserId, TENANT_SEED_IDS.klTenant, (tx) => tx.reward.findUniqueOrThrow({ where: { id: rewardId } }));
			return { remaining: reward.quantityRemaining, reserved: reward.quantityReserved, claims: reward.claimCount };
		};
		const requestCode = async (customer: z.output<typeof CustomerRowSchema>): Promise<ClaimOutcome> => {
			try {
				await app.get(CommandBus).execute(new RequestClaimOtpCommand(customerActor(customer.id), { rewardId, phone: customer.phone }));
				return "created";
			} catch (error) {
				return ErrorCodeSchema.parse(error).code;
			}
		};

		const outcomes = await Promise.all(customers.map(requestCode));

		expect(outcomes.filter((outcome) => outcome === "created")).toHaveLength(1);
		expect(outcomes.filter((outcome) => outcome === "REWARD_OUT_OF_STOCK")).toHaveLength(PARALLEL - 1);
		expect(await stock()).toEqual({ remaining: 0, reserved: 1, claims: 0 });

		await pool.query(`UPDATE public."RewardClaimHold" SET "expiresAt" = 1 WHERE "rewardId" = $1`, [rewardId]);
		await app.get(CommandBus).execute(new ExpireOverdueClaimHoldsCommand(systemActor("queue.claims.expire_holds", "job", null, "e2e", null)));

		expect(await stock()).toEqual({ remaining: 1, reserved: 0, claims: 0 });
	});

	it("does not take a second unit when one customer asks for the code twice at once", async () => {
		const rewardId = await createReward(2, null);
		const [customer] = customers;
		const request = (): Promise<RequestClaimOtpResponse> =>
			app.get(CommandBus).execute(new RequestClaimOtpCommand(customerActor(customer?.id ?? ""), { rewardId, phone: customer?.phone ?? "" }));

		const [first, second] = await Promise.all([request(), request()]);

		expect(first.holdExpiresAt).toBe(second.holdExpiresAt);
		const reward = await withTenantMember(app, merchantUserId, TENANT_SEED_IDS.klTenant, (tx) => tx.reward.findUniqueOrThrow({ where: { id: rewardId } }));
		expect(reward.quantityReserved).toBe(1);
	});

	it("never oversells: parallel claims of the last unit by different customers succeed exactly once", async () => {
		const rewardId = await createReward(1, null);

		const outcomes = await Promise.all(customers.map(async (customer) => claim(customer, rewardId)));

		expect(outcomes.filter((outcome) => outcome === "created")).toHaveLength(1);
		expect(outcomes.filter((outcome) => outcome === "REWARD_OUT_OF_STOCK")).toHaveLength(PARALLEL - 1);
		const after = await withTenantMember(app, merchantUserId, TENANT_SEED_IDS.klTenant, (tx) => tx.reward.findUniqueOrThrow({ where: { id: rewardId } }));
		expect(after.quantityRemaining).toBe(0);
		expect(await withTenantMember(app, merchantUserId, TENANT_SEED_IDS.klTenant, (tx) => tx.rewardClaim.count({ where: { rewardId } }))).toBe(1);
	});
});

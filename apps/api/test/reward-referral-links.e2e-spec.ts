import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX, RewardReferralAttributionResponseSchema, RewardReferralLinkResponseSchema } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { rewardCoverImageSeedId } from "../prisma/seed/reward-images";
import { TENANT_SEED_IDS } from "../prisma/seed/tenants";
import {
	createE2eApp,
	login,
	markSeedUserEmailVerified,
	mutationHeaders,
	parseSuccessEnvelope,
	type InjectResponse,
	type LoginResult,
	uniqueClientIp,
	withTenantMember,
} from "./e2e-helpers";

const DAY_MS = 86_400_000;
const ErrorEnvelopeSchema = z.object({ success: z.literal(false), error: z.object({ code: z.string() }) });
const ReferralRowSchema = z.object({ referrerUserId: z.string(), refereeUserId: z.string().nullable(), status: z.string(), rewardId: z.string() });
const PendingAttributionSchema = z.object({ pendingAttributionToken: z.string().nullable(), pendingAttributionExpiresAt: z.string().nullable() });

/**
 * Reward referral links over HTTP (the multi-tenancy gap "nothing writes RewardReferral rows or
 * pendingAttributionToken"): a customer mints a share link, a friend opening it is remembered on
 * their account for the claim, and a referrer can never refer themselves.
 */
describe("Reward referral links (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let alice: LoginResult;
	let bob: LoginResult;
	let referableRewardId: string;
	let closedRewardId: string;
	let bobId: string;

	function cookie(user: LoginResult): string {
		return `accessToken=${user.accessToken}; refreshToken=${user.refreshToken}`;
	}

	function post(user: LoginResult, path: string, payload: Record<string, string> = {}): Promise<InjectResponse> {
		return app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}${path}`,
			headers: mutationHeaders({ cookie: cookie(user), "x-forwarded-for": uniqueClientIp() }),
			payload,
		});
	}

	function errorCode(response: InjectResponse): string {
		return ErrorEnvelopeSchema.parse(response.json()).error.code;
	}

	async function pendingAttributionOf(email: string): Promise<z.output<typeof PendingAttributionSchema>> {
		const result = await pool.query(
			`SELECT "pendingAttributionToken", "pendingAttributionExpiresAt"::text AS "pendingAttributionExpiresAt" FROM public."User" WHERE email = $1`,
			[email],
		);
		return PendingAttributionSchema.parse(result.rows.at(0));
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		referableRewardId = randomUUID();
		closedRewardId = randomUUID();
		const merchantUserId = z.object({ id: z.string() }).parse((await pool.query(`SELECT id FROM public."User" WHERE email = 'brew.owner@kl-rewards.demo'`)).rows.at(0)).id;
		await withTenantMember(app, merchantUserId, TENANT_SEED_IDS.klTenant, async (tx) => {
			for (const [id, referralsEnabled] of [
				[referableRewardId, true],
				[closedRewardId, false],
			] satisfies [string, boolean][]) {
				await tx.reward.create({
					data: {
						id,
						tenantId: TENANT_SEED_IDS.klTenant,
						title: `E2E referral link reward (${referralsEnabled ? "shareable" : "not shareable"})`,
						description: "Created by reward-referral-links.e2e-spec.ts",
						rewardType: "FREE_ITEM",
						category: "cafe",
						images: { create: [{ fileId: rewardCoverImageSeedId("free-coffee"), position: 0 }] },
						quantityTotal: 5,
						quantityRemaining: 5,
						expiryDate: Date.now() + 30 * DAY_MS,
						status: "PUBLISHED",
						referralsEnabled,
					},
				});
			}
		});
		await markSeedUserEmailVerified(pool, "alice.johnson@example.com");
		await markSeedUserEmailVerified(pool, "bob.smith@example.com");
		alice = await login(app, "alice.johnson@example.com", "Alice@123");
		bob = await login(app, "bob.smith@example.com", "Bob@123");
		bobId = z.object({ id: z.string() }).parse((await pool.query(`SELECT id FROM public."User" WHERE email = 'bob.smith@example.com'`)).rows.at(0)).id;
	});

	afterAll(async () => {
		await pool.query(`UPDATE public."User" SET "pendingAttributionToken" = NULL, "pendingAttributionExpiresAt" = NULL WHERE email = 'alice.johnson@example.com'`);
		await pool.end();
		await app.close();
	});

	it("mints a PENDING link for the referrer, remembers it on the friend who opens it, and refuses the referrer's own use", async () => {
		const minted = await post(bob, `/referrals/rewards/${referableRewardId}/links`);
		expect(minted.statusCode, minted.body).toBe(201);
		const link = parseSuccessEnvelope(minted, RewardReferralLinkResponseSchema).data;
		expect(link.rewardId).toBe(referableRewardId);

		const row = ReferralRowSchema.parse(
			(await pool.query(`SELECT "referrerUserId", "refereeUserId", status::text AS status, "rewardId" FROM public."RewardReferral" WHERE id = $1`, [link.referralId])).rows.at(
				0,
			),
		);
		expect(row).toEqual({ referrerUserId: bobId, refereeUserId: null, status: "PENDING", rewardId: referableRewardId });

		const own = await post(bob, "/referrals/attribution", { attributionToken: link.attributionToken });
		expect(own.statusCode, own.body).toBe(409);
		expect(errorCode(own)).toBe("REFERRAL_OWN_LINK");

		const recorded = await post(alice, "/referrals/attribution", { attributionToken: link.attributionToken });
		expect(recorded.statusCode, recorded.body).toBe(201);
		expect(parseSuccessEnvelope(recorded, RewardReferralAttributionResponseSchema).data.rewardId).toBe(referableRewardId);
		const pending = await pendingAttributionOf("alice.johnson@example.com");
		expect(pending.pendingAttributionToken).toBe(link.attributionToken);
		expect(Number(pending.pendingAttributionExpiresAt)).toBeGreaterThan(Date.now());
	});

	it("refuses a reward whose referrals are off, an unknown link, and a body naming anything else", async () => {
		const closed = await post(bob, `/referrals/rewards/${closedRewardId}/links`);
		expect(closed.statusCode, closed.body).toBe(404);
		expect(errorCode(closed)).toBe("REFERRAL_REWARD_NOT_REFERABLE");

		const unknown = await post(alice, "/referrals/attribution", { attributionToken: "A".repeat(43) });
		expect(unknown.statusCode, unknown.body).toBe(404);
		expect(errorCode(unknown)).toBe("REFERRAL_LINK_INVALID");

		const malformed = await post(alice, "/referrals/attribution", { attributionToken: "short" });
		expect(malformed.statusCode, malformed.body).toBe(400);

		const extra = await post(alice, "/referrals/attribution", { attributionToken: "A".repeat(43), refereeUserId: bobId });
		expect(extra.statusCode, extra.body).toBe(400);
	});
});

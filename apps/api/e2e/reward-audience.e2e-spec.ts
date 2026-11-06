import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX, RewardResponseSchema } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { rewardCoverImageSeedId } from "../prisma/seed/reward-images";
import { TENANT_SEED_IDS } from "../prisma/seed/tenants";
import { MARKETPLACE_PUBLIC_CACHE_CONTROL, MARKETPLACE_VIEWER_CACHE_CONTROL } from "../src/contexts/rewards/presentation/http/viewer-cache-control";
import {
	createE2eApp,
	login,
	markSeedUserEmailVerified,
	mutationHeaders,
	parsePaginatedEnvelope,
	parseSuccessEnvelope,
	type InjectResponse,
	type LoginResult,
	uniqueClientIp,
	withTenantMember,
} from "./e2e-helpers";

const DAY_MS = 86_400_000;
const QUANTITY = 5;
const MARKETPLACE_PAGE = 100;
const ErrorEnvelopeSchema = z.object({ success: z.literal(false), error: z.object({ code: z.string() }) });

/**
 * A reward given to chosen customers over HTTP: only its member sees it in the marketplace and on its
 * detail page, and nobody else can even ask for a claim code (404, as if it did not exist). A signed-in
 * answer is never stored by a shared cache.
 */
describe("Reward audiences (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let alice: LoginResult;
	let bob: LoginResult;
	let rewardId: string;

	function headers(user: LoginResult | null): Record<string, string> {
		return user === null
			? { "x-forwarded-for": uniqueClientIp() }
			: { cookie: `accessToken=${user.accessToken}; refreshToken=${user.refreshToken}`, "x-forwarded-for": uniqueClientIp() };
	}

	function get(user: LoginResult | null, path: string): Promise<InjectResponse> {
		return app.inject({ method: "GET", url: `${API_VERSION_PREFIX}${path}`, headers: headers(user) });
	}

	async function marketplaceIds(user: LoginResult | null): Promise<string[]> {
		const page = parsePaginatedEnvelope(await get(user, `/rewards?limit=${String(MARKETPLACE_PAGE)}&filter[tenantId][eq]=${TENANT_SEED_IDS.klTenant}`), RewardResponseSchema);
		return page.data.map((reward) => reward.id);
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		await markSeedUserEmailVerified(pool, "alice.johnson@example.com");
		await markSeedUserEmailVerified(pool, "bob.smith@example.com");
		const aliceId = z.object({ id: z.string() }).parse((await pool.query(`SELECT id FROM public."User" WHERE email = 'alice.johnson@example.com'`)).rows.at(0)).id;
		const merchantUserId = z.object({ id: z.string() }).parse((await pool.query(`SELECT id FROM public."User" WHERE email = 'brew.owner@kl-rewards.demo'`)).rows.at(0)).id;
		rewardId = randomUUID();
		await withTenantMember(app, merchantUserId, TENANT_SEED_IDS.klTenant, (tx) =>
			tx.reward.create({
				data: {
					id: rewardId,
					tenantId: TENANT_SEED_IDS.klTenant,
					title: "E2E reward for Alice only",
					description: "Created by reward-audience.e2e-spec.ts",
					rewardType: "FREE_ITEM",
					freeItemName: "Coffee (12 oz)",
					freeItemSku: "E2E-COFFEE-12OZ",
					category: "cafe",
					images: { create: [{ fileId: rewardCoverImageSeedId("free-coffee"), position: 0 }] },
					quantityTotal: QUANTITY,
					quantityRemaining: QUANTITY,
					expiryDate: Date.now() + 30 * DAY_MS,
					status: "PUBLISHED",
					referralsEnabled: false,
					audienceType: "SELECTED_CUSTOMERS",
					audienceMembers: { create: [{ userId: aliceId }] },
				},
			}),
		);
		alice = await login(app, "alice.johnson@example.com", "Alice@123");
		bob = await login(app, "bob.smith@example.com", "Bob@123");
	});

	afterAll(async () => {
		// Fixture teardown through the superuser pool: this spec's reward and everything hanging off it.
		await pool.query(`DELETE FROM public."RewardOtpChallenge" WHERE "rewardId" = $1`, [rewardId]);
		await pool.query(`DELETE FROM public."RewardAudienceMember" WHERE "rewardId" = $1`, [rewardId]);
		await pool.query(`DELETE FROM public."RewardImage" WHERE "rewardId" = $1`, [rewardId]);
		await pool.query(`DELETE FROM public."Reward" WHERE id = $1`, [rewardId]);
		await pool.end();
		await app.close();
	});

	it("lists the reward only for the customer it was given to", async () => {
		expect(await marketplaceIds(alice)).toContain(rewardId);
		expect(await marketplaceIds(bob)).not.toContain(rewardId);
		expect(await marketplaceIds(null)).not.toContain(rewardId);
	});

	it("shows its detail only to that customer, and 404 to everyone else", async () => {
		const own = await get(alice, `/rewards/${rewardId}`);
		expect(own.statusCode).toBe(200);
		expect(parseSuccessEnvelope(own, RewardResponseSchema).data.audienceType).toBe("SELECTED_CUSTOMERS");
		expect((await get(bob, `/rewards/${rewardId}`)).statusCode).toBe(404);
		expect((await get(null, `/rewards/${rewardId}`)).statusCode).toBe(404);
	});

	it("never lets a shared cache keep a signed-in answer", async () => {
		expect((await get(alice, "/rewards")).headers["cache-control"]).toBe(MARKETPLACE_VIEWER_CACHE_CONTROL);
		expect((await get(null, "/rewards")).headers["cache-control"]).toBe(MARKETPLACE_PUBLIC_CACHE_CONTROL);
	});

	it("refuses anyone else a claim code as if the reward did not exist", async () => {
		const response = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/claims/otp`,
			headers: mutationHeaders(headers(bob)),
			payload: { rewardId, phone: "+60129990177" },
		});
		expect(response.statusCode).toBe(404);
		expect(ErrorEnvelopeSchema.parse(response.json()).error.code).toBe("REWARD_NOT_FOUND");
	});
});

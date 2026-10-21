import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import {
	API_VERSION_PREFIX,
	MerchantRedemptionListItemSchema,
	RewardClaimCreatedResponseSchema,
	RewardResponseSchema,
	TenantCustomerBanResponseSchema,
	TenantLifecycleResponseSchema,
} from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { TENANT_SEED_IDS, TENANT_SEED_SLUGS } from "../prisma/seed/tenants";
import { rewardCoverImageSeedId } from "../prisma/seed/reward-images";
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
const QUANTITY = 10;
const KL_SLUG = TENANT_SEED_SLUGS.kl;
const KL_TENANT_ID = TENANT_SEED_IDS.klTenant;
/** The verified phone this spec gives Alice, so her claims need no OTP. */
const ALICE_FIXTURE_PHONE = "+60129990101";

const ErrorEnvelopeSchema = z.object({ success: z.literal(false), error: z.object({ code: z.string() }) });
const StoredPhoneSchema = z.object({ phone: z.string().nullable(), phoneVerifiedAt: z.string().nullable() });
const RedemptionRowSchema = z.object({ id: z.string(), redeemedAt: z.string() });

/**
 * Two bans over HTTP. A merchant bans the customer behind one of its redemptions: the customer can
 * no longer claim its rewards until the ban is lifted. A super admin bans a whole merchant: its
 * members keep only the lifecycle routes, its rewards leave the marketplace and cannot be claimed,
 * and lifting the ban restores all of it. A platform admin who is not a super admin cannot ban.
 */
describe("Tenant and customer bans (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let superAdmin: LoginResult;
	let platformAdmin: LoginResult;
	let owner: LoginResult;
	let cashier: LoginResult;
	let alice: LoginResult;
	let alicePhone: string;
	let aliceStoredPhone: z.output<typeof StoredPhoneSchema>;
	let rewardId: string;
	let aliceRedemption: z.output<typeof RedemptionRowSchema>;
	const createdBanIds: string[] = [];

	/** The admin panel's session cookies carry their own names (and the request says it is the admin client); every other client uses the plain ones. */
	function sessionHeaders(user: LoginResult, client: "web" | "admin" | "merchant"): Record<string, string> {
		return client === "admin"
			? { cookie: `adminAccessToken=${user.accessToken}; adminRefreshToken=${user.refreshToken}`, "x-client-type": "admin" }
			: { cookie: `accessToken=${user.accessToken}; refreshToken=${user.refreshToken}` };
	}

	function get(user: LoginResult, path: string, client: "web" | "admin" | "merchant" = "web"): Promise<InjectResponse> {
		return app.inject({ method: "GET", url: `${API_VERSION_PREFIX}${path}`, headers: { ...sessionHeaders(user, client), "x-forwarded-for": uniqueClientIp() } });
	}

	function post(user: LoginResult, path: string, payload: Record<string, string> = {}, client: "web" | "admin" | "merchant" = "web"): Promise<InjectResponse> {
		return app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}${path}`,
			headers: mutationHeaders({ ...sessionHeaders(user, client), "x-forwarded-for": uniqueClientIp() }),
			payload,
		});
	}

	function errorCode(response: InjectResponse): string {
		return ErrorEnvelopeSchema.parse(response.json()).error.code;
	}

	function claim(): Promise<InjectResponse> {
		return post(alice, "/claims", { rewardId, phone: alicePhone });
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		rewardId = randomUUID();
		const ownerId = z.object({ id: z.string() }).parse((await pool.query(`SELECT id FROM public."User" WHERE email = 'brew.owner@kl-rewards.demo'`)).rows.at(0)).id;
		await withTenantMember(app, ownerId, KL_TENANT_ID, (tx) =>
			tx.reward.create({
				data: {
					id: rewardId,
					tenantId: KL_TENANT_ID,
					title: "E2E ban reward",
					description: "Created by tenant-and-customer-bans.e2e-spec.ts",
					rewardType: "FREE_ITEM",
					category: "cafe",
					images: { create: [{ fileId: rewardCoverImageSeedId("free-coffee"), position: 0 }] },
					quantityTotal: QUANTITY,
					quantityRemaining: QUANTITY,
					expiryDate: Date.now() + 30 * DAY_MS,
					status: "PUBLISHED",
					referralsEnabled: false,
				},
			}),
		);
		await markSeedUserEmailVerified(pool, "alice.johnson@example.com");
		aliceStoredPhone = StoredPhoneSchema.parse(
			(await pool.query(`SELECT phone, "phoneVerifiedAt"::text AS "phoneVerifiedAt" FROM public."User" WHERE email = 'alice.johnson@example.com'`)).rows.at(0),
		);
		alicePhone = aliceStoredPhone.phone !== null && aliceStoredPhone.phoneVerifiedAt !== null ? aliceStoredPhone.phone : ALICE_FIXTURE_PHONE;
		await pool.query(`UPDATE public."User" SET phone = $1, "phoneVerifiedAt" = COALESCE("phoneVerifiedAt", $2) WHERE email = 'alice.johnson@example.com'`, [
			alicePhone,
			Date.now(),
		]);
		aliceRedemption = RedemptionRowSchema.parse(
			(
				await pool.query(
					`SELECT r.id, r."redeemedAt"::text AS "redeemedAt" FROM public."RewardRedemption" r JOIN public."User" u ON u.id = r."userId"
					  WHERE u.email = 'alice.johnson@example.com' AND r."tenantId" = $1 AND r."isDeleted" = false ORDER BY r.id LIMIT 1`,
					[KL_TENANT_ID],
				)
			).rows.at(0),
		);
		superAdmin = await login(app, "superadmin@example.com", "SuperAdmin@123", "admin");
		platformAdmin = await login(app, "admin@example.com", "Admin@123", "admin");
		owner = await login(app, "brew.owner@kl-rewards.demo", "BrewOwner@123", "merchant");
		cashier = await login(app, "brew.cashier@kl-rewards.demo", "BrewCashier@123", "merchant");
		alice = await login(app, "alice.johnson@example.com", "Alice@123");
	});

	afterAll(async () => {
		// Whatever a failed assertion left behind: the merchant is active again and this spec's bans are lifted.
		await pool.query(`UPDATE public."Tenant" SET "lifecycleState" = 'ACTIVE' WHERE id = $1 AND "lifecycleState" = 'BANNED'`, [KL_TENANT_ID]);
		await pool.query(`UPDATE public."TenantCustomerBan" SET "liftedAt" = $2 WHERE id = ANY($1::text[]) AND "liftedAt" IS NULL`, [createdBanIds, Date.now()]);
		await pool.query(`DELETE FROM public."RewardClaim" WHERE "rewardId" = $1`, [rewardId]);
		await pool.query(`DELETE FROM public."RewardImage" WHERE "rewardId" = $1`, [rewardId]);
		await pool.query(`DELETE FROM public."Reward" WHERE id = $1`, [rewardId]);
		await pool.query(`UPDATE public."User" SET phone = $1, "phoneVerifiedAt" = $2::bigint WHERE email = 'alice.johnson@example.com'`, [
			aliceStoredPhone.phone,
			aliceStoredPhone.phoneVerifiedAt,
		]);
		await pool.end();
		await app.close();
	});

	describe("a merchant bans a customer", () => {
		it("refuses a cashier, who cannot manage rewards", async () => {
			const response = await post(cashier, `/tenants/${KL_SLUG}/customer-bans`, { redemptionId: aliceRedemption.id, reason: "Rude" }, "merchant");

			expect(response.statusCode, response.body).toBe(403);
		});

		it("bans the customer behind a redemption; a second ban of the same customer is a conflict", async () => {
			const response = await post(owner, `/tenants/${KL_SLUG}/customer-bans`, { redemptionId: aliceRedemption.id, reason: "  Showed a used voucher  " }, "merchant");

			expect(response.statusCode, response.body).toBe(201);
			const ban = parseSuccessEnvelope(response, TenantCustomerBanResponseSchema).data;
			createdBanIds.push(ban.id);
			expect(ban).toMatchObject({ reason: "Showed a used voucher", source: { redemptionId: aliceRedemption.id } });
			// The response never names the customer: merchants recognise them by the redemption only.
			expect(response.body).not.toContain("alice");

			const again = await post(owner, `/tenants/${KL_SLUG}/customer-bans`, { redemptionId: aliceRedemption.id, reason: "Again" }, "merchant");
			expect(again.statusCode, again.body).toBe(409);
			expect(errorCode(again)).toBe("TENANT_CUSTOMER_ALREADY_BANNED");

			const unknown = await post(owner, `/tenants/${KL_SLUG}/customer-bans`, { redemptionId: randomUUID(), reason: "Unknown" }, "merchant");
			expect(unknown.statusCode, unknown.body).toBe(404);
			expect(errorCode(unknown)).toBe("TENANT_REDEMPTION_NOT_FOUND");
		});

		it("lists the ban, and marks the customer's redemptions as banned in the log (read under the member's RLS session)", async () => {
			const list = await get(owner, `/tenants/${KL_SLUG}/customer-bans`, "merchant");
			expect(list.statusCode, list.body).toBe(200);
			expect(parsePaginatedEnvelope(list, TenantCustomerBanResponseSchema).data.map((ban) => ban.id)).toContain(createdBanIds.at(0));

			const redeemedAt = Number(aliceRedemption.redeemedAt);
			const log = await get(
				owner,
				`/tenants/${KL_SLUG}/redemptions?filter[redeemedAt][gte]=${String(redeemedAt)}&filter[redeemedAt][lt]=${String(redeemedAt + 1)}`,
				"merchant",
			);
			expect(log.statusCode, log.body).toBe(200);
			const row = parsePaginatedEnvelope(log, MerchantRedemptionListItemSchema).data.find((item) => item.redemptionId === aliceRedemption.id);
			expect(row?.customerBanned).toBe(true);
		});

		it("refuses the banned customer's claim, and accepts it once the ban is lifted", async () => {
			const refused = await claim();
			expect(refused.statusCode, refused.body).toBe(403);
			expect(errorCode(refused)).toBe("CLAIM_CUSTOMER_BANNED");

			const banId = z.string().parse(createdBanIds.at(0));
			const lifted = await post(owner, `/tenants/${KL_SLUG}/customer-bans/${banId}/lift`, {}, "merchant");
			expect(lifted.statusCode, lifted.body).toBe(201);
			const liftedAgain = await post(owner, `/tenants/${KL_SLUG}/customer-bans/${banId}/lift`, {}, "merchant");
			expect(liftedAgain.statusCode, liftedAgain.body).toBe(404);

			const accepted = await claim();
			expect(accepted.statusCode, accepted.body).toBe(201);
			expect(parseSuccessEnvelope(accepted, RewardClaimCreatedResponseSchema).data.claim.rewardId).toBe(rewardId);
		});
	});

	describe("a super admin bans a merchant", () => {
		it("refuses a platform admin who is not a super admin", async () => {
			const response = await post(platformAdmin, `/admin/merchants/${KL_TENANT_ID}/ban`, { reason: "Fraud" }, "admin");

			expect(response.statusCode, response.body).toBe(403);
		});

		it("closes the merchant's portal to ordinary routes, hides its rewards, refuses claims, and lifting the ban restores all of it", async () => {
			const banned = await post(superAdmin, `/admin/merchants/${KL_TENANT_ID}/ban`, { reason: "Counterfeit vouchers" }, "admin");
			expect(banned.statusCode, banned.body).toBe(201);
			expect(parseSuccessEnvelope(banned, TenantLifecycleResponseSchema).data).toMatchObject({ lifecycleState: "BANNED", ban: { reason: "Counterfeit vouchers" } });

			const redemptions = await get(owner, `/tenants/${KL_SLUG}/redemptions`, "merchant");
			expect(redemptions.statusCode, redemptions.body).toBe(403);
			expect(errorCode(redemptions)).toBe("TENANT_BANNED");
			const lifecycle = await get(owner, `/tenants/${KL_SLUG}/lifecycle`, "merchant");
			expect(lifecycle.statusCode, lifecycle.body).toBe(200);
			expect(parseSuccessEnvelope(lifecycle, TenantLifecycleResponseSchema).data.lifecycleState).toBe("BANNED");
			const appeal = await post(owner, `/tenants/${KL_SLUG}/lifecycle/appeals`, { message: "Please" }, "merchant");
			expect(appeal.statusCode, appeal.body).toBe(409);

			const marketplace = await get(alice, `/rewards?filter[tenantId]=${KL_TENANT_ID}`);
			expect(marketplace.statusCode, marketplace.body).toBe(200);
			expect(parsePaginatedEnvelope(marketplace, RewardResponseSchema).data).toEqual([]);
			const detail = await get(alice, `/rewards/${rewardId}`);
			expect(detail.statusCode, detail.body).toBe(404);
			const refused = await claim();
			expect(refused.statusCode, refused.body).toBe(404);
			expect(errorCode(refused)).toBe("REWARD_NOT_FOUND");

			const unbanned = await post(superAdmin, `/admin/merchants/${KL_TENANT_ID}/unban`, { reason: "Cleared by the risk team" }, "admin");
			expect(unbanned.statusCode, unbanned.body).toBe(201);
			expect(parseSuccessEnvelope(unbanned, TenantLifecycleResponseSchema).data).toMatchObject({ lifecycleState: "ACTIVE", ban: null });
			expect((await get(owner, `/tenants/${KL_SLUG}/redemptions`, "merchant")).statusCode).toBe(200);
			expect((await get(alice, `/rewards/${rewardId}`)).statusCode).toBe(200);
		});
	});
});

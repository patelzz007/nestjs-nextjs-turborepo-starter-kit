import { randomBytes, randomInt, randomUUID } from "node:crypto";

import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	AdminSalesAnalyticsResponseSchema,
	API_VERSION_PREFIX,
	ApiErrorResponseSchema,
	MerchantAnalyticsResponseSchema,
	RedemptionCheckoutResponseSchema,
	RedemptionPreviewResponseSchema,
	UserRewardsAnalyticsResponseSchema,
	type RedemptionCheckoutInput,
} from "@workspace/shared";

import { ORGANIZATION_SEED_IDS, ORGANIZATION_SEED_SLUGS } from "../prisma/seed/organizations";
import { DEMO_MERCHANT_API_KEYS } from "../prisma/seed/rewards";
import { sha256Hex } from "../src/modules/rewards/utils/reward-crypto.util";
import { createE2eApp, login, type InjectResponse, type LoginResult, mutationHeaders, parseSuccessEnvelope } from "./e2e-helpers";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";

/** Registered to the KL store in the seed (the KL demo key is scoped to that store too). */
const KL_TERMINAL = "KL-REGISTER-01";
/** The fixture reward's minimum spend: RM 20.00. */
const MIN_SPEND_MYR = 20;
const MIN_SPEND_MINOR = 2000;
/** A bill that satisfies the minimum spend: RM 25.00. */
const BILL_MINOR = 2500;
const DAY_MS = 86_400_000;
/** Backup codes: 8 of A–Z (minus I, O) and 2–9. */
const BACKUP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const BACKUP_CODE_LENGTH = 8;
const TOKEN_BYTES = 32;

interface ClaimFixture {
	readonly id: string;
	readonly token: string;
	readonly backupCode: string;
}

function backupCode(): string {
	return Array.from({ length: BACKUP_CODE_LENGTH }, () => BACKUP_CODE_ALPHABET.charAt(randomInt(BACKUP_CODE_ALPHABET.length))).join("");
}

/**
 * POS checkout end to end: the demo KL API key + a registered terminal, a
 * dedicated reward and claims created for this file (removed afterwards).
 */
describe("POS checkout (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let aliceId: string;
	let bobId: string;
	const rewardId = randomUUID();
	const claims: ClaimFixture[] = [];

	async function query(sql: string, values: readonly (string | number | boolean | null)[] = []): Promise<readonly Record<string, string | number | null>[]> {
		const client = await pool.connect();
		try {
			await client.query("SELECT set_config('app.rls_bypass', 'true', false)");
			const result = await client.query<Record<string, string | number | null>>(sql, [...values]);
			return result.rows;
		} finally {
			client.release();
		}
	}

	async function userIdFor(email: string): Promise<string> {
		const [row] = await query(`SELECT id FROM public.users WHERE email = $1`, [email]);
		return String(row?.id);
	}

	async function createClaim(userId: string): Promise<ClaimFixture> {
		const claim = { id: randomUUID(), token: randomBytes(TOKEN_BYTES).toString("base64url"), backupCode: backupCode() };
		const now = Date.now();
		await query(
			`INSERT INTO public.reward_claims (id, user_id, reward_id, redemption_token_hash, backup_code_hash, status, claimed_at, claim_expires_at)
       VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, $7)`,
			[claim.id, userId, rewardId, sha256Hex(claim.token), sha256Hex(claim.backupCode), now, now + DAY_MS],
		);
		await query(
			`UPDATE public.rewards SET quantity_remaining = quantity_remaining - 1, quantity_reserved = quantity_reserved + 1, claim_count = claim_count + 1 WHERE id = $1`,
			[rewardId],
		);
		claims.push(claim);
		return claim;
	}

	async function claimStatus(claimId: string): Promise<string> {
		const [row] = await query(`SELECT status FROM public.reward_claims WHERE id = $1`, [claimId]);
		return String(row?.status);
	}

	function pos(path: string, body: object, terminalId: string = KL_TERMINAL): Promise<InjectResponse> {
		return app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/redemptions/${path}`,
			headers: { "x-api-key": DEMO_MERCHANT_API_KEYS.kl, "x-terminal-id": terminalId, "content-type": "application/json" },
			payload: JSON.stringify(body),
		});
	}

	function checkout(codes: RedemptionCheckoutInput["codes"], billTotalMinor: number = BILL_MINOR, idempotencyKey: string = randomUUID()): Promise<InjectResponse> {
		return pos("checkout", { idempotencyKey, billTotalMinor, currency: "MYR", codes });
	}

	function errorCodeOf(response: InjectResponse): string {
		return ApiErrorResponseSchema.parse(response.json()).error.code;
	}

	function cookies(session: LoginResult): string {
		return `accessToken=${session.accessToken}; refreshToken=${session.refreshToken}`;
	}

	function merchantCookies(session: LoginResult): string {
		return `merchantAccessToken=${session.accessToken}; merchantRefreshToken=${session.refreshToken}`;
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: DATABASE_URL });
		aliceId = await userIdFor("alice.johnson@example.com");
		bobId = await userIdFor("bob.smith@example.com");
		const now = Date.now();
		await query(
			`INSERT INTO public.rewards (id, organization_id, title, description, reward_type, reward_value, category, placeholder_image_key, rules,
         quantity_total, quantity_remaining, expiry_date, status, referrals_enabled)
       VALUES ($1, $2, 'E2E checkout reward', 'Created by pos-checkout.e2e-spec.ts', 'DISCOUNT', 10, 'cafe', 'cafe', $3::jsonb, 50, 50, $4, 'PUBLISHED', false)`,
			[rewardId, ORGANIZATION_SEED_IDS.klOrganization, JSON.stringify({ minSpendMyr: MIN_SPEND_MYR }), now + 30 * DAY_MS],
		);
	});

	afterAll(async () => {
		const ids = claims.map((claim) => claim.id);
		await query(`DELETE FROM public.reward_redemptions WHERE claim_id = ANY($1::text[])`, [`{${ids.join(",")}}`]);
		await query(`DELETE FROM public.reward_sales WHERE user_id IN ($1, $2) AND organization_id = $3 AND terminal_id = ANY($4::text[])`, [
			aliceId,
			bobId,
			ORGANIZATION_SEED_IDS.klOrganization,
			`{${KL_TERMINAL},E2E-UNREGISTERED-TILL}`,
		]);
		await query(`DELETE FROM public.rewards WHERE id = $1`, [rewardId]);
		await pool.end();
		await app.close();
	});

	it("validates a code with why it can (not) be redeemed and the reward's minimum bill", async () => {
		const claim = await createClaim(aliceId);

		const response = await pos("validate", { token: claim.token });

		expect(response.statusCode, response.body).toBe(201);
		const preview = parseSuccessEnvelope(response, RedemptionPreviewResponseSchema).data;
		expect(preview).toMatchObject({ claimId: claim.id, valid: true, invalidReason: null, minSpendMinor: MIN_SPEND_MINOR });
	});

	it("records the bill and redeems every reward on it in one call (QR + backup code)", async () => {
		const first = await createClaim(aliceId);
		const second = await createClaim(aliceId);
		const [before] = await query(`SELECT quantity_reserved, redemption_count FROM public.rewards WHERE id = $1`, [rewardId]);

		const response = await checkout([{ token: first.token }, { backupCode: second.backupCode }]);

		expect(response.statusCode, response.body).toBe(201);
		const sale = parseSuccessEnvelope(response, RedemptionCheckoutResponseSchema).data;
		expect(sale.billTotalMinor).toBe(BILL_MINOR);
		expect(sale.redemptions.map((redemption) => redemption.claimId).toSorted()).toEqual([first.id, second.id].toSorted());
		expect(await claimStatus(first.id)).toBe("REDEEMED");
		expect(await claimStatus(second.id)).toBe("REDEEMED");

		const [after] = await query(`SELECT quantity_reserved, redemption_count FROM public.rewards WHERE id = $1`, [rewardId]);
		expect(Number(after?.quantity_reserved)).toBe(Number(before?.quantity_reserved) - 2);
		expect(Number(after?.redemption_count)).toBe(Number(before?.redemption_count) + 2);

		const [row] = await query(`SELECT location_id, user_id FROM public.reward_sales WHERE id = $1`, [sale.saleId]);
		expect(row).toMatchObject({ location_id: ORGANIZATION_SEED_IDS.klLocation, user_id: aliceId });
		const methods = await query(`SELECT redemption_method FROM public.reward_redemptions WHERE sale_id = $1`, [sale.saleId]);
		expect(methods.map((method) => String(method.redemption_method)).toSorted()).toEqual(["MANUAL", "SCAN"]);
	});

	it("replays a retried checkout instead of redeeming twice, and rejects the key reused for another bill", async () => {
		const claim = await createClaim(aliceId);
		const idempotencyKey = randomUUID();

		const original = parseSuccessEnvelope(await checkout([{ token: claim.token }], BILL_MINOR, idempotencyKey), RedemptionCheckoutResponseSchema).data;
		const retried = await checkout([{ token: claim.token }], BILL_MINOR, idempotencyKey);

		expect(retried.statusCode, retried.body).toBe(201);
		expect(parseSuccessEnvelope(retried, RedemptionCheckoutResponseSchema).data.saleId).toBe(original.saleId);
		const [count] = await query(`SELECT COUNT(*)::int AS n FROM public.reward_sales WHERE organization_id = $1 AND idempotency_key = $2`, [
			ORGANIZATION_SEED_IDS.klOrganization,
			idempotencyKey,
		]);
		expect(count?.n).toBe(1);

		const reused = await checkout([{ token: claim.token }], BILL_MINOR + 1, idempotencyKey);
		expect(reused.statusCode).toBe(409);
		expect(errorCodeOf(reused)).toBe("IDEMPOTENCY_KEY_REUSED");
	});

	it("is all-or-nothing: one already-redeemed code leaves the other rewards untouched", async () => {
		const redeemed = await createClaim(aliceId);
		await checkout([{ token: redeemed.token }]);
		const fresh = await createClaim(aliceId);

		const response = await checkout([{ token: fresh.token }, { token: redeemed.token }]);

		expect(response.statusCode).toBe(409);
		expect(errorCodeOf(response)).toBe("ALREADY_REDEEMED");
		expect(await claimStatus(fresh.id)).toBe("PENDING");

		const preview = parseSuccessEnvelope(await pos("validate", { token: redeemed.token }), RedemptionPreviewResponseSchema).data;
		expect(preview).toMatchObject({ valid: false, invalidReason: "ALREADY_REDEEMED" });
	});

	it("refuses a bill below the reward's minimum spend", async () => {
		const claim = await createClaim(aliceId);

		const response = await checkout([{ token: claim.token }], MIN_SPEND_MINOR - 1);

		expect(response.statusCode).toBe(422);
		expect(errorCodeOf(response)).toBe("MIN_SPEND_NOT_MET");
		expect(await claimStatus(claim.id)).toBe("PENDING");
	});

	it("refuses rewards of different customers on one bill, and the same reward twice", async () => {
		const alices = await createClaim(aliceId);
		const bobs = await createClaim(bobId);

		const mixed = await checkout([{ token: alices.token }, { token: bobs.token }]);
		expect(mixed.statusCode).toBe(422);
		expect(errorCodeOf(mixed)).toBe("MULTIPLE_CUSTOMERS");

		const twice = await checkout([{ token: alices.token }, { backupCode: alices.backupCode }]);
		expect(twice.statusCode).toBe(422);
		expect(errorCodeOf(twice)).toBe("DUPLICATE_REWARD_CODE");
	});

	it("accepts an unregistered till label (the key is the credential) and rejects a malformed one", async () => {
		const claim = await createClaim(bobId);

		const unregistered = await pos(
			"checkout",
			{ idempotencyKey: randomUUID(), billTotalMinor: BILL_MINOR, currency: "MYR", codes: [{ token: claim.token }] },
			"E2E-UNREGISTERED-TILL",
		);
		expect(unregistered.statusCode, unregistered.body).toBe(201);

		const malformed = await pos("validate", { token: claim.token }, "bad terminal id!");
		expect(malformed.statusCode).toBe(400);
		expect(errorCodeOf(malformed)).toBe("TERMINAL_ID_INVALID");
	});

	it("feeds merchant sales, the customer's spending and the admin's platform sales", async () => {
		const owner = await login(app, "brew.owner@kl-rewards.demo", "BrewOwner@123", "merchant");
		const merchant = await app.inject({
			method: "GET",
			url: `${API_VERSION_PREFIX}/orgs/${ORGANIZATION_SEED_SLUGS.kl}/analytics`,
			headers: { cookie: merchantCookies(owner), "x-client-type": "merchant" },
		});
		expect(merchant.statusCode, merchant.body).toBe(200);
		const merchantSales = parseSuccessEnvelope(merchant, MerchantAnalyticsResponseSchema).data.sales;
		expect(merchantSales.totalSalesMinor.value).toBeGreaterThanOrEqual(BILL_MINOR);
		expect(merchantSales.overTime.reduce((sum, week) => sum + week.salesMinor, 0)).toBe(merchantSales.totalSalesMinor.value);

		const alice = await login(app, "alice.johnson@example.com", "Alice@123");
		const user = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/claims/analytics`, headers: { cookie: cookies(alice) } });
		expect(user.statusCode, user.body).toBe(200);
		const spending = parseSuccessEnvelope(user, UserRewardsAnalyticsResponseSchema).data.spending;
		const kl = spending.byMerchant.find((merchantSpend) => merchantSpend.organizationId === ORGANIZATION_SEED_IDS.klOrganization);
		expect(kl?.totalMinor).toBeGreaterThanOrEqual(BILL_MINOR);
		expect(kl?.merchantName.length).toBeGreaterThan(0);
		expect(spending.byCategory.length).toBeGreaterThan(0);

		const consumerAsAdmin = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/admin/analytics/sales`, headers: { cookie: cookies(alice) } });
		expect(consumerAsAdmin.statusCode).toBe(403);

		const superAdmin = await login(app, "superadmin@example.com", "SuperAdmin@123");
		const admin = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/admin/analytics/sales`, headers: mutationHeaders({ cookie: cookies(superAdmin) }) });
		expect(admin.statusCode, admin.body).toBe(200);
		const platform = parseSuccessEnvelope(admin, AdminSalesAnalyticsResponseSchema).data;
		expect(platform.topMerchants.some((merchantSales) => merchantSales.organizationId === ORGANIZATION_SEED_IDS.klOrganization)).toBe(true);
		expect(platform.activeMerchants.value).toBeGreaterThanOrEqual(1);
	});
});

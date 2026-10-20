import { randomBytes, randomUUID } from "node:crypto";

import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import {
	API_VERSION_PREFIX,
	ApiErrorResponseSchema,
	MerchantAnalyticsResponseSchema,
	MerchantApiKeyCreatedSchema,
	MerchantApiKeySummarySchema,
	MerchantRedemptionListItemSchema,
	MerchantTerminalStatusSummarySchema,
	MerchantTerminalSummarySchema,
	MerchantRewardSummarySchema,
	RewardResponseSchema,
} from "@workspace/shared";

import { TENANT_SEED_IDS, TENANT_SEED_SLUGS } from "../prisma/seed/tenants";
import { REWARD_SEED_IDS } from "../prisma/seed/rewards";
import { rewardCoverImageSeedId } from "../prisma/seed/reward-images";
import { INSERT_REWARD_COVER_SQL, rewardCoverParams } from "./support/reward-image-fixture";
import { sha256Hex } from "../src/platform/infrastructure/crypto/sha256";
import { createE2eApp, login, mutationHeaders, parsePaginatedEnvelope, parseSuccessEnvelope, type InjectResponse, type LoginResult } from "./e2e-helpers";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";

const KATIL = TENANT_SEED_IDS.mlkLocationKatil;
const BERUANG = TENANT_SEED_IDS.mlkLocationBeruang;
const ORG_PATH = `${API_VERSION_PREFIX}/tenants/${TENANT_SEED_SLUGS.mlk}`;
/** Distinctive bill totals, so a leak of the other store's bill is visible in every total. */
const KATIL_BILL_MINOR = 777_777;
const BERUANG_BILL_MINOR = 3_333;
const DAY_MS = 86_400_000;
const TOKEN_BYTES = 32;
/** Every API key this file creates is named with this prefix, so cleanup finds exactly them. */
const KEY_NAME_PREFIX = "E2E location scope";

const KeyListSchema = z.array(MerchantApiKeySummarySchema);
const TerminalListSchema = z.array(MerchantTerminalSummarySchema);
const RedemptionListSchema = z.array(MerchantRedemptionListItemSchema);

/**
 * Store scope is enforced server-side on every merchant path. Jonker Street
 * Kitchen has two stores; its seeded cashier (and a store-limited admin this
 * file adds) may only see Bukit Beruang. Omitting `locationId` must mean
 * "my stores", never "every store".
 */
describe("Merchant store scope (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let owner: LoginResult;
	let cashier: LoginResult;
	let storeAdmin: LoginResult;
	let storeAdminId: string;
	let aliceId: string;
	const adminMembershipId = randomUUID();
	const rewardId = randomUUID();
	const katilRedemptionId = randomUUID();
	const beruangRedemptionId = randomUUID();
	const claimIds: string[] = [];
	const saleIds: string[] = [];

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
		const [row] = await query(`SELECT id FROM public."User" WHERE email = $1`, [email]);
		return String(row?.id);
	}

	/** One paid bill at `locationId` with one redeemed claim on it. */
	async function insertRedemption(redemptionId: string, locationId: string, billTotalMinor: number): Promise<void> {
		const now = Date.now();
		const claimId = randomUUID();
		const saleId = randomUUID();
		claimIds.push(claimId);
		saleIds.push(saleId);
		await query(
			`INSERT INTO public."RewardClaim" (id, "userId", "rewardId", "redemptionTokenHash", "backupCodeHash", status, "claimedAt", "claimExpiresAt", "redeemedAt")
       VALUES ($1, $2, $3, $4, $5, 'REDEEMED', $6, $7, $6)`,
			[claimId, aliceId, rewardId, sha256Hex(randomBytes(TOKEN_BYTES).toString("base64url")), sha256Hex(randomUUID()), now, now + DAY_MS],
		);
		await query(
			`INSERT INTO public."RewardSale" (id, "tenantId", "locationId", "userId", "terminalId", "billTotalMinor", currency, "idempotencyKey", "requestHash", "paidAt")
       VALUES ($1, $2, $3, $4, 'E2E-SCOPE-TILL', $5, 'MYR', $6, $7, $8)`,
			[saleId, TENANT_SEED_IDS.mlkTenant, locationId, aliceId, billTotalMinor, randomUUID(), sha256Hex(saleId), now],
		);
		await query(
			`INSERT INTO public."RewardRedemption" (id, "claimId", "tenantId", "locationId", "userId", "terminalId", "redemptionMethod", "saleId", "redeemedAt")
       VALUES ($1, $2, $3, $4, $5, 'E2E-SCOPE-TILL', 'SCAN', $6, $7)`,
			[redemptionId, claimId, TENANT_SEED_IDS.mlkTenant, locationId, aliceId, saleId, now],
		);
	}

	function merchantHeaders(session: LoginResult): Record<string, string> {
		return { cookie: `merchantAccessToken=${session.accessToken}; merchantRefreshToken=${session.refreshToken}`, "x-client-type": "merchant" };
	}

	function get(session: LoginResult, path: string): Promise<InjectResponse> {
		return app.inject({ method: "GET", url: `${ORG_PATH}${path}`, headers: merchantHeaders(session) });
	}

	function post(session: LoginResult, path: string, payload: object = {}): Promise<InjectResponse> {
		return app.inject({ method: "POST", url: `${ORG_PATH}${path}`, headers: mutationHeaders(merchantHeaders(session)), payload });
	}

	/** A machine route: the key names its own tenant and store, so the path carries no slug (D6). */
	function withKey(apiKey: string, path: string): Promise<InjectResponse> {
		return app.inject({ method: "GET", url: `${API_VERSION_PREFIX}${path}`, headers: { "x-api-key": apiKey } });
	}

	function errorCodeOf(response: InjectResponse): string {
		return ApiErrorResponseSchema.parse(response.json()).error.code;
	}

	async function createKey(session: LoginResult, body: { readonly locationId?: string; readonly scope?: "POS" | "INTEGRATION" }): Promise<InjectResponse> {
		return post(session, "/api-keys", { name: `${KEY_NAME_PREFIX} ${randomUUID()}`, ...body });
	}

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: DATABASE_URL });
		aliceId = await userIdFor("alice.johnson@example.com");
		storeAdminId = await userIdFor("alice.kl@kl-rewards.demo");

		// A store-limited ADMIN (may manage API keys and terminals, but only at Bukit Beruang).
		await query(`INSERT INTO public."Membership" (id, "tenantId", "userId", role, status) VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE')`, [
			adminMembershipId,
			TENANT_SEED_IDS.mlkTenant,
			storeAdminId,
		]);
		await query(`INSERT INTO public."MembershipLocationScope" (id, "tenantId", "membershipId", "scopeType", "locationId") VALUES ($1, $2, $3, 'SELECTED', $4)`, [
			randomUUID(),
			TENANT_SEED_IDS.mlkTenant,
			adminMembershipId,
			BERUANG,
		]);

		await query(
			`INSERT INTO public."Reward" (id, "tenantId", title, description, "rewardType", "rewardValue", category, "quantityTotal", "quantityRemaining", "expiryDate", status, "referralsEnabled")
       VALUES ($1, $2, 'E2E store-scope reward', 'Created by merchant-location-scope.e2e-spec.ts', 'DISCOUNT', 10, 'restaurant', 10, 10, $3, 'PUBLISHED', false)`,
			[rewardId, TENANT_SEED_IDS.mlkTenant, Date.now() + 30 * DAY_MS],
		);
		await query(INSERT_REWARD_COVER_SQL, [...rewardCoverParams(rewardId, TENANT_SEED_IDS.mlkTenant, "weekend-dinner")]);
		await insertRedemption(katilRedemptionId, KATIL, KATIL_BILL_MINOR);
		await insertRedemption(beruangRedemptionId, BERUANG, BERUANG_BILL_MINOR);

		owner = await login(app, "jonker.owner@melaka-rewards.demo", "JonkerOwner@123", "merchant");
		cashier = await login(app, "jonker.cashier@melaka-rewards.demo", "JonkerCashier@123", "merchant");
		storeAdmin = await login(app, "alice.kl@kl-rewards.demo", "AliceKl@123", "merchant");
	});

	afterAll(async () => {
		await query(`DELETE FROM public."RewardRedemption" WHERE id = ANY($1::text[])`, [`{${katilRedemptionId},${beruangRedemptionId}}`]);
		await query(`DELETE FROM public."RewardSale" WHERE id = ANY($1::text[])`, [`{${saleIds.join(",")}}`]);
		await query(`DELETE FROM public."RewardClaim" WHERE id = ANY($1::text[])`, [`{${claimIds.join(",")}}`]);
		await query(`DELETE FROM public."Reward" WHERE id = $1`, [rewardId]);
		await query(`DELETE FROM public."TenantApiKey" WHERE name LIKE $1`, [`${KEY_NAME_PREFIX}%`]);
		await query(`DELETE FROM public."MembershipLocationScope" WHERE "membershipId" = $1`, [adminMembershipId]);
		await query(`DELETE FROM public."Membership" WHERE id = $1`, [adminMembershipId]);
		await pool.end();
		await app.close();
	});

	describe("redemptions", () => {
		it("lists only the member's stores when no store is named", async () => {
			const response = await get(cashier, "/redemptions");

			expect(response.statusCode, response.body).toBe(200);
			const ids = parseSuccessEnvelope(response, RedemptionListSchema).data.map((item) => item.redemptionId);
			expect(ids).toContain(beruangRedemptionId);
			expect(ids).not.toContain(katilRedemptionId);
		});

		it("refuses another store named explicitly", async () => {
			const response = await get(cashier, `/redemptions?locationId=${KATIL}`);

			expect(response.statusCode).toBe(403);
			expect(errorCodeOf(response)).toBe("TENANT_LOCATION_FORBIDDEN");
		});

		it("still shows an all-stores member every store", async () => {
			const ids = parseSuccessEnvelope(await get(owner, "/redemptions"), RedemptionListSchema).data.map((item) => item.redemptionId);

			expect(ids).toEqual(expect.arrayContaining([katilRedemptionId, beruangRedemptionId]));
		});
	});

	describe("analytics", () => {
		it("leaves the other store's bills out of a store-limited member's sales and redemptions", async () => {
			const scoped = parseSuccessEnvelope(await get(cashier, "/analytics"), MerchantAnalyticsResponseSchema).data;
			const everything = parseSuccessEnvelope(await get(owner, "/analytics"), MerchantAnalyticsResponseSchema).data;

			expect(scoped.sales.totalSalesMinor.value).toBeGreaterThanOrEqual(BERUANG_BILL_MINOR);
			expect(everything.sales.totalSalesMinor.value - scoped.sales.totalSalesMinor.value).toBeGreaterThanOrEqual(KATIL_BILL_MINOR);
			expect(everything.totalRedemptions.value).toBeGreaterThan(scoped.totalRedemptions.value);
		});

		it("refuses another store named explicitly", async () => {
			expect((await get(cashier, `/analytics?locationId=${KATIL}`)).statusCode).toBe(403);
		});
	});

	describe("rewards", () => {
		it("lists tenant-wide rewards and the member's stores' rewards, not another store's", async () => {
			// One page as large as the grammar allows: the assertion is about scope, not paging.
			const response = await get(cashier, "/rewards?limit=100");

			expect(response.statusCode, response.body).toBe(200);
			const ids = parseSuccessEnvelope(response, z.array(RewardResponseSchema)).data.map((reward) => reward.id);
			expect(ids).toContain(REWARD_SEED_IDS.mlkRewardBeruangOnly);
			expect(ids).toContain(rewardId);
			expect(ids).not.toContain(REWARD_SEED_IDS.mlkRewardKatilOnly);
		});

		it("pages the same scope and summarizes it: the status counts add up to the list's total", async () => {
			const page = await get(cashier, "/rewards?limit=1");
			expect(page.statusCode, page.body).toBe(200);
			const { meta, data } = parsePaginatedEnvelope(page, RewardResponseSchema);
			const { total } = meta;
			expect(data).toHaveLength(1);

			const summary = await get(cashier, "/rewards/summary");
			expect(summary.statusCode, summary.body).toBe(200);
			const figures = parseSuccessEnvelope(summary, MerchantRewardSummarySchema).data;
			expect(Object.values(figures.countsByStatus).reduce((sum, count) => sum + count, 0)).toBe(total);

			const published = await get(cashier, "/rewards?limit=1&filter[status][in]=PUBLISHED");
			expect(parsePaginatedEnvelope(published, RewardResponseSchema).meta.total).toBe(figures.countsByStatus.PUBLISHED);
		});

		it("refuses the summary of another store named explicitly", async () => {
			expect((await get(cashier, `/rewards/summary?locationId=${KATIL}`)).statusCode).toBe(403);
		});

		it("lets a store-limited member offer rewards only at its own stores", async () => {
			const base = {
				title: "E2E scoped reward",
				description: "Created by merchant-location-scope.e2e-spec.ts",
				rewardType: "DISCOUNT",
				rewardValue: 5,
				category: "restaurant",
				imageFileIds: [rewardCoverImageSeedId("weekend-dinner"), rewardCoverImageSeedId("heritage-set")],
				quantityTotal: 5,
				expiryDate: Date.now() + 30 * DAY_MS,
			};

			const orgWide = await post(storeAdmin, "/rewards", base);
			expect(orgWide.statusCode).toBe(403);
			expect(errorCodeOf(orgWide)).toBe("TENANT_LOCATION_FORBIDDEN");

			const otherStore = await post(storeAdmin, "/rewards", { ...base, locationScopeType: "SELECTED", locationIds: [KATIL] });
			expect(otherStore.statusCode).toBe(403);

			// Its own store, but one of the images belongs to another tenant: refused before anything is written.
			const foreignCover = await post(storeAdmin, "/rewards", {
				...base,
				imageFileIds: [rewardCoverImageSeedId("weekend-dinner"), rewardCoverImageSeedId("free-coffee")],
				locationScopeType: "SELECTED",
				locationIds: [BERUANG],
			});
			expect(foreignCover.statusCode).toBe(400);
			expect(errorCodeOf(foreignCover)).toBe("REWARD_IMAGES_INVALID");
		});

		it("hides a tenant-wide reward from a store-limited member's edits (404)", async () => {
			const response = await app.inject({
				method: "PATCH",
				url: `${ORG_PATH}/rewards/${rewardId}`,
				headers: mutationHeaders(merchantHeaders(storeAdmin)),
				payload: { title: "Hijacked" },
			});

			expect(response.statusCode).toBe(404);
		});
	});

	describe("API keys", () => {
		it("lets a store-limited admin create keys only for its own store", async () => {
			const orgWide = await createKey(storeAdmin, {});
			expect(orgWide.statusCode).toBe(403);
			expect(errorCodeOf(orgWide)).toBe("API_KEY_LOCATION_REQUIRED");

			expect((await createKey(storeAdmin, { locationId: KATIL })).statusCode).toBe(403);

			const own = await createKey(storeAdmin, { locationId: BERUANG });
			expect(own.statusCode, own.body).toBe(201);
			expect(parseSuccessEnvelope(own, MerchantApiKeyCreatedSchema).data).toMatchObject({ locationId: BERUANG, scope: "POS" });
		});

		it("lists only the admin's store's keys and hides others' from revocation", async () => {
			const katilKey = parseSuccessEnvelope(await createKey(owner, { locationId: KATIL }), MerchantApiKeyCreatedSchema).data;
			const orgWideKey = parseSuccessEnvelope(await createKey(owner, {}), MerchantApiKeyCreatedSchema).data;

			const listed = parseSuccessEnvelope(await get(storeAdmin, "/api-keys"), KeyListSchema).data;
			expect(listed.length).toBeGreaterThan(0);
			expect(listed.every((key) => key.locationId === BERUANG)).toBe(true);

			for (const keyId of [katilKey.id, orgWideKey.id]) {
				const revoked = await post(storeAdmin, `/api-keys/${keyId}/revoke`);
				expect(revoked.statusCode).toBe(404);
			}
		});
	});

	describe("terminals", () => {
		it("lists only the admin's store's tills and hides another store's till from re-pairing and removal", async () => {
			const listed = parseSuccessEnvelope(await get(storeAdmin, "/terminals"), TerminalListSchema).data;
			expect(listed.length).toBeGreaterThan(0);
			expect(listed.every((terminal) => terminal.locationId === BERUANG)).toBe(true);

			const [katilTill] = await query(`SELECT id FROM public."TenantTerminal" WHERE "tenantId" = $1 AND "locationId" = $2 AND "isDeleted" = false LIMIT 1`, [
				TENANT_SEED_IDS.mlkTenant,
				KATIL,
			]);
			const katilTillId = String(katilTill?.id);
			expect((await post(storeAdmin, `/terminals/${katilTillId}/pairing-code`)).statusCode).toBe(404);
			const removed = await app.inject({ method: "DELETE", url: `${ORG_PATH}/terminals/${katilTillId}`, headers: mutationHeaders(merchantHeaders(storeAdmin)) });
			expect(removed.statusCode).toBe(404);
		});
	});

	describe("API key callers", () => {
		it("keep a store-scoped integration key on its own store", async () => {
			const key = parseSuccessEnvelope(await createKey(owner, { locationId: KATIL, scope: "INTEGRATION" }), MerchantApiKeyCreatedSchema).data;

			const own = await withKey(key.apiKey, "/integration/redemptions");
			expect(own.statusCode, own.body).toBe(200);
			expect(parseSuccessEnvelope(own, RedemptionListSchema).data.some((item) => item.redemptionId === beruangRedemptionId)).toBe(false);

			const other = await withKey(key.apiKey, `/integration/redemptions?locationId=${BERUANG}`);
			expect(other.statusCode).toBe(403);
			expect(errorCodeOf(other)).toBe("API_KEY_LOCATION_FORBIDDEN");
		});

		it("refuse a POS key on the integration history", async () => {
			const key = parseSuccessEnvelope(await createKey(owner, { locationId: KATIL, scope: "POS" }), MerchantApiKeyCreatedSchema).data;

			const response = await withKey(key.apiKey, "/integration/redemptions");
			expect(response.statusCode).toBe(403);
			expect(errorCodeOf(response)).toBe("API_KEY_SCOPE_FORBIDDEN");
		});

		it("MACH-002: refuse a key that also names a tenant, by slug or id, in the query or the body", async () => {
			const key = parseSuccessEnvelope(await createKey(owner, { scope: "INTEGRATION" }), MerchantApiKeyCreatedSchema).data;

			for (const path of [`/integration/redemptions?tenantSlug=${TENANT_SEED_SLUGS.mlk}`, `/integration/redemptions?tenantId=${TENANT_SEED_IDS.mlkTenant}`]) {
				const response = await withKey(key.apiKey, path);
				expect(response.statusCode, path).toBe(400);
				expect(errorCodeOf(response)).toBe("TENANT_SELECTOR_NOT_ALLOWED");
			}
			const created = await app.inject({
				method: "POST",
				url: `${API_VERSION_PREFIX}/integration/rewards`,
				headers: { "x-api-key": key.apiKey },
				payload: { tenantSlug: TENANT_SEED_SLUGS.mlk },
			});
			expect(created.statusCode).toBe(400);
			expect(errorCodeOf(created)).toBe("TENANT_SELECTOR_NOT_ALLOWED");
		});

		it("accept the informational x-tenant-id and x-location-id headers on a key's call, and answer exactly as without them", async () => {
			const key = parseSuccessEnvelope(await createKey(owner, { locationId: KATIL, scope: "INTEGRATION" }), MerchantApiKeyCreatedSchema).data;

			const plain = await withKey(key.apiKey, "/integration/redemptions");
			// Even a store outside the key's scope (Beruang): the headers select nothing, so the key's own scope answers.
			const informed = await app.inject({
				method: "GET",
				url: `${API_VERSION_PREFIX}/integration/redemptions`,
				headers: { "x-api-key": key.apiKey, "x-tenant-id": TENANT_SEED_IDS.mlkTenant, "x-location-id": BERUANG },
			});

			expect(informed.statusCode, informed.body).toBe(200);
			expect(parseSuccessEnvelope(informed, RedemptionListSchema).data).toEqual(parseSuccessEnvelope(plain, RedemptionListSchema).data);
		});

		it("serve an integration key its own tenant's rewards, reward summary and analytics under /integration", async () => {
			const key = parseSuccessEnvelope(await createKey(owner, { scope: "INTEGRATION" }), MerchantApiKeyCreatedSchema).data;

			for (const path of [
				"/integration/rewards?limit=5",
				"/integration/rewards/summary",
				"/integration/analytics",
				`/integration/rewards/${REWARD_SEED_IDS.mlkRewardBeruangOnly}`,
			]) {
				const response = await withKey(key.apiKey, path);
				expect(response.statusCode, `${path}: ${response.body}`).toBe(200);
			}
		});

		it("let an integration key write server to server, with no Origin or mutation-intent header", async () => {
			const key = parseSuccessEnvelope(await createKey(owner, { scope: "INTEGRATION" }), MerchantApiKeyCreatedSchema).data;

			const response = await app.inject({
				method: "PATCH",
				url: `${API_VERSION_PREFIX}/integration/rewards/${randomUUID()}`,
				headers: { "x-api-key": key.apiKey },
				payload: { quantityTotal: 5 },
			});

			// Past every guard to the handler, which finds no such reward.
			expect(response.statusCode, response.body).toBe(404);
		});

		it("keep a store-scoped integration key's rewards on its own store", async () => {
			const key = parseSuccessEnvelope(await createKey(owner, { locationId: KATIL, scope: "INTEGRATION" }), MerchantApiKeyCreatedSchema).data;

			expect((await withKey(key.apiKey, `/integration/rewards/${REWARD_SEED_IDS.mlkRewardKatilOnly}`)).statusCode).toBe(200);
			expect((await withKey(key.apiKey, `/integration/rewards/${REWARD_SEED_IDS.mlkRewardBeruangOnly}`)).statusCode).toBe(404);
		});

		it("do not authenticate a key on a members-only tenant route (401)", async () => {
			const key = parseSuccessEnvelope(await createKey(owner, { scope: "INTEGRATION" }), MerchantApiKeyCreatedSchema).data;

			for (const path of ["/redemptions", "/rewards", "/analytics"]) {
				const response = await app.inject({ method: "GET", url: `${ORG_PATH}${path}`, headers: { "x-api-key": key.apiKey } });
				expect(response.statusCode, path).toBe(401);
			}
		});

		it("refuse a signed-in member on the integration routes, which name no tenant (401)", async () => {
			const response = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/integration/rewards`, headers: merchantHeaders(owner) });

			expect(response.statusCode).toBe(401);
		});
	});

	describe("merchant read endpoints", () => {
		it("summarises only the member's stores' terminals (counts match the scoped list)", async () => {
			const scoped = parseSuccessEnvelope(await get(storeAdmin, "/terminals/summary"), MerchantTerminalStatusSummarySchema).data;
			const listed = parseSuccessEnvelope(await get(storeAdmin, "/terminals"), TerminalListSchema).data;
			const everything = parseSuccessEnvelope(await get(owner, "/terminals/summary"), MerchantTerminalStatusSummarySchema).data;

			expect(scoped.total).toBe(listed.length);
			expect(scoped.byStatus.AWAITING_PAIRING + scoped.byStatus.ACTIVE + scoped.byStatus.UNPAIRED).toBe(scoped.total);
			expect(scoped.storesWithTerminals).toBe(1);
			expect(everything.total).toBeGreaterThan(scoped.total);
			expect(everything.storesWithTerminals).toBe(2);
			expect((await get(storeAdmin, `/terminals/summary?locationId=${KATIL}`)).statusCode).toBe(403);
		});

		it("reads one terminal of the member's stores and 404s another store's terminal", async () => {
			const [own] = parseSuccessEnvelope(await get(storeAdmin, "/terminals"), TerminalListSchema).data;
			const ownId = String(own?.id);
			const read = await get(storeAdmin, `/terminals/${ownId}`);
			expect(read.statusCode, read.body).toBe(200);
			expect(parseSuccessEnvelope(read, MerchantTerminalSummarySchema).data.id).toBe(ownId);

			const [katilTill] = await query(`SELECT id FROM public."TenantTerminal" WHERE "tenantId" = $1 AND "locationId" = $2 AND "isDeleted" = false LIMIT 1`, [
				TENANT_SEED_IDS.mlkTenant,
				KATIL,
			]);
			expect((await get(storeAdmin, `/terminals/${String(katilTill?.id)}`)).statusCode).toBe(404);
		});

		it("reads one reward offered at the member's stores and 404s a reward limited to another store", async () => {
			const read = await get(cashier, `/rewards/${REWARD_SEED_IDS.mlkRewardBeruangOnly}`);
			expect(read.statusCode, read.body).toBe(200);
			expect(parseSuccessEnvelope(read, RewardResponseSchema).data.id).toBe(REWARD_SEED_IDS.mlkRewardBeruangOnly);

			expect((await get(cashier, `/rewards/${REWARD_SEED_IDS.mlkRewardKatilOnly}`)).statusCode).toBe(404);
			expect((await get(owner, `/rewards/${REWARD_SEED_IDS.mlkRewardKatilOnly}`)).statusCode).toBe(200);
		});

		it("reports when the first bill in scope was paid", async () => {
			const scoped = parseSuccessEnvelope(await get(cashier, "/analytics"), MerchantAnalyticsResponseSchema).data;

			expect(scoped.sales.firstBillAt).not.toBeNull();
		});
	});
});

import { randomUUID } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX, RewardResponseSchema } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { TENANT_SEED_IDS } from "../../../prisma/seed/tenant-seed-ids";
import { TENANT_SEED_SLUGS } from "../../../prisma/seed/tenants";
import { getApiConfig } from "../../../src/config/api-config";
import { CryptoService } from "../../../src/contexts/identity/infrastructure/security/crypto.service";
import { PrismaService } from "../../../src/prisma/prisma.service";
import { createE2eApp, login, mutationHeaders, type InjectResponse, type LoginResult, uniqueClientIp } from "../../e2e-helpers";
import { seedTwoTenantFixture, TWO_TENANT_FIXTURE } from "../../support/two-tenant-fixture";

/**
 * Another tenant's ids over HTTP (IDOR): a member who names a record of another tenant — on their own tenant's route,
 * or on the other tenant's — is answered exactly as for a record that does not exist, and the record is not changed.
 * The database half (row-level security over every table) is e2e/rls/cross-tenant-isolation.e2e-spec.ts; this proves
 * what a client is told, and that the per-record capabilities a reward reports are the caller's own.
 *
 * The two-tenant fixture names the ids; its rewards carry no images, so the reads that answer a whole reward (the
 * list, one reward) use the development seed's two tenants, as MT-006 does.
 */

const FIXTURE_PASSWORD = "Fixture@CrossTenant1";
const ids = TWO_TENANT_FIXTURE;
const FIXTURE_A_REWARDS = `${API_VERSION_PREFIX}/tenants/fixture-tenant-a/rewards`;
const FIXTURE_B_REWARDS = `${API_VERSION_PREFIX}/tenants/fixture-tenant-b/rewards`;
const KL_REWARDS = `${API_VERSION_PREFIX}/tenants/${TENANT_SEED_SLUGS.kl}/rewards`;
const HTTP_OK = 200;

const RewardEnvelopeSchema = z.object({ data: RewardResponseSchema });
const RewardListEnvelopeSchema = z.object({ data: z.array(RewardResponseSchema) });

/** What a client can tell from an answer: its status and its error code. */
interface Answer {
	readonly status: number;
	readonly code: string | null;
}

const ErrorEnvelopeSchema = z.object({ success: z.literal(false), error: z.object({ code: z.string() }) });

function answerOf(response: InjectResponse): Answer {
	const error = ErrorEnvelopeSchema.safeParse(response.json());
	return { status: response.statusCode, code: error.success ? error.data.error.code : null };
}

describe("tenancy multi: another tenant's ids over HTTP", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let fixtureOwnerA: LoginResult;
	let fixtureCustomer: LoginResult;
	let klOwner: LoginResult;
	let klCashier: LoginResult;

	async function send(user: LoginResult, method: "GET" | "PATCH" | "POST", url: string, payload?: object): Promise<InjectResponse> {
		const headers = { authorization: `Bearer ${user.accessToken}`, "x-forwarded-for": uniqueClientIp() };
		return app.inject({ method, url, headers: method === "GET" ? headers : mutationHeaders(headers), ...(payload === undefined ? {} : { payload }) });
	}

	/** The answer to the same request naming a reward that does not exist anywhere. */
	async function missingRewardAnswer(user: LoginResult, method: "GET" | "PATCH" | "POST", base: string, suffix: string, payload?: object): Promise<Answer> {
		return answerOf(await send(user, method, `${base}/${randomUUID()}${suffix}`, payload));
	}

	async function rewardRow(rewardId: string): Promise<{ readonly title: string; readonly status: string }> {
		const result = await pool.query<{ title: string; status: string }>(`SELECT title, status::text AS status FROM public."Reward" WHERE id = $1`, [rewardId]);
		const [row] = result.rows;
		if (row === undefined) {
			throw new Error(`reward ${rewardId} is missing`);
		}
		return row;
	}

	beforeAll(async () => {
		app = await createE2eApp();
		await seedTwoTenantFixture(app.get(PrismaService));
		pool = new Pool({ connectionString: getApiConfig().database.url });
		const passwordHash = await app.get(CryptoService).hash(FIXTURE_PASSWORD);
		await pool.query(`UPDATE public."User" SET "passwordHash" = $1 WHERE id = ANY($2::text[])`, [passwordHash, [ids.userAOwner, ids.userCustomerC]]);
		fixtureOwnerA = await login(app, "fixture-a-owner@example.com", FIXTURE_PASSWORD);
		fixtureCustomer = await login(app, "fixture-customer-c@example.com", FIXTURE_PASSWORD);
		klOwner = await login(app, "brew.owner@kl-rewards.demo", "BrewOwner@123", "merchant");
		klCashier = await login(app, "brew.cashier@kl-rewards.demo", "BrewCashier@123", "merchant");
	});

	afterAll(async () => {
		await pool.end();
		await app.close();
	});

	it("answers another tenant's reward, named on one's own route, exactly as a reward that does not exist", async () => {
		for (const rewardId of [ids.rewardBDraft, ids.rewardB]) {
			for (const suffix of ["", "/audience"]) {
				const named = answerOf(await send(fixtureOwnerA, "GET", `${FIXTURE_A_REWARDS}/${rewardId}${suffix}`));
				expect(named, `${rewardId}${suffix}`).toStrictEqual(await missingRewardAnswer(fixtureOwnerA, "GET", FIXTURE_A_REWARDS, suffix));
				expect(named.status).not.toBe(HTTP_OK);
			}
		}
	});

	it("never edits or submits another tenant's reward named on one's own route, and leaves it exactly as it was", async () => {
		const before = await rewardRow(ids.rewardBDraft);
		const edit = { title: "Changed by another tenant" };

		const edited = answerOf(await send(fixtureOwnerA, "PATCH", `${FIXTURE_A_REWARDS}/${ids.rewardBDraft}`, edit));
		const submitted = answerOf(await send(fixtureOwnerA, "POST", `${FIXTURE_A_REWARDS}/${ids.rewardBDraft}/publish`));

		expect(edited).toStrictEqual(await missingRewardAnswer(fixtureOwnerA, "PATCH", FIXTURE_A_REWARDS, "", edit));
		expect(submitted).toStrictEqual(await missingRewardAnswer(fixtureOwnerA, "POST", FIXTURE_A_REWARDS, "/publish"));
		expect(await rewardRow(ids.rewardBDraft)).toStrictEqual(before);
	});

	it("does not serve another tenant's routes to a member, nor a tenant's routes to a customer", async () => {
		const tenantMissing = answerOf(await send(fixtureOwnerA, "GET", `${API_VERSION_PREFIX}/tenants/no-such-tenant-${randomUUID()}/rewards`));
		expect(tenantMissing.status).not.toBe(HTTP_OK);

		for (const url of [FIXTURE_B_REWARDS, `${FIXTURE_B_REWARDS}/${ids.rewardBDraft}`, `${API_VERSION_PREFIX}/tenants/fixture-tenant-b/kyb`]) {
			expect(answerOf(await send(fixtureOwnerA, "GET", url)), url).toStrictEqual(tenantMissing);
		}
		for (const url of [FIXTURE_A_REWARDS, `${FIXTURE_A_REWARDS}/${ids.rewardADraft}`]) {
			expect(answerOf(await send(fixtureCustomer, "GET", url)), url).toStrictEqual(tenantMissing);
		}
	});

	it("lists only the tenant's own rewards, and answers the other seeded tenant's reward as missing", async () => {
		const response = await send(klOwner, "GET", KL_REWARDS);
		expect(response.statusCode, response.body).toBe(HTTP_OK);
		const rewards = RewardListEnvelopeSchema.parse(response.json()).data;
		expect(rewards.length).toBeGreaterThan(0);
		expect(rewards.filter((reward) => reward.tenantId !== TENANT_SEED_IDS.klTenant).map((reward) => reward.id)).toStrictEqual([]);

		const melaka = await pool.query<{ id: string }>(`SELECT id FROM public."Reward" WHERE "tenantId" = $1 AND "isDeleted" = false LIMIT 1`, [TENANT_SEED_IDS.mlkTenant]);
		const [melakaReward] = melaka.rows;
		expect(melakaReward).toBeDefined();
		if (melakaReward !== undefined) {
			expect(answerOf(await send(klOwner, "GET", `${KL_REWARDS}/${melakaReward.id}`))).toStrictEqual(await missingRewardAnswer(klOwner, "GET", KL_REWARDS, ""));
		}
	});

	it("reports each caller's own per-record capabilities on a reward, and refuses the edit of one who may only view it", async () => {
		const cashierList = await send(klCashier, "GET", KL_REWARDS);
		expect(cashierList.statusCode, cashierList.body).toBe(HTTP_OK);
		const [visible] = RewardListEnvelopeSchema.parse(cashierList.json()).data;
		expect(visible).toBeDefined();
		if (visible === undefined) {
			return;
		}
		const url = `${KL_REWARDS}/${visible.id}`;

		const asOwner = await send(klOwner, "GET", url);
		const asCashier = await send(klCashier, "GET", url);
		expect(asOwner.statusCode, asOwner.body).toBe(HTTP_OK);
		expect(asCashier.statusCode, asCashier.body).toBe(HTTP_OK);
		expect(RewardEnvelopeSchema.parse(asOwner.json()).data.viewerCapabilities).toStrictEqual({ update: true, publish: true });
		expect(RewardEnvelopeSchema.parse(asCashier.json()).data.viewerCapabilities).toStrictEqual({ update: false, publish: false });

		const before = await rewardRow(visible.id);
		const edited = await send(klCashier, "PATCH", url, { title: "Changed by a cashier" });
		expect(edited.statusCode, edited.body).not.toBe(HTTP_OK);
		expect(await rewardRow(visible.id)).toStrictEqual(before);
	});
});

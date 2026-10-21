import { randomBytes, randomInt, randomUUID } from "node:crypto";

import { CommandBus } from "@nestjs/cqrs";
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

import { TENANT_SEED_IDS, TENANT_SEED_SLUGS } from "../prisma/seed/tenants";
import { DEMO_MERCHANT_API_KEYS, REWARD_SEED_IDS } from "../prisma/seed/rewards";
import { SweepReferrerCreditEmailsCommand } from "../src/contexts/claims/application/commands/sweep-referrer-credit-emails/sweep-referrer-credit-emails.command";
import { POS_CODE_MAX_FAILURES } from "../src/contexts/pos/public-api";
import { systemActor } from "../src/platform/application/actor-context";
import { sha256Hex } from "../src/platform/infrastructure/crypto/sha256";
import { INSERT_REWARD_COVER_SQL, rewardCoverParams } from "./support/reward-image-fixture";
import { RewardCodeHasher } from "../src/platform/infrastructure/crypto/reward-code-hasher";
import { createE2eApp, login, markSeedUserEmailVerified, mutationHeaders, parseSuccessEnvelope, type InjectResponse, type LoginResult } from "./e2e-helpers";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";

/** Registered to the KL store in the seed (the KL demo key is scoped to that store too). */
const KL_TERMINAL = "KL-REGISTER-01";
/** The fixture reward's minimum spend: RM 20.00. */
const MIN_SPEND_MINOR = 2000;
/** Parallel requests in the concurrency tests. */
const PARALLEL_REQUESTS = 5;
/** A bill that satisfies the minimum spend: RM 25.00. */
const BILL_MINOR = 2500;
const DAY_MS = 86_400_000;
/** Backup codes: 8 of A–Z (minus I, O) and 2–9. */
const BACKUP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const BACKUP_CODE_LENGTH = 8;
const TOKEN_BYTES = 32;
/** How long the after-commit referrer-credit email may take before the test gives up on it. */
const AFTER_COMMIT_DEADLINE_MS = 10_000;
/** Pause between two reads while waiting for after-commit work. */
const AFTER_COMMIT_POLL_MS = 50;
/** This file's referrer-credit email rows: the template, requested after the file started (e2e redirects every recipient to one address). */
const CREDIT_EMAILS_SQL = `SELECT COUNT(*)::int AS n FROM public."EmailLog" WHERE "templateKey" = 'referrer-reward-credited' AND "createdAt" >= $1`;

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
	/** The API's own keyed hasher (`REWARD_CODE_HASH_KEYS`): fixtures store codes exactly as the app does. */
	let codeHasher: RewardCodeHasher;
	let pool: Pool;
	let aliceId: string;
	let bobId: string;
	const rewardId = randomUUID();
	/** A store-limited reward (KL store only) for the fail-closed store check. */
	const storeOnlyRewardId = randomUUID();
	/** Referral pair: redeeming `referredRewardId` credits the referrer with `referrerRewardId`. */
	const referredRewardId = randomUUID();
	const referrerRewardId = randomUUID();
	/** Extra KL keys (removed afterwards): a tenant-wide one and a throwaway one to lock. */
	const tenantWideKey = `mk_test_${randomBytes(TOKEN_BYTES).toString("base64url")}`;
	const lockoutKey = `mk_test_${randomBytes(TOKEN_BYTES).toString("base64url")}`;
	/** Unknown backup codes count toward a key's lockout — this file never sends them with the shared demo key. */
	const guessingKey = `mk_test_${randomBytes(TOKEN_BYTES).toString("base64url")}`;
	const extraKeyIds: string[] = [];
	const claims: ClaimFixture[] = [];
	/** Email log rows this file causes are found by recipient and time (removed afterwards). */
	const fileStartedAt = Date.now();

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

	async function createClaim(userId: string, claimRewardId: string = rewardId, referralId: string | null = null): Promise<ClaimFixture> {
		const claim = { id: randomUUID(), token: randomBytes(TOKEN_BYTES).toString("base64url"), backupCode: backupCode() };
		const now = Date.now();
		await query(
			`INSERT INTO public."RewardClaim" (id, "userId", "rewardId", "referralId", "redemptionTokenHash", "backupCodeHash", status, "claimedAt", "claimExpiresAt")
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7, $8)`,
			[claim.id, userId, claimRewardId, referralId, codeHasher.hash(claim.token), codeHasher.hash(claim.backupCode), now, now + DAY_MS],
		);
		await query(
			`UPDATE public."Reward" SET "quantityRemaining" = "quantityRemaining" - 1, "quantityReserved" = "quantityReserved" + 1, "claimCount" = "claimCount" + 1 WHERE id = $1`,
			[claimRewardId],
		);
		claims.push(claim);
		return claim;
	}

	/** Reads `sql` until `done` holds for its first row, or fails after {@link AFTER_COMMIT_DEADLINE_MS} (after-commit work is fire-and-forget). */
	async function eventually(
		sql: string,
		values: readonly (string | number | boolean | null)[],
		done: (row: Record<string, string | number | null> | undefined) => boolean,
	): Promise<Record<string, string | number | null> | undefined> {
		const deadline = Date.now() + AFTER_COMMIT_DEADLINE_MS;
		for (;;) {
			const [row] = await query(sql, values);
			if (done(row) || Date.now() > deadline) {
				return row;
			}
			await new Promise((resolve) => {
				setTimeout(resolve, AFTER_COMMIT_POLL_MS);
			});
		}
	}

	async function claimStatus(claimId: string): Promise<string> {
		const [row] = await query(`SELECT status FROM public."RewardClaim" WHERE id = $1`, [claimId]);
		return String(row?.status);
	}

	function pos(path: string, body: object, terminalId: string = KL_TERMINAL, apiKey: string = DEMO_MERCHANT_API_KEYS.kl): Promise<InjectResponse> {
		return app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/integration/redemptions/${path}`,
			headers: { "x-api-key": apiKey, "x-terminal-id": terminalId, "content-type": "application/json" },
			payload: JSON.stringify(body),
		});
	}

	async function insertKlKey(plaintext: string, name: string, locationId: string | null): Promise<void> {
		const id = randomUUID();
		await query(
			`INSERT INTO public."TenantApiKey" (id, "tenantId", "locationId", name, "keyHash", "keyPrefix", scope, "createdByUserId")
       VALUES ($1, $2, $3, $4, $5, $6, 'POS', $7)`,
			[id, TENANT_SEED_IDS.klTenant, locationId, name, sha256Hex(plaintext), plaintext.slice(0, 16), REWARD_SEED_IDS.klOwnerUser],
		);
		extraKeyIds.push(id);
	}

	async function insertReward(
		id: string,
		title: string,
		options: { readonly scope?: "SELECTED"; readonly referrerRewardId?: string; readonly kind?: "REFERRER" } = {},
	): Promise<void> {
		const referred = options.referrerRewardId !== undefined;
		await query(
			`INSERT INTO public."Reward" (id, "tenantId", title, description, "rewardType", "rewardValue", "rewardKind", category, "minSpendMinor",
         "quantityTotal", "quantityRemaining", "expiryDate", status, "referralsEnabled", "referralPoolTotal", "referralPoolRemaining", "referrerRewardId", "locationScopeType")
       VALUES ($1, $2, $3, 'Created by pos-checkout.e2e-spec.ts', 'DISCOUNT', 10, $4, 'cafe', $5, 50, 50, $6, 'PUBLISHED', $7, $8, $8, $9, $10)`,
			[
				id,
				TENANT_SEED_IDS.klTenant,
				title,
				options.kind ?? "CONSUMER",
				options.kind === undefined ? MIN_SPEND_MINOR : null,
				Date.now() + 30 * DAY_MS,
				referred,
				referred ? 1 : null,
				options.referrerRewardId ?? null,
				options.scope ?? "ALL_LOCATIONS",
			],
		);
		await query(INSERT_REWARD_COVER_SQL, [...rewardCoverParams(id, TENANT_SEED_IDS.klTenant, "free-coffee")]);
		if (options.scope === "SELECTED") {
			await query(`INSERT INTO public."RewardLocationScope" (id, "tenantId", "rewardId", "locationId") VALUES ($1, $2, $3, $4)`, [
				randomUUID(),
				TENANT_SEED_IDS.klTenant,
				id,
				TENANT_SEED_IDS.klLocation,
			]);
		}
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
		codeHasher = app.get(RewardCodeHasher);
		pool = new Pool({ connectionString: DATABASE_URL });
		// Alice is seeded unverified (verify-email demo); this suite needs her full session.
		await markSeedUserEmailVerified(pool, "alice.johnson@example.com");
		aliceId = await userIdFor("alice.johnson@example.com");
		bobId = await userIdFor("bob.smith@example.com");
		await insertReward(rewardId, "E2E checkout reward");
		await insertReward(storeOnlyRewardId, "E2E store-only reward", { scope: "SELECTED" });
		await insertReward(referrerRewardId, "E2E referrer reward", { kind: "REFERRER" });
		await insertReward(referredRewardId, "E2E referred reward", { referrerRewardId });
		await insertKlKey(tenantWideKey, "E2E tenant-wide key", null);
		await insertKlKey(lockoutKey, "E2E lockout key", TENANT_SEED_IDS.klLocation);
		await insertKlKey(guessingKey, "E2E unknown-code key", TENANT_SEED_IDS.klLocation);
	});

	afterAll(async () => {
		// Only this file's rows: sales are found through the fixture rewards' claims (seeded sales are left alone).
		const fixtureRewards = `{${[rewardId, storeOnlyRewardId, referredRewardId, referrerRewardId].join(",")}}`;
		const fixtureClaims = `SELECT id FROM public."RewardClaim" WHERE "rewardId" = ANY($1::text[])`;
		const sales = await query(`SELECT DISTINCT "saleId" FROM public."RewardRedemption" WHERE "claimId" IN (${fixtureClaims})`, [fixtureRewards]);
		await query(`DELETE FROM public."RewardRedemption" WHERE "claimId" IN (${fixtureClaims})`, [fixtureRewards]);
		await query(`DELETE FROM public."RewardSale" WHERE id = ANY($1::text[])`, [`{${sales.map((sale) => String(sale.saleId)).join(",")}}`]);
		await query(`DELETE FROM public."RewardNotification" WHERE metadata->>'rewardId' = $1`, [referrerRewardId]);
		await query(`DELETE FROM public."RewardClaim" WHERE "rewardId" = ANY($1::text[])`, [fixtureRewards]);
		await query(`DELETE FROM public."RewardReferral" WHERE "rewardId" = ANY($1::text[])`, [fixtureRewards]);
		await query(`UPDATE public."Reward" SET "referrerRewardId" = NULL WHERE id = ANY($1::text[])`, [fixtureRewards]);
		await query(`DELETE FROM public."Reward" WHERE id = ANY($1::text[])`, [fixtureRewards]);
		await query(`DELETE FROM public."TenantApiKey" WHERE id = ANY($1::text[])`, [`{${extraKeyIds.join(",")}}`]);
		await query(`DELETE FROM public."EmailLog" WHERE "templateKey" = 'referrer-reward-credited' AND "createdAt" >= $1`, [fileStartedAt]);
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
		const [before] = await query(`SELECT "quantityReserved", "redemptionCount" FROM public."Reward" WHERE id = $1`, [rewardId]);

		const response = await checkout([{ token: first.token }, { backupCode: second.backupCode }]);

		expect(response.statusCode, response.body).toBe(201);
		const sale = parseSuccessEnvelope(response, RedemptionCheckoutResponseSchema).data;
		expect(sale.billTotalMinor).toBe(BILL_MINOR);
		expect(sale.redemptions.map((redemption) => redemption.claimId).toSorted()).toEqual([first.id, second.id].toSorted());
		expect(await claimStatus(first.id)).toBe("REDEEMED");
		expect(await claimStatus(second.id)).toBe("REDEEMED");

		const [after] = await query(`SELECT "quantityReserved", "redemptionCount" FROM public."Reward" WHERE id = $1`, [rewardId]);
		expect(Number(after?.quantityReserved)).toBe(Number(before?.quantityReserved) - 2);
		expect(Number(after?.redemptionCount)).toBe(Number(before?.redemptionCount) + 2);

		const [row] = await query(`SELECT "locationId", "userId" FROM public."RewardSale" WHERE id = $1`, [sale.saleId]);
		expect(row).toMatchObject({ locationId: TENANT_SEED_IDS.klLocation, userId: aliceId });
		const methods = await query(`SELECT "redemptionMethod" FROM public."RewardRedemption" WHERE "saleId" = $1`, [sale.saleId]);
		expect(methods.map((method) => String(method.redemptionMethod)).toSorted()).toEqual(["MANUAL", "SCAN"]);
	});

	it("replays a retried checkout instead of redeeming twice, and rejects the key reused for another bill", async () => {
		const claim = await createClaim(aliceId);
		const idempotencyKey = randomUUID();

		const original = parseSuccessEnvelope(await checkout([{ token: claim.token }], BILL_MINOR, idempotencyKey), RedemptionCheckoutResponseSchema).data;
		const retried = await checkout([{ token: claim.token }], BILL_MINOR, idempotencyKey);

		expect(retried.statusCode, retried.body).toBe(201);
		expect(parseSuccessEnvelope(retried, RedemptionCheckoutResponseSchema).data.saleId).toBe(original.saleId);
		const [count] = await query(`SELECT COUNT(*)::int AS n FROM public."RewardSale" WHERE "tenantId" = $1 AND "idempotencyKey" = $2`, [
			TENANT_SEED_IDS.klTenant,
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
			url: `${API_VERSION_PREFIX}/tenants/${TENANT_SEED_SLUGS.kl}/analytics`,
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
		const kl = spending.byMerchant.find((merchantSpend) => merchantSpend.tenantId === TENANT_SEED_IDS.klTenant);
		expect(kl?.totalMinor).toBeGreaterThanOrEqual(BILL_MINOR);
		expect(kl?.merchantName.length).toBeGreaterThan(0);
		expect(spending.byCategory.length).toBeGreaterThan(0);

		const consumerAsAdmin = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/admin/analytics/sales`, headers: { cookie: cookies(alice) } });
		expect(consumerAsAdmin.statusCode).toBe(403);

		const superAdmin = await login(app, "superadmin@example.com", "SuperAdmin@123");
		const admin = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/admin/analytics/sales`, headers: mutationHeaders({ cookie: cookies(superAdmin) }) });
		expect(admin.statusCode, admin.body).toBe(200);
		const platform = parseSuccessEnvelope(admin, AdminSalesAnalyticsResponseSchema).data;
		expect(platform.topMerchants.some((merchantSales) => merchantSales.tenantId === TENANT_SEED_IDS.klTenant)).toBe(true);
		expect(platform.activeMerchants.value).toBeGreaterThanOrEqual(1);
	});

	it("records ONE sale when the same checkout is sent several times in parallel", async () => {
		const claim = await createClaim(aliceId);
		const idempotencyKey = randomUUID();

		const responses = await Promise.all(Array.from({ length: PARALLEL_REQUESTS }, async () => checkout([{ token: claim.token }], BILL_MINOR, idempotencyKey)));

		expect(responses.map((response) => response.statusCode)).toEqual(Array.from({ length: PARALLEL_REQUESTS }, () => 201));
		const saleIds = new Set(responses.map((response) => parseSuccessEnvelope(response, RedemptionCheckoutResponseSchema).data.saleId));
		expect(saleIds.size).toBe(1);
		const [count] = await query(`SELECT COUNT(*)::int AS n FROM public."RewardRedemption" WHERE "claimId" = $1`, [claim.id]);
		expect(count?.n).toBe(1);
	});

	it("redeems a claim shared by parallel checkouts (different keys) exactly once", async () => {
		const shared = await createClaim(aliceId);
		const [before] = await query(`SELECT "redemptionCount" FROM public."Reward" WHERE id = $1`, [rewardId]);

		const responses = await Promise.all(Array.from({ length: PARALLEL_REQUESTS }, async () => checkout([{ token: shared.token }])));

		expect(responses.filter((response) => response.statusCode === 201)).toHaveLength(1);
		expect(responses.filter((response) => response.statusCode !== 201).map(errorCodeOf)).toEqual(Array.from({ length: PARALLEL_REQUESTS - 1 }, () => "ALREADY_REDEEMED"));
		const [after] = await query(`SELECT "redemptionCount" FROM public."Reward" WHERE id = $1`, [rewardId]);
		expect(Number(after?.redemptionCount)).toBe(Number(before?.redemptionCount) + 1);
	});

	it("answers another merchant's code exactly like an unknown code (no cross-merchant oracle)", async () => {
		// The seeded backup code TUVW2345 belongs to a Jonker Street Kitchen claim, not to the KL merchant calling here.
		const [mlkClaim] = await query(`SELECT "backupCodeHash" FROM public."RewardClaim" WHERE id = $1`, [REWARD_SEED_IDS.claimPendingMlk]);
		expect(codeHasher.lookupCandidates("TUVW2345")).toContain(mlkClaim?.backupCodeHash);

		const foreign = await pos("validate", { backupCode: "TUVW2345" }, KL_TERMINAL, guessingKey);
		const unknown = await pos("validate", { backupCode: backupCode() }, KL_TERMINAL, guessingKey);

		expect(foreign.statusCode).toBe(404);
		expect(unknown.statusCode).toBe(404);
		expect(ApiErrorResponseSchema.parse(foreign.json()).error).toMatchObject({
			code: "REDEMPTION_TOKEN_INVALID",
			message: ApiErrorResponseSchema.parse(unknown.json()).error.message,
		});
	});

	it("locks an API key after too many unknown backup codes — every code of a checkout counts — and audits the lock", async () => {
		const valid = await createClaim(aliceId);
		const guesses = Array.from({ length: POS_CODE_MAX_FAILURES }, () => ({ backupCode: backupCode() }));

		const guessing = await pos("checkout", { idempotencyKey: randomUUID(), billTotalMinor: BILL_MINOR, currency: "MYR", codes: guesses }, KL_TERMINAL, lockoutKey);
		expect(guessing.statusCode).toBe(429);
		expect(errorCodeOf(guessing)).toBe("POS_CODE_LOCKED");

		// While locked, even a valid code is refused with this key; other keys are unaffected.
		expect((await pos("validate", { token: valid.token }, KL_TERMINAL, lockoutKey)).statusCode).toBe(429);
		expect((await pos("validate", { token: valid.token })).statusCode).toBe(201);

		const [lockAudit] = await query(`SELECT COUNT(*)::int AS n FROM public."RewardAuditLog" WHERE action = 'pos.api_key_code_locked' AND metadata->>'apiKeyId' = $1`, [
			String(extraKeyIds.at(1)),
		]);
		expect(lockAudit?.n).toBe(1);
	});

	it("fails closed when a store-limited reward is redeemed from a till whose store is unknown", async () => {
		const claim = await createClaim(aliceId, storeOnlyRewardId);

		const unknownStore = await pos(
			"checkout",
			{ idempotencyKey: randomUUID(), billTotalMinor: BILL_MINOR, currency: "MYR", codes: [{ token: claim.token }] },
			"E2E-ORG-WIDE-TILL",
			tenantWideKey,
		);
		expect(unknownStore.statusCode).toBe(422);
		expect(errorCodeOf(unknownStore)).toBe("STORE_REQUIRED");
		expect(await claimStatus(claim.id)).toBe("PENDING");

		// The store-scoped KL key knows its store: the same reward redeems.
		expect((await checkout([{ token: claim.token }])).statusCode).toBe(201);
	});

	it("credits the referrer inside the checkout transaction, once, even when the referee's rewards are redeemed in parallel", async () => {
		const referralId = randomUUID();
		await query(`INSERT INTO public."RewardReferral" (id, "referrerUserId", "refereeUserId", "rewardId", "attributionToken", status) VALUES ($1, $2, $3, $4, $5, 'PENDING')`, [
			referralId,
			bobId,
			aliceId,
			referredRewardId,
			`e2e-${referralId}`.slice(0, 64),
		]);
		const first = await createClaim(aliceId, referredRewardId, referralId);
		const second = await createClaim(aliceId, referredRewardId, referralId);
		const [childBefore] = await query(`SELECT "quantityRemaining", "quantityReserved", "expiryDate" FROM public."Reward" WHERE id = $1`, [referrerRewardId]);
		const testStartedAt = Date.now();

		const responses = await Promise.all([checkout([{ token: first.token }]), checkout([{ token: second.token }])]);
		expect(responses.map((response) => response.statusCode)).toEqual([201, 201]);

		// EMAIL_MODE=noop in e2e: the post-commit delivery succeeds and marks the referral notified (after the
		// response, so it is awaited here rather than assumed).
		const referral = await eventually(`SELECT status, "creditNotifiedAt" FROM public."RewardReferral" WHERE id = $1`, [referralId], (row) => row?.creditNotifiedAt !== null);
		expect(referral?.status).toBe("CREDITED");
		expect(referral?.creditNotifiedAt).not.toBeNull();
		const [childAfter] = await query(`SELECT "quantityRemaining", "quantityReserved" FROM public."Reward" WHERE id = $1`, [referrerRewardId]);
		expect(Number(childAfter?.quantityRemaining)).toBe(Number(childBefore?.quantityRemaining) - 1);
		expect(Number(childAfter?.quantityReserved)).toBe(Number(childBefore?.quantityReserved) + 1);
		const [creditClaim] = await query(`SELECT "claimExpiresAt", "rewardId" FROM public."RewardClaim" WHERE "referralId" = $1 AND "isReferrerCredit" = true`, [referralId]);
		expect(creditClaim?.rewardId).toBe(referrerRewardId);
		// The 30-day credit TTL, capped by the referrer reward's own (earlier) expiry.
		expect(Number(creditClaim?.claimExpiresAt)).toBe(Number(childBefore?.expiryDate));
		const [notices] = await query(
			`SELECT COUNT(*)::int AS n FROM public."RewardNotification" WHERE "userId" = $1 AND type = 'referrer_reward_credited' AND metadata->>'rewardId' = $2`,
			[bobId, referrerRewardId],
		);
		expect(notices?.n).toBe(1);
		const [emails] = await query(CREDIT_EMAILS_SQL, [testStartedAt]);
		expect(emails?.n).toBe(1);
		const [credits] = await query(`SELECT COUNT(*)::int AS n FROM public."RewardClaim" WHERE "referralId" = $1 AND "isReferrerCredit" = true AND "userId" = $2`, [
			referralId,
			bobId,
		]);
		expect(credits?.n).toBe(1);
		const [parent] = await query(`SELECT "referralPoolRemaining" FROM public."Reward" WHERE id = $1`, [referredRewardId]);
		expect(Number(parent?.referralPoolRemaining)).toBe(0);
	});

	it("answers a key reused by another store's till 409 IDEMPOTENCY_KEY_REUSED, without naming a sale it cannot read", async () => {
		const idempotencyKey = randomUUID();
		const unknownStoreClaim = await createClaim(aliceId);
		// The tenant-wide key on an unregistered till records a sale with no store, which the store-limited KL key cannot read.
		const first = await pos(
			"checkout",
			{ idempotencyKey, billTotalMinor: BILL_MINOR, currency: "MYR", codes: [{ token: unknownStoreClaim.token }] },
			"E2E-ORG-WIDE-TILL",
			tenantWideKey,
		);
		expect(first.statusCode, first.body).toBe(201);
		const storeClaim = await createClaim(aliceId);

		const reused = await checkout([{ token: storeClaim.token }], BILL_MINOR, idempotencyKey);

		expect(reused.statusCode, reused.body).toBe(409);
		const error = ApiErrorResponseSchema.parse(reused.json()).error;
		expect(error.code).toBe("IDEMPOTENCY_KEY_REUSED");
		expect(JSON.stringify(error)).not.toContain(parseSuccessEnvelope(first, RedemptionCheckoutResponseSchema).data.saleId);
		expect(await claimStatus(storeClaim.id)).toBe("PENDING");
	});

	it("lets the sweeper request a credited referral's email the after-commit step never requested", async () => {
		const referralId = randomUUID();
		const creditedAt = Date.now();
		await query(
			`INSERT INTO public."RewardReferral" (id, "referrerUserId", "refereeUserId", "rewardId", "attributionToken", status, "creditedAt")
       VALUES ($1, $2, $3, $4, $5, 'CREDITED', $6)`,
			[referralId, bobId, aliceId, referredRewardId, `e2e-${referralId}`.slice(0, 64), creditedAt],
		);
		await createClaim(bobId, referrerRewardId, referralId);
		await query(`UPDATE public."RewardClaim" SET "isReferrerCredit" = true WHERE "referralId" = $1`, [referralId]);
		const [emailsBefore] = await query(CREDIT_EMAILS_SQL, [fileStartedAt]);

		const sweep = await app
			.get(CommandBus)
			.execute(new SweepReferrerCreditEmailsCommand(systemActor("rewards.referral_credit.deliver", "job", null, "Request owed referrer-credit emails", null)));

		expect(sweep.requested).toBeGreaterThanOrEqual(1);
		const [referral] = await query(`SELECT "creditNotifiedAt" FROM public."RewardReferral" WHERE id = $1`, [referralId]);
		expect(referral?.creditNotifiedAt).not.toBeNull();
		const [emailsAfter] = await query(CREDIT_EMAILS_SQL, [fileStartedAt]);
		expect(Number(emailsAfter?.n)).toBe(Number(emailsBefore?.n) + 1);
	});
});

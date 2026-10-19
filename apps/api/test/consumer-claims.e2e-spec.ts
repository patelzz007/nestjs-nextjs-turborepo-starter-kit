import { randomUUID } from "node:crypto";

import { CommandBus } from "@nestjs/cqrs";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { Prisma } from "@prisma/client";
import {
	API_VERSION_PREFIX,
	RewardClaimCreatedResponseSchema,
	RewardClaimQrResponseSchema,
	RewardClaimResponseSchema,
	ApiPaginatedMetaSchema,
	RewardNotificationResponseSchema,
} from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { ORGANIZATION_SEED_IDS } from "../prisma/seed/organizations";
import { rewardCoverImageSeedId } from "../prisma/seed/reward-images";
import { ClaimRewardCommand } from "../src/contexts/claims/application/commands/claim-reward/claim-reward.command";
import { createClaimsTransactionalPorts } from "../src/contexts/claims/public-api";
import { ActorContextSchema } from "../src/platform/application/actor-context";
import { TransactionalEventCollector } from "../src/platform/application/events/transactional-event-collector";
import { RewardCodeHasher } from "../src/platform/infrastructure/crypto/reward-code-hasher";
import { PrismaService } from "../src/prisma/prisma.service";
import { runWithSystemRlsContext, systemRlsContext } from "../src/prisma/rls-context";
import { TenantTransactionService } from "../src/prisma/tenant-transaction.service";
import { createE2eApp, login, markSeedUserEmailVerified, mutationHeaders, parseSuccessEnvelope, uniqueClientIp, type InjectResponse, type LoginResult } from "./e2e-helpers";

const DAY_MS = 86_400_000;
const QUANTITY = 10;
const PARALLEL_WRONG_CODES = 10;
const MAX_OTP_ATTEMPTS = 5;

const ErrorEnvelopeSchema = z.object({ success: z.literal(false), error: z.object({ code: z.string() }) });
/** The seeded customer's own phone, restored after the spec (a fresh seed has none). */
const StoredPhoneSchema = z.object({ phone: z.string().nullable(), phoneVerifiedAt: z.string().nullable() });
/** The verified phone this spec gives Alice, so her claims need no OTP. */
const ALICE_FIXTURE_PHONE = "+60129990100";
const CodeHashesRowSchema = z.object({ redemptionTokenHash: z.string(), backupCodeHash: z.string() });
const OtpRowSchema = z.object({ attempts: z.number(), failedAttempts: z.number(), consumedAt: z.string().nullable() });

/**
 * The claims context over HTTP: a customer claims a reward with their verified phone, reads it back
 * (list and detail, never the codes), rotates the QR codes, and works their reward inbox. Another
 * customer can see none of it.
 */
describe("Consumer claims (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let alice: LoginResult;
	let bob: LoginResult;
	let alicePhone: string;
	let aliceStoredPhone: z.output<typeof StoredPhoneSchema>;
	let rewardId: string;
	let claimId: string;
	let firstBackupCode: string;
	let rotatedBackupCode: string;

	function cookie(user: LoginResult): string {
		return `accessToken=${user.accessToken}; refreshToken=${user.refreshToken}`;
	}

	function get(user: LoginResult, path: string): Promise<InjectResponse> {
		return app.inject({ method: "GET", url: `${API_VERSION_PREFIX}${path}`, headers: { cookie: cookie(user), "x-forwarded-for": uniqueClientIp() } });
	}

	function post(user: LoginResult, path: string, payload: Record<string, string | boolean | readonly string[]> = {}): Promise<InjectResponse> {
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

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		rewardId = randomUUID();
		const prisma = app.get(PrismaService);
		await runWithSystemRlsContext("route.rls_bypass", async () =>
			prisma.reward.create({
				data: {
					id: rewardId,
					organizationId: ORGANIZATION_SEED_IDS.klOrganization,
					title: "E2E consumer claim reward",
					description: "Created by consumer-claims.e2e-spec.ts",
					rewardType: "FREE_ITEM",
					category: "cafe",
					images: { create: [{ organizationId: ORGANIZATION_SEED_IDS.klOrganization, fileId: rewardCoverImageSeedId("free-coffee"), position: 0 }] },
					quantityTotal: QUANTITY,
					quantityRemaining: QUANTITY,
					expiryDate: Date.now() + 30 * DAY_MS,
					status: "PUBLISHED",
					referralsEnabled: false,
				},
			}),
		);
		// Fixture: both customers have full sessions, and Alice has a verified phone (a fresh seed gives her none).
		await markSeedUserEmailVerified(pool, "alice.johnson@example.com");
		await markSeedUserEmailVerified(pool, "bob.smith@example.com");
		aliceStoredPhone = StoredPhoneSchema.parse(
			(await pool.query(`SELECT phone, "phoneVerifiedAt"::text AS "phoneVerifiedAt" FROM public."User" WHERE email = 'alice.johnson@example.com'`)).rows.at(0),
		);
		alicePhone = aliceStoredPhone.phone !== null && aliceStoredPhone.phoneVerifiedAt !== null ? aliceStoredPhone.phone : ALICE_FIXTURE_PHONE;
		await pool.query(`UPDATE public."User" SET phone = $1, "phoneVerifiedAt" = COALESCE("phoneVerifiedAt", $2) WHERE email = 'alice.johnson@example.com'`, [
			alicePhone,
			Date.now(),
		]);
		alice = await login(app, "alice.johnson@example.com", "Alice@123");
		bob = await login(app, "bob.smith@example.com", "Bob@123");
	});

	afterAll(async () => {
		// Fixture teardown through the superuser pool: this spec's reward and everything hanging off it.
		await pool.query(`DELETE FROM public."RewardClaim" WHERE "rewardId" = $1`, [rewardId]);
		await pool.query(`DELETE FROM public."RewardOtpChallenge" WHERE "rewardId" = $1`, [rewardId]);
		await pool.query(`DELETE FROM public."RewardImage" WHERE "rewardId" = $1`, [rewardId]);
		await pool.query(`DELETE FROM public."Reward" WHERE id = $1`, [rewardId]);
		await pool.query(`UPDATE public."User" SET phone = $1, "phoneVerifiedAt" = $2::bigint WHERE email = 'alice.johnson@example.com'`, [
			aliceStoredPhone.phone,
			aliceStoredPhone.phoneVerifiedAt,
		]);
		await pool.end();
		await app.close();
	});

	it("claims a reward with the customer's verified phone, reserving one unit", async () => {
		const response = await post(alice, "/claims", { rewardId, phone: alicePhone });

		expect(response.statusCode, response.body).toBe(201);
		const created = parseSuccessEnvelope(response, RewardClaimCreatedResponseSchema).data;
		expect(created.claim).toMatchObject({ rewardId, rewardTitle: "E2E consumer claim reward", status: "PENDING" });
		claimId = created.claim.id;
		firstBackupCode = created.backupCode;
		expect(created.qrDeepLink).toBe(`/rewards/claims/${claimId}/qr`);
		const stock = await pool.query(`SELECT "quantityRemaining" AS "remaining", "quantityReserved" AS "reserved" FROM public."Reward" WHERE id = $1`, [rewardId]);
		expect(stock.rows.at(0)).toEqual({ remaining: QUANTITY - 1, reserved: 1 });
	});

	it("reads the claim back in the list and by id, never with its codes", async () => {
		const detail = await get(alice, `/claims/${claimId}`);
		expect(detail.statusCode, detail.body).toBe(200);
		expect(parseSuccessEnvelope(detail, RewardClaimResponseSchema).data).toMatchObject({ id: claimId, status: "PENDING" });
		expect(detail.body).not.toContain(firstBackupCode);

		const list = await get(alice, "/claims?limit=50");
		expect(list.statusCode, list.body).toBe(200);
		expect(list.body).toContain(claimId);
	});

	it("issues fresh QR codes for the claim: the stored hashes rotate and the old backup code is gone", async () => {
		const before = CodeHashesRowSchema.parse(
			(
				await pool.query(`SELECT "redemptionTokenHash" AS "redemptionTokenHash", "backupCodeHash" AS "backupCodeHash" FROM public."RewardClaim" WHERE id = $1`, [claimId])
			).rows.at(0),
		);

		const response = await post(alice, `/claims/${claimId}/qr`);

		expect(response.statusCode, response.body).toBe(201);
		const codes = parseSuccessEnvelope(response, RewardClaimQrResponseSchema).data;
		expect(codes.claimId).toBe(claimId);
		expect(codes.backupCode).not.toBe(firstBackupCode);
		rotatedBackupCode = codes.backupCode;
		const after = CodeHashesRowSchema.parse(
			(
				await pool.query(`SELECT "redemptionTokenHash" AS "redemptionTokenHash", "backupCodeHash" AS "backupCodeHash" FROM public."RewardClaim" WHERE id = $1`, [claimId])
			).rows.at(0),
		);
		expect(after.redemptionTokenHash).not.toBe(before.redemptionTokenHash);
		expect(after.backupCodeHash).not.toBe(before.backupCodeHash);
	});

	it("D07: the old GET route is gone, and a rotated-out backup code no longer finds the claim", async () => {
		expect((await get(alice, `/claims/${claimId}/qr`)).statusCode).toBe(404);

		const lookup = (backupCode: string): Promise<string | null> =>
			app
				.get(TenantTransactionService)
				.withRlsContext({ context: systemRlsContext("route.rls_bypass"), reason: "consumer claims e2e" }, async (tx: Prisma.TransactionClient): Promise<string | null> => {
					const found = await createClaimsTransactionalPorts(tx, app.get(RewardCodeHasher), new TransactionalEventCollector()).redemption.findMerchantClaim(
						{ backupCode },
						ORGANIZATION_SEED_IDS.klOrganization,
					);
					return found?.claim.id ?? null;
				});
		expect(await lookup(firstBackupCode)).toBeNull();
		expect(await lookup(rotatedBackupCode)).toBe(claimId);
	});

	it("shows another customer nothing of the claim, and lets them issue no codes for it", async () => {
		expect((await get(bob, `/claims/${claimId}`)).statusCode).toBe(404);
		expect([403, 404]).toContain((await post(bob, `/claims/${claimId}/qr`)).statusCode);
		expect((await get(bob, "/claims?limit=50")).body).not.toContain(claimId);
	});

	it("asks for an OTP for an unverified phone, and spends one attempt on a wrong code", async () => {
		const unverifiedPhone = "+60111222333";
		const withoutOtp = await post(alice, "/claims", { rewardId, phone: unverifiedPhone });
		expect(withoutOtp.statusCode).toBe(400);
		expect(errorCode(withoutOtp)).toBe("OTP_REQUIRED");

		const requested = await post(alice, "/claims/otp", { rewardId, phone: unverifiedPhone });
		expect(requested.statusCode, requested.body).toBe(201);

		const wrong = await post(alice, "/claims", { rewardId, phone: unverifiedPhone, otp: "000000" });
		expect(wrong.statusCode).toBe(400);
		const challenge = OtpRowSchema.parse(
			(
				await pool.query(
					`SELECT attempts, "failedAttempts" AS "failedAttempts", "consumedAt"::text AS "consumedAt" FROM public."RewardOtpChallenge" WHERE "rewardId" = $1 AND phone = $2 ORDER BY "createdAt" DESC LIMIT 1`,
					[rewardId, unverifiedPhone],
				)
			).rows.at(0),
		);
		expect(challenge).toEqual({ attempts: 1, failedAttempts: 1, consumedAt: null });
	});

	it("D09: concurrent wrong codes never spend more than the allowed attempts", async () => {
		const racedPhone = "+60111222444";
		expect((await post(alice, "/claims/otp", { rewardId, phone: racedPhone })).statusCode).toBe(201);
		const aliceId = z.object({ id: z.string() }).parse((await pool.query(`SELECT id FROM public."User" WHERE email = 'alice.johnson@example.com'`)).rows.at(0)).id;
		const actor = ActorContextSchema.parse({
			kind: "user",
			userId: aliceId,
			sessionId: randomUUID(),
			organizationId: null,
			isSuperAdmin: false,
			accessScope: "tenant",
			impersonatorUserId: null,
			request: { requestId: randomUUID(), ip: null, userAgent: null, deviceLabel: null, endpoint: null },
		});

		const results = await Promise.allSettled(
			Array.from({ length: PARALLEL_WRONG_CODES }, async () => app.get(CommandBus).execute(new ClaimRewardCommand(actor, { rewardId, phone: racedPhone, otp: "000000" }))),
		);

		expect(results.every((result) => result.status === "rejected")).toBe(true);
		const challenge = OtpRowSchema.parse(
			(
				await pool.query(
					`SELECT attempts, "failedAttempts" AS "failedAttempts", "consumedAt"::text AS "consumedAt" FROM public."RewardOtpChallenge" WHERE "rewardId" = $1 AND phone = $2 ORDER BY "createdAt" DESC LIMIT 1`,
					[rewardId, racedPhone],
				)
			).rows.at(0),
		);
		expect(challenge).toEqual({ attempts: MAX_OTP_ATTEMPTS, failedAttempts: MAX_OTP_ATTEMPTS, consumedAt: null });
	});

	/** The badge's count: the unread notifications' `meta.total`, read with the smallest page. */
	async function unreadCount(): Promise<number> {
		const response = await get(alice, "/reward-notifications?limit=1&filter[readAt][isNull]=true");
		expect(response.statusCode, response.body).toBe(200);
		return ApiPaginatedMetaSchema.parse(parseSuccessEnvelope(response, z.array(RewardNotificationResponseSchema)).meta).total;
	}

	it("lists the reward inbox, counts the unread ones with the same list, and marks everything read", async () => {
		const aliceId = z.object({ id: z.string() }).parse((await pool.query(`SELECT id FROM public."User" WHERE email = 'alice.johnson@example.com'`)).rows.at(0)).id;
		const noticeId = randomUUID();
		await pool.query(`INSERT INTO public."RewardNotification" (id, "userId", type, title, body) VALUES ($1, $2, 'e2e', 'E2E notice', 'Inbox check')`, [noticeId, aliceId]);

		const inbox = await get(alice, "/reward-notifications?limit=50");
		expect(inbox.statusCode, inbox.body).toBe(200);
		const page = parseSuccessEnvelope(inbox, z.array(RewardNotificationResponseSchema)).data;
		expect(page.map((item) => item.id)).toContain(noticeId);
		expect(await unreadCount()).toBeGreaterThan(0);

		const read = await post(alice, "/reward-notifications/read", { markAll: true });
		expect(read.statusCode, read.body).toBe(201);
		expect(await unreadCount()).toBe(0);
		await pool.query(`DELETE FROM public."RewardNotification" WHERE id = $1`, [noticeId]);
	});
});

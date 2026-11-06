import { createHash } from "node:crypto";

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { getApiConfig } from "../../../src/config/api-config";
import { TypedConfigService } from "../../../src/config/typed-config.service";
import { CryptoService } from "../../../src/contexts/identity/infrastructure/security/crypto.service";
import { PrismaService } from "../../../src/prisma/prisma.service";
import { createE2eApp, login, mutationHeaders, type InjectResponse, type LoginResult, uniqueClientIp } from "../../e2e-helpers";
import { seedTwoTenantFixture, TWO_TENANT_FIXTURE } from "../../support/two-tenant-fixture";

/**
 * Single mode over HTTP (plan ST-002 and the single-tenant binding of D23 / MT-23): the deployment
 * serves only its default tenant (fixture tenant A).
 *
 * - ST-002: a `tenantId` in a request body or query is refused with 400 — the tenant is never input.
 * - Another tenant's API key is not recognised (401), while the default tenant's key is.
 * - Another tenant's location cannot be named on the default tenant's route.
 */

const FIXTURE_PASSWORD = "Fixture@SingleMode1";
const TENANT_A_REWARDS = `${API_VERSION_PREFIX}/tenants/fixture-tenant-a/rewards`;
const INTEGRATION_REWARDS = `${API_VERSION_PREFIX}/integration/rewards`;
/** Plaintexts of the two keys this spec adds (only their hashes are stored). */
const TENANT_A_KEY = "mk_live_singleModeServedTenantKeyA0000000000000000000000000";
const TENANT_B_KEY = "mk_live_singleModeOtherTenantKeyB00000000000000000000000000";
const TENANT_A_KEY_ID = "019b76da-a810-7000-8000-00000000f0a1";
const TENANT_B_KEY_ID = "019b76da-a810-7000-8000-00000000f0b1";
const CHECKSUM = "a".repeat(64);

function sha256Hex(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

describe("tenancy single mode over HTTP", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let owner: LoginResult;

	function withSession(method: "GET" | "POST", url: string, payload?: Record<string, string | number>): Promise<InjectResponse> {
		return app.inject({
			method,
			url,
			headers: mutationHeaders({ authorization: `Bearer ${owner.accessToken}`, "x-forwarded-for": uniqueClientIp() }),
			...(payload === undefined ? {} : { payload }),
		});
	}

	beforeAll(async () => {
		// Single mode boots only when the default tenant (fixture tenant A) exists, so it is seeded first.
		const prisma = new PrismaService(new TypedConfigService(getApiConfig()));
		await prisma.ensureConnected();
		await seedTwoTenantFixture(prisma);
		await prisma.$disconnect();
		// The default tenant's default policies, as provisioning gives every real tenant, so its owner is authorized
		// and only the tenancy rules below can refuse.
		app = await createE2eApp();
		pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		const ids = TWO_TENANT_FIXTURE;
		await pool.query(`UPDATE public."User" SET "passwordHash" = $1 WHERE id = $2`, [await app.get(CryptoService).hash(FIXTURE_PASSWORD), ids.userAOwner]);
		for (const [id, tenantId, locationId, plaintext, createdByUserId] of [
			[TENANT_A_KEY_ID, ids.tenantA, ids.locationAKl, TENANT_A_KEY, ids.userAOwner],
			[TENANT_B_KEY_ID, ids.tenantB, ids.locationBJb, TENANT_B_KEY, ids.userBOwner],
		] satisfies [string, string, string, string, string][]) {
			await pool.query(
				`INSERT INTO public."TenantApiKey" (id, "tenantId", "locationId", name, "keyHash", "keyPrefix", scope, "createdByUserId", "codeFailureCount", "createdAt", "updatedAt", "isDeleted")
				 VALUES ($1, $2, $3, 'single-mode spec', $4, $5, 'POS', $7, 0, $6, $6, false)
				 ON CONFLICT (id) DO UPDATE SET "keyHash" = EXCLUDED."keyHash", "revokedAt" = NULL, "isDeleted" = false`,
				[id, tenantId, locationId, sha256Hex(plaintext), plaintext.slice(0, 12), ids.epochMs, createdByUserId],
			);
		}
		owner = await login(app, "fixture-a-owner@example.com", FIXTURE_PASSWORD);
	});

	afterAll(async () => {
		// Soft delete, like the app: the keys stay as history and stop authenticating.
		await pool.query(`UPDATE public."TenantApiKey" SET "revokedAt" = $2, "isDeleted" = true, "deletedAt" = $2 WHERE id = ANY($1::text[])`, [
			[TENANT_A_KEY_ID, TENANT_B_KEY_ID],
			Date.now(),
		]);
		await pool.end();
		await app.close();
	});

	it("ST-002: a tenantId in the query or the body is refused with 400", async () => {
		const ids = TWO_TENANT_FIXTURE;
		const inQuery = await withSession("GET", `${TENANT_A_REWARDS}?tenantId=${ids.tenantB}`);
		expect(inQuery.statusCode, inQuery.body).toBe(400);

		const inBody = await withSession("POST", `${API_VERSION_PREFIX}/tenants/fixture-tenant-a/files/upload-url`, {
			category: "STORE_LOGO",
			assetType: "LOGO",
			tenantId: ids.tenantB,
			fileName: "logo.png",
			mimeType: "image/png",
			sizeBytes: 1024,
			checksumSha256: CHECKSUM,
		});
		expect(inBody.statusCode, inBody.body).toBe(400);
	});

	it("does not recognise another tenant's API key (401), and does recognise the default tenant's", async () => {
		const other = await app.inject({ method: "GET", url: INTEGRATION_REWARDS, headers: { "x-api-key": TENANT_B_KEY, "x-forwarded-for": uniqueClientIp() } });
		expect(other.statusCode, other.body).toBe(401);

		const served = await app.inject({ method: "GET", url: INTEGRATION_REWARDS, headers: { "x-api-key": TENANT_A_KEY, "x-forwarded-for": uniqueClientIp() } });
		expect(served.statusCode, served.body).not.toBe(401);
	});

	it("refuses another tenant's location on the default tenant's route, and serves the default tenant's own", async () => {
		const own = await withSession("GET", `${TENANT_A_REWARDS}/summary?locationId=${TWO_TENANT_FIXTURE.locationAKl}`);
		expect(own.statusCode, own.body).toBe(200);

		const response = await withSession("GET", `${TENANT_A_REWARDS}/summary?locationId=${TWO_TENANT_FIXTURE.locationBJb}`);
		expect(response.statusCode, response.body).toBe(404);
		expect(response.body).not.toContain(TWO_TENANT_FIXTURE.rewardB);
	});
});

import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { CryptoService } from "../../../src/contexts/identity/infrastructure/security/crypto.service";
import { TENANT_SEED_IDS } from "../../../prisma/seed/tenant-seed-ids";
import { TENANT_SEED_SLUGS } from "../../../prisma/seed/tenants";
import { PrismaService } from "../../../src/prisma/prisma.service";
import { createE2eApp, login, type InjectResponse, type LoginResult, uniqueClientIp } from "../../e2e-helpers";
import { seedTwoTenantFixture, TWO_TENANT_FIXTURE } from "../../support/two-tenant-fixture";

/**
 * Membership over HTTP (plan §8.1, MT-004 / MT-005 / MT-006's application half). The service-level
 * isolation spec proves the database refuses these reads; this one proves what a client is told:
 *
 * - MT-004: a member of tenant B only, on tenant A's route, gets the same 404 a missing tenant gets
 *   (a non-member cannot tell that tenant A exists — recorded as a deviation from the plan's 403);
 * - MT-005: a SUSPENDED membership gets 403 `MEMBERSHIP_INACTIVE`, even with a valid session;
 * - MT-006 (application): naming another tenant's location on one's own tenant route is refused.
 */

/** The password the fixture users get for this spec (the fixture's own hash is a placeholder). */
const FIXTURE_PASSWORD = "Fixture@Membership1";
const TENANT_A_REWARDS = `${API_VERSION_PREFIX}/tenants/fixture-tenant-a/rewards`;
const TENANT_B_CONTEXT = `${API_VERSION_PREFIX}/tenants/fixture-tenant-b/context`;

const ErrorEnvelopeSchema = z.object({ success: z.literal(false), error: z.object({ code: z.string() }) });

describe("tenancy multi: membership over HTTP", () => {
	let app: NestFastifyApplication;
	let tenantBOwner: LoginResult;
	let suspendedMember: LoginResult;

	async function get(user: LoginResult, url: string): Promise<InjectResponse> {
		return app.inject({ method: "GET", url, headers: { authorization: `Bearer ${user.accessToken}`, "x-forwarded-for": uniqueClientIp() } });
	}

	function errorCode(response: InjectResponse): string {
		return ErrorEnvelopeSchema.parse(response.json()).error.code;
	}

	beforeAll(async () => {
		app = await createE2eApp();
		await seedTwoTenantFixture(app.get(PrismaService));
		const pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		const passwordHash = await app.get(CryptoService).hash(FIXTURE_PASSWORD);
		await pool.query(`UPDATE public."User" SET "passwordHash" = $1 WHERE id = ANY($2::text[])`, [
			passwordHash,
			[TWO_TENANT_FIXTURE.userBOwner, TWO_TENANT_FIXTURE.userASuspended],
		]);
		await pool.end();
		tenantBOwner = await login(app, "fixture-b-owner@example.com", FIXTURE_PASSWORD);
		suspendedMember = await login(app, "fixture-a-suspended@example.com", FIXTURE_PASSWORD);
	});

	afterAll(async () => {
		await app.close();
	});

	it("MT-004: a member of tenant B only gets 404 on tenant A's route, and is served on their own", async () => {
		// Their own tenant's member-wide context: the session works and the member is recognised.
		const own = await get(tenantBOwner, TENANT_B_CONTEXT);
		expect(own.statusCode, own.body).toBe(200);

		const other = await get(tenantBOwner, TENANT_A_REWARDS);
		expect(other.statusCode, other.body).toBe(404);
		expect(errorCode(other)).toBe("NOT_FOUND");
	});

	it("MT-005: a suspended membership gets 403 MEMBERSHIP_INACTIVE with a valid session", async () => {
		const response = await get(suspendedMember, TENANT_A_REWARDS);

		expect(response.statusCode, response.body).toBe(403);
		expect(errorCode(response)).toBe("MEMBERSHIP_INACTIVE");
	});

	it("MT-006 (application): an owner naming another tenant's location on their own route is refused, never answered from it", async () => {
		// Seeded tenants carry their default policies, so the owner is allowed and only the location can refuse.
		const klOwner = await login(app, "brew.owner@kl-rewards.demo", "BrewOwner@123", "merchant");
		const response = await get(klOwner, `${API_VERSION_PREFIX}/tenants/${TENANT_SEED_SLUGS.kl}/rewards?locationId=${TENANT_SEED_IDS.mlkLocationKatil}`);

		expect(response.statusCode, response.body).toBe(404);
		expect(errorCode(response)).toBe("NOT_FOUND");
	});
});

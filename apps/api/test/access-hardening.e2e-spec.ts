import { Pool } from "pg";
import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API_VERSION_PREFIX } from "@workspace/shared";

import { REWARD_SEED_IDS } from "../prisma/seed/rewards";
import { createE2eApp, login, mutationHeaders, uniqueClientIp } from "./e2e-helpers";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";

describe("Access hardening (e2e)", () => {
	let app: NestFastifyApplication;
	let mlkApiKeyId: string;

	beforeAll(async () => {
		app = await createE2eApp();

		const pool = new Pool({ connectionString: DATABASE_URL });
		await pool.query(`UPDATE public.users SET email_verified_at = $1 WHERE email = $2`, [Date.now(), "alice.johnson@example.com"]);
		const result = await pool.query<{ id: string }>(`SELECT id FROM public.merchant_api_keys WHERE merchant_org_id = $1 LIMIT 1`, [REWARD_SEED_IDS.mlkOrg]);
		await pool.end();
		const keyId = result.rows[0]?.id;
		if (keyId === undefined) {
			throw new Error("Seed data missing MLK merchant API key — run pnpm db:seed");
		}
		mlkApiKeyId = keyId;
	});

	afterAll(async () => {
		await app.close();
	});

	it("rejects admin login for a normal user", async () => {
		const response = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/auth/login`,
			headers: mutationHeaders({
				"cf-connecting-ip": uniqueClientIp(),
				"x-client-type": "admin",
			}),
			payload: { email: "user@example.com", password: "User@123" },
		});

		expect([401, 403]).toContain(response.statusCode);
		if (response.statusCode === 401) {
			expect(response.json().error).toBe("INVALID_CREDENTIALS");
		}
	});

	it("denies a normal user from calling admin RBAC APIs", async () => {
		const session = await login(app, "user@example.com", "User@123");

		const response = await app.inject({
			method: "GET",
			url: `${API_VERSION_PREFIX}/admin/roles`,
			headers: {
				cookie: `accessToken=${session.accessToken}; refreshToken=${session.refreshToken}`,
			},
		});

		expect(response.statusCode).toBe(403);
	});

	it("prevents user B from reading user A claim QR payload", async () => {
		const bob = await login(app, "bob.smith@example.com", "Bob@123");

		const response = await app.inject({
			method: "GET",
			url: `${API_VERSION_PREFIX}/claims/${REWARD_SEED_IDS.claimPendingKl}/qr`,
			headers: {
				cookie: `accessToken=${bob.accessToken}; refreshToken=${bob.refreshToken}`,
			},
		});

		expect([403, 404]).toContain(response.statusCode);
	});

	it("allows the claim owner to refresh their QR payload", async () => {
		const alice = await login(app, "alice.johnson@example.com", "Alice@123");

		const response = await app.inject({
			method: "GET",
			url: `${API_VERSION_PREFIX}/claims/${REWARD_SEED_IDS.claimPendingKl}/qr`,
			headers: {
				cookie: `accessToken=${alice.accessToken}; refreshToken=${alice.refreshToken}`,
			},
		});

		expect(response.statusCode).toBe(200);
		expect(response.json().success).toBe(true);
	});

	it("prevents a merchant owner from updating another org reward", async () => {
		const klOwner = await login(app, "brew.owner@kl-rewards.demo", "BrewOwner@123", "merchant");

		const response = await app.inject({
			method: "PATCH",
			url: `${API_VERSION_PREFIX}/merchant/rewards/${REWARD_SEED_IDS.mlkRewardDisabled}`,
			headers: mutationHeaders({
				cookie: `merchantAccessToken=${klOwner.accessToken}; merchantRefreshToken=${klOwner.refreshToken}`,
				"x-client-type": "merchant",
				"x-merchant-org-id": REWARD_SEED_IDS.klOrg,
			}),
			payload: { title: "Cross-org takeover attempt" },
		});

		expect([403, 404]).toContain(response.statusCode);
	});

	it("prevents a merchant owner from revoking another org API key", async () => {
		const klOwner = await login(app, "brew.owner@kl-rewards.demo", "BrewOwner@123", "merchant");

		const response = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/merchant/api-keys/${mlkApiKeyId}/revoke`,
			headers: mutationHeaders({
				cookie: `merchantAccessToken=${klOwner.accessToken}; merchantRefreshToken=${klOwner.refreshToken}`,
				"x-client-type": "merchant",
				"x-merchant-org-id": REWARD_SEED_IDS.klOrg,
			}),
		});

		expect([403, 404]).toContain(response.statusCode);
	});

	it("does not change credentials when adding an existing user as a merchant member", async () => {
		const klOwner = await login(app, "brew.owner@kl-rewards.demo", "BrewOwner@123", "merchant");

		const createResponse = await app.inject({
			method: "POST",
			url: `${API_VERSION_PREFIX}/merchant/members`,
			headers: mutationHeaders({
				cookie: `merchantAccessToken=${klOwner.accessToken}; merchantRefreshToken=${klOwner.refreshToken}`,
				"x-client-type": "merchant",
				"x-merchant-org-id": REWARD_SEED_IDS.klOrg,
			}),
			payload: {
				email: "user@example.com",
				password: "Attacker@123",
				fullName: "Attacker Name",
				role: "CASHIER",
			},
		});

		expect(createResponse.statusCode).toBe(201);

		const victimSession = await login(app, "user@example.com", "User@123");
		expect(victimSession.accessToken.length).toBeGreaterThan(0);
	});
});

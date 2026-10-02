import { Pool } from "pg";
import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { API_VERSION_PREFIX, ApiErrorResponseSchema, AuthorizationDecisionsResponseSchema, AuthorizationResultSchema } from "@workspace/shared";

import { ORGANIZATION_SEED_IDS } from "../prisma/seed/organizations";
import { createE2eApp, extractCookie, login, mutationHeaders, parseSuccessEnvelope, type LoginResult } from "./e2e-helpers";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";

function cookieHeader(session: LoginResult): string {
	return `accessToken=${session.accessToken}; refreshToken=${session.refreshToken}`;
}

async function idFor(pool: Pool, sql: string, value: string): Promise<string> {
	const result = await pool.query<{ id: string }>(sql, [value]);
	const id = result.rows.at(0)?.id;
	if (id === undefined) {
		throw new Error(`Seed data missing for ${value} — run pnpm db:seed`);
	}
	return id;
}

/**
 * End-to-end coverage for the authorization kernel hardening: forged tenant
 * ids, privilege escalation, enforced @Authorize self-service routes, scoped
 * RLS for refresh-token routes, and the capability decisions endpoint.
 */
describe("Authorization hardening (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let userId: string;
	let managerId: string;
	let targetUserId: string;
	let superAdminRoleId: string;
	let managerRoleId: string;
	let updateRolePermissionId: string;

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: DATABASE_URL });
		userId = await idFor(pool, `SELECT id FROM public.users WHERE email = $1`, "user@example.com");
		managerId = await idFor(pool, `SELECT id FROM public.users WHERE email = $1`, "manager@example.com");
		targetUserId = await idFor(pool, `SELECT id FROM public.users WHERE email = $1`, "user-01@example.com");
		superAdminRoleId = await idFor(pool, `SELECT id FROM public.roles WHERE name = $1`, "SuperAdmin");
		managerRoleId = await idFor(pool, `SELECT id FROM public.roles WHERE name = $1`, "Manager");
		updateRolePermissionId = await idFor(pool, `SELECT id FROM public.permissions WHERE action = 'UPDATE' AND resource = 'ROLE' AND scope = $1`, "GLOBAL");

		// Full (non-restricted) sessions: verified email and an MFA enrollment deadline in the future.
		await pool.query(`UPDATE public.users SET email_verified_at = $1, mfa_enrollment_deadline = $2 WHERE email = ANY($3)`, [
			Date.now(),
			Date.now() + 86_400_000,
			["user@example.com", "manager@example.com", "bob.smith@example.com", "admin@example.com"],
		]);

		// The manager may manage role assignments (UPDATE:ROLE) but holds far fewer permissions than SuperAdmin.
		await pool.query(
			`INSERT INTO public.user_permissions (id, "userId", "permissionId", effect)
       VALUES (gen_random_uuid(), $1, $2, 'ALLOW')
       ON CONFLICT ("userId", "permissionId") DO UPDATE SET is_deleted = false, deleted_at = NULL, effect = 'ALLOW'`,
			[managerId, updateRolePermissionId],
		);
	});

	afterAll(async () => {
		await pool.query(`DELETE FROM public.user_permissions WHERE "userId" = $1 AND "permissionId" = $2`, [managerId, updateRolePermissionId]);
		await pool.query(`DELETE FROM public.user_roles WHERE "userId" = $1 AND "roleId" = $2`, [targetUserId, managerRoleId]);
		await pool.end();
		await app.close();
	});

	describe("tenant context", () => {
		it("rejects a forged x-organization-id for a non-member", async () => {
			const session = await login(app, "user@example.com", "User@123");

			const response = await app.inject({
				method: "GET",
				url: `${API_VERSION_PREFIX}/auth/me`,
				headers: { cookie: cookieHeader(session), "x-organization-id": ORGANIZATION_SEED_IDS.mlkOrganization },
			});

			expect(response.statusCode, response.body).toBe(403);
			expect(ApiErrorResponseSchema.parse(response.json()).error.code).toBe("PERMISSION_DENIED");
		});

		it("accepts the header for an active member", async () => {
			const session = await login(app, "jonker.owner@melaka-rewards.demo", "JonkerOwner@123");

			const response = await app.inject({
				method: "GET",
				url: `${API_VERSION_PREFIX}/auth/me`,
				headers: { cookie: cookieHeader(session), "x-organization-id": ORGANIZATION_SEED_IDS.mlkOrganization },
			});

			expect(response.statusCode).toBe(200);
		});
	});

	describe("stores", () => {
		async function storeIdForOwner(ownerEmail: string): Promise<string> {
			return idFor(
				pool,
				`SELECT s.id FROM public.stores s
         JOIN public.store_memberships m ON m.store_id = s.id
         JOIN public.users u ON u.id = m.user_id
         WHERE u.email = $1 AND s.status = 'ACTIVE' ORDER BY s.code LIMIT 1`,
				ownerEmail,
			);
		}

		it("grants store-membership permissions only inside the member's own store", async () => {
			const klStoreId = await storeIdForOwner("brew.cashier@kl-rewards.demo");
			await pool.query(`UPDATE public.users SET email_verified_at = $1, mfa_enrollment_deadline = $2 WHERE email = $3`, [
				Date.now(),
				Date.now() + 86_400_000,
				"brew.cashier@kl-rewards.demo",
			]);
			const cashier = await login(app, "brew.cashier@kl-rewards.demo", "BrewCashier@123");

			const response = await app.inject({
				method: "POST",
				url: `${API_VERSION_PREFIX}/authorization/decisions`,
				headers: mutationHeaders({ cookie: cookieHeader(cashier), "x-store-id": klStoreId }),
				payload: {
					checks: [
						{ action: "CREATE", resource: "REDEMPTION" },
						{ action: "UPDATE", resource: "STORE" },
					],
				},
			});

			expect(response.statusCode, response.body).toBe(200);
			expect(parseSuccessEnvelope(response, AuthorizationDecisionsResponseSchema).data.results.map((result) => result.allowed)).toEqual([true, false]);
		});

		it("rejects a forged x-store-id for another organization's store", async () => {
			const mlkStoreId = await storeIdForOwner("jonker.cashier@melaka-rewards.demo");
			const cashier = await login(app, "brew.cashier@kl-rewards.demo", "BrewCashier@123");

			const response = await app.inject({
				method: "GET",
				url: `${API_VERSION_PREFIX}/auth/me`,
				headers: { cookie: cookieHeader(cashier), "x-store-id": mlkStoreId },
			});

			expect(response.statusCode, response.body).toBe(403);
		});
	});

	describe("capability decisions", () => {
		it("evaluates implicit self grants and denies acting on others", async () => {
			const session = await login(app, "user@example.com", "User@123");

			const response = await app.inject({
				method: "POST",
				url: `${API_VERSION_PREFIX}/authorization/decisions`,
				headers: mutationHeaders({ cookie: cookieHeader(session) }),
				payload: {
					checks: [
						{ action: "UPDATE", resource: "USER", resourceId: userId },
						{ action: "DELETE", resource: "USER", resourceId: userId },
						{ action: "UPDATE", resource: "USER", resourceId: targetUserId },
						{ action: "MANAGE", resource: "ROLE" },
					],
				},
			});

			expect(response.statusCode, response.body).toBe(200);
			const allowed = parseSuccessEnvelope(response, AuthorizationDecisionsResponseSchema).data.results.map((result) => result.allowed);
			expect(allowed).toEqual([true, false, false, false]);
		});

		it("restricts explain() to permission administrators", async () => {
			const user = await login(app, "user@example.com", "User@123");
			const denied = await app.inject({
				method: "GET",
				url: `${API_VERSION_PREFIX}/authorization/decisions/explain?action=READ&resource=USER`,
				headers: { cookie: cookieHeader(user) },
			});
			expect(denied.statusCode).toBe(403);

			const admin = await login(app, "admin@example.com", "Admin@123");
			const explained = await app.inject({
				method: "GET",
				url: `${API_VERSION_PREFIX}/authorization/decisions/explain?action=READ&resource=USER&userId=${userId}`,
				headers: { cookie: cookieHeader(admin) },
			});
			expect(explained.statusCode).toBe(200);
			expect(parseSuccessEnvelope(explained, AuthorizationResultSchema).data.decision).toBe("DENY");
		});
	});

	describe("self-service routes enforce @Authorize with self()", () => {
		it("lets a user reach their own change-password flow (fails on credentials, not authorization)", async () => {
			const session = await login(app, "user@example.com", "User@123");

			const response = await app.inject({
				method: "POST",
				url: `${API_VERSION_PREFIX}/auth/change-password`,
				headers: mutationHeaders({ cookie: cookieHeader(session) }),
				payload: { currentPassword: "Wrong@12345", newPassword: "Another@12345", confirmPassword: "Another@12345" },
			});

			expect(response.statusCode, response.body).not.toBe(403);
			expect(response.statusCode).toBeGreaterThanOrEqual(400);
		});
	});

	describe("privilege escalation", () => {
		it("blocks changing one's own role assignments", async () => {
			const manager = await login(app, "manager@example.com", "Manager@123");

			const response = await app.inject({
				method: "POST",
				url: `${API_VERSION_PREFIX}/admin/roles/user/sync`,
				headers: mutationHeaders({ cookie: cookieHeader(manager) }),
				payload: { userId: managerId, roleIds: [superAdminRoleId] },
			});

			expect(response.statusCode, response.body).toBe(403);
			expect(ApiErrorResponseSchema.parse(response.json()).error.code).toBe("PERMISSION_DENIED");
		});

		it("blocks granting a role with permissions the actor does not hold", async () => {
			const manager = await login(app, "manager@example.com", "Manager@123");

			const response = await app.inject({
				method: "POST",
				url: `${API_VERSION_PREFIX}/admin/roles/user/assign`,
				headers: mutationHeaders({ cookie: cookieHeader(manager) }),
				payload: { userId: targetUserId, roleId: superAdminRoleId },
			});

			expect(response.statusCode, response.body).toBe(403);
			expect(ApiErrorResponseSchema.parse(response.json()).error.code).toBe("PERMISSION_DENIED");
		});

		it("allows granting a role whose permissions the actor already holds", async () => {
			const manager = await login(app, "manager@example.com", "Manager@123");

			const response = await app.inject({
				method: "POST",
				url: `${API_VERSION_PREFIX}/admin/roles/user/assign`,
				headers: mutationHeaders({ cookie: cookieHeader(manager) }),
				payload: { userId: targetUserId, roleId: managerRoleId },
			});

			expect(response.statusCode, response.body).toBe(201);
		});
	});

	describe("refresh-token routes run under a user-scoped RLS context", () => {
		it("refreshes and logs out without an RLS bypass", async () => {
			const session = await login(app, "bob.smith@example.com", "Bob@123");

			const refreshed = await app.inject({
				method: "POST",
				url: `${API_VERSION_PREFIX}/auth/refresh`,
				headers: mutationHeaders({ cookie: cookieHeader(session) }),
			});
			expect(refreshed.statusCode, refreshed.body).toBeLessThan(300);

			const rotatedRefresh = extractCookie(refreshed.headers["set-cookie"], "refreshToken") ?? session.refreshToken;
			const loggedOut = await app.inject({
				method: "POST",
				url: `${API_VERSION_PREFIX}/auth/logout`,
				headers: mutationHeaders({ cookie: `refreshToken=${rotatedRefresh}` }),
			});
			expect(loggedOut.statusCode, loggedOut.body).toBeLessThan(300);
		});
	});
});

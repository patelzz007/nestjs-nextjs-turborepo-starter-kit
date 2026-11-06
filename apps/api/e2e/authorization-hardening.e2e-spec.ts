import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	API_VERSION_PREFIX,
	ApiErrorResponseSchema,
	AuthorizationDecisionsResponseSchema,
	AuthorizationResultSchema,
	TenantContextResponseSchema,
	UserResponseSchema,
} from "@workspace/shared";

import { TENANT_SEED_IDS, TENANT_SEED_SLUGS } from "../prisma/seed/tenants";
import { createE2eApp, createTestPlatformRole, dropTestPlatformRole, extractCookie, login, mutationHeaders, parseSuccessEnvelope, type LoginResult } from "./e2e-helpers";

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
 * ids, privilege escalation, enforced self-service routes (`@RequirePermission` with `self()`), scoped
 * RLS for refresh-token routes, and the capability decisions endpoint.
 */
describe("Authorization hardening (e2e)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let userId: string;
	let managerId: string;
	let targetUserId: string;
	let superAdminRoleId: string;
	let adminRoleId: string;
	/** A platform role made only of permissions the lesser admin holds (Admin's admin-dashboard read). */
	const readerRoleId = randomUUID();
	let updateRolePermissionId: string;

	beforeAll(async () => {
		app = await createE2eApp();
		pool = new Pool({ connectionString: DATABASE_URL });
		userId = await idFor(pool, `SELECT id FROM public."User" WHERE email = $1`, "user@example.com");
		managerId = await idFor(pool, `SELECT id FROM public."User" WHERE email = $1`, "manager@example.com");
		targetUserId = await idFor(pool, `SELECT id FROM public."User" WHERE email = $1`, "user-01@example.com");
		superAdminRoleId = await idFor(pool, `SELECT id FROM public."Role" WHERE name = $1 AND "tenantId" IS NULL`, "SuperAdmin");
		// The platform Admin role (tenants' roles share template names, so only tenantless rows).
		adminRoleId = await idFor(pool, `SELECT id FROM public."Role" WHERE name = $1 AND "tenantId" IS NULL`, "Admin");
		updateRolePermissionId = await idFor(pool, `SELECT id FROM public."Permission" WHERE action = 'UPDATE' AND resource = 'ROLE' AND scope = $1`, "GLOBAL");

		// Full (non-restricted) sessions: verified email and an MFA enrollment deadline in the future.
		await pool.query(`UPDATE public."User" SET "emailVerifiedAt" = $1, "mfaEnrollmentDeadline" = $2 WHERE email = ANY($3)`, [
			Date.now(),
			Date.now() + 86_400_000,
			["user@example.com", "manager@example.com", "bob.smith@example.com", "admin@example.com"],
		]);

		await createTestPlatformRole(pool, { id: readerRoleId, label: "dashboard reader", permissions: [["READ", "ADMIN_DASHBOARD"]] });
		// The lesser admin (manager@, an Admin since ADR 067 retired the platform Manager role) may manage
		// role assignments (a platform UPDATE:ROLE grant) but holds far fewer permissions than SuperAdmin.
		await pool.query(`INSERT INTO public."UserPermission" (id, "userId", "permissionId", effect, "tenantId") VALUES (uuidv7(), $1, $2, 'ALLOW', NULL)`, [
			managerId,
			updateRolePermissionId,
		]);
	});

	afterAll(async () => {
		await dropTestPlatformRole(pool, readerRoleId);
		await pool.query(`DELETE FROM public."UserPermission" WHERE "userId" = $1 AND "permissionId" = $2`, [managerId, updateRolePermissionId]);
		await pool.query(`DELETE FROM public."UserRole" WHERE "userId" = $1 AND "roleId" = $2`, [targetUserId, adminRoleId]);
		await pool.end();
		await app.close();
	});

	describe("tenant context", () => {
		it("ignores a forged x-tenant-id: a header never selects a tenant (D6), so the response is unchanged", async () => {
			const session = await login(app, "user@example.com", "User@123");
			const me = (headers: Readonly<Record<string, string>>): ReturnType<NestFastifyApplication["inject"]> =>
				app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/auth/me`, headers: { cookie: cookieHeader(session), ...headers } });

			const plain = await me({});
			const forged = await me({ "x-tenant-id": TENANT_SEED_IDS.mlkTenant });

			expect(forged.statusCode, forged.body).toBe(plain.statusCode);
			expect(parseSuccessEnvelope(forged, UserResponseSchema).data).toEqual(parseSuccessEnvelope(plain, UserResponseSchema).data);
		});

		it("accepts the header for an active member", async () => {
			const session = await login(app, "jonker.owner@melaka-rewards.demo", "JonkerOwner@123");

			const response = await app.inject({
				method: "GET",
				url: `${API_VERSION_PREFIX}/auth/me`,
				headers: { cookie: cookieHeader(session), "x-tenant-id": TENANT_SEED_IDS.mlkTenant },
			});

			expect(response.statusCode).toBe(200);
		});
	});

	describe("informational headers", () => {
		it("x-location-id narrows nothing: the owner's tenant context lists every store, header or not", async () => {
			const session = await login(app, "jonker.owner@melaka-rewards.demo", "JonkerOwner@123");
			const context = (headers: Readonly<Record<string, string>>): ReturnType<NestFastifyApplication["inject"]> =>
				app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/tenants/${TENANT_SEED_SLUGS.mlk}/context`, headers: { cookie: cookieHeader(session), ...headers } });

			const plain = await context({});
			const informed = await context({ "x-tenant-id": TENANT_SEED_IDS.mlkTenant, "x-location-id": TENANT_SEED_IDS.mlkLocationKatil });

			expect(informed.statusCode, informed.body).toBe(200);
			expect(parseSuccessEnvelope(informed, TenantContextResponseSchema).data).toEqual(parseSuccessEnvelope(plain, TenantContextResponseSchema).data);
		});
	});

	describe("a member's role applies at their own stores only (ADR 067)", () => {
		/** A store the member's location scope names explicitly (seeded: each cashier's own store). */
		async function ownStoreOf(email: string): Promise<string> {
			return idFor(
				pool,
				`SELECT s."locationId" AS id FROM public."MembershipLocationScope" s
         JOIN public."Membership" m ON m.id = s."membershipId"
         JOIN public."User" u ON u.id = m."userId"
         WHERE u.email = $1 AND m."isDeleted" = false AND s."isDeleted" = false AND s."scopeType" = 'SELECTED' AND s."locationId" IS NOT NULL
         ORDER BY s."locationId" LIMIT 1`,
				email,
			);
		}

		/** [redeem a claim, update the store] at `locationId` — the Cashier template holds the first only. */
		async function decide(session: Awaited<ReturnType<typeof login>>, locationId: string): Promise<readonly boolean[]> {
			const response = await app.inject({
				method: "POST",
				url: `${API_VERSION_PREFIX}/authorization/decisions?locationId=${locationId}`,
				headers: mutationHeaders({ cookie: cookieHeader(session) }),
				payload: {
					checks: [
						{ action: "REDEEM", resource: "CLAIM" },
						{ action: "UPDATE", resource: "LOCATION" },
					],
				},
			});
			expect(response.statusCode, response.body).toBe(200);
			return parseSuccessEnvelope(response, AuthorizationDecisionsResponseSchema).data.results.map((result) => result.allowed);
		}

		it("allows what the cashier's role gives at the cashier's own store, and nothing it does not give", async () => {
			const klLocationId = await ownStoreOf("brew.cashier@kl-rewards.demo");
			await pool.query(`UPDATE public."User" SET "emailVerifiedAt" = $1, "mfaEnrollmentDeadline" = $2 WHERE email = $3`, [
				Date.now(),
				Date.now() + 86_400_000,
				"brew.cashier@kl-rewards.demo",
			]);
			const cashier = await login(app, "brew.cashier@kl-rewards.demo", "BrewCashier@123");

			expect(await decide(cashier, klLocationId)).toEqual([true, false]);
		});

		it("grants nothing at another tenant's store", async () => {
			const mlkLocationId = await ownStoreOf("jonker.cashier@melaka-rewards.demo");
			const cashier = await login(app, "brew.cashier@kl-rewards.demo", "BrewCashier@123");

			expect(await decide(cashier, mlkLocationId)).toEqual([false, false]);
		});

		it("reads nothing from the retired x-store-id header", async () => {
			const cashier = await login(app, "brew.cashier@kl-rewards.demo", "BrewCashier@123");

			const response = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/auth/me`, headers: { cookie: cookieHeader(cashier), "x-store-id": "not-a-store" } });

			expect(response.statusCode, response.body).toBe(200);
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
						{ action: "UPDATE", resource: "ROLE" },
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

	describe("self-service routes enforce @RequirePermission with self()", () => {
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
				payload: { userId: targetUserId, roleId: readerRoleId },
			});

			expect(response.statusCode, response.body).toBe(201);
		});

		it("records the assignment in permission_audit_logs with the real actor, readable through the audit viewer", async () => {
			const audited = await pool.query<{ actorId: string }>(
				`SELECT "actorId" AS "actorId" FROM public."PermissionAuditLog" WHERE action = 'ROLE_ASSIGNED' AND "targetUserId" = $1 AND "targetRoleId" = $2 ORDER BY "createdAt" DESC LIMIT 1`,
				[targetUserId, readerRoleId],
			);
			expect(audited.rows.at(0)?.actorId).toBe(managerId);

			const superAdmin = await login(app, "superadmin@example.com", "SuperAdmin@123");
			const response = await app.inject({
				method: "GET",
				url: `${API_VERSION_PREFIX}/admin/audit?filter[action]=ROLE_ASSIGNED&filter[targetUserId]=${targetUserId}`,
				headers: { cookie: cookieHeader(superAdmin) },
			});
			expect(response.statusCode, response.body).toBe(200);
			expect(response.body).toContain(managerId);
		});

		it("blocks a lesser admin from removing a role beyond its own reach (and from touching a SuperAdmin account)", async () => {
			const manager = await login(app, "manager@example.com", "Manager@123");
			const superAdminUserId = await idFor(pool, `SELECT id FROM public."User" WHERE email = $1`, "superadmin@example.com");

			const response = await app.inject({
				method: "POST",
				url: `${API_VERSION_PREFIX}/admin/roles/user/remove`,
				headers: mutationHeaders({ cookie: cookieHeader(manager) }),
				payload: { userId: superAdminUserId, roleId: superAdminRoleId },
			});

			expect(response.statusCode, response.body).toBe(403);
		});

		it("refuses to delete a system role, even for a SuperAdmin", async () => {
			const superAdmin = await login(app, "superadmin@example.com", "SuperAdmin@123");

			const response = await app.inject({
				method: "DELETE",
				url: `${API_VERSION_PREFIX}/admin/roles/${adminRoleId}`,
				headers: mutationHeaders({ cookie: cookieHeader(superAdmin) }),
			});

			expect(response.statusCode, response.body).toBe(403);
		});

		it("rejects a client-set isSystem flag on permission create", async () => {
			const superAdmin = await login(app, "superadmin@example.com", "SuperAdmin@123");

			const response = await app.inject({
				method: "POST",
				url: `${API_VERSION_PREFIX}/admin/permissions`,
				headers: mutationHeaders({ cookie: cookieHeader(superAdmin) }),
				payload: { action: "READ", resource: "REPORT", isSystem: true },
			});

			expect(response.statusCode, response.body).toBe(400);
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

import { Pool } from "pg";
import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AuthorizationKernelService } from "../src/contexts/authorization/infrastructure/kernel/authorization-kernel.service";
import { TENANT_SEED_IDS } from "../prisma/seed/tenants";
import { createE2eApp } from "./e2e-helpers";

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";

async function idFor(pool: Pool, sql: string, value: string): Promise<string> {
	const result = await pool.query<{ id: string }>(sql, [value]);
	const id = result.rows.at(0)?.id;
	if (id === undefined) {
		throw new Error(`Seed data missing for ${value} — run pnpm db:seed`);
	}
	return id;
}

/**
 * Authorization Kernel against the seeded database (ADR 067): real role grants, grants on top,
 * ownership, no explicit DENY, and tenant verification.
 * Kernel reads open their own allowlisted lookups (`auth.principal.lookup`,
 * `auth.membership.lookup`, `authorization.acl.match`). The test does not
 * wrap them in a request-wide bypass.
 */
describe("Authorization Kernel (e2e, seeded database)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let kernel: AuthorizationKernelService;
	let userId: string;
	let managerId: string;
	let mlkOwnerId: string;
	let readReportPermissionId: string;
	let readDashboardPermissionId: string;
	const createdAclIds: string[] = [];

	const decide = <T>(work: () => Promise<T>): Promise<T> => work();

	beforeAll(async () => {
		app = await createE2eApp();
		kernel = app.get(AuthorizationKernelService);
		pool = new Pool({ connectionString: DATABASE_URL });
		userId = await idFor(pool, `SELECT id FROM public."User" WHERE email = $1`, "user@example.com");
		managerId = await idFor(pool, `SELECT id FROM public."User" WHERE email = $1`, "manager@example.com");
		mlkOwnerId = await idFor(pool, `SELECT id FROM public."User" WHERE email = $1`, "jonker.owner@melaka-rewards.demo");
		readDashboardPermissionId = await idFor(pool, `SELECT id FROM public."Permission" WHERE action = 'READ' AND resource = 'ADMIN_DASHBOARD' AND scope = $1`, "GLOBAL");
		readReportPermissionId = await idFor(pool, `SELECT id FROM public."Permission" WHERE action = 'READ' AND resource = 'REPORT' AND scope = $1`, "GLOBAL");
	});

	afterAll(async () => {
		await pool.query(`DELETE FROM public."UserPermission" WHERE "userId" = $1 AND "permissionId" = $2`, [managerId, readDashboardPermissionId]);
		if (createdAclIds.length > 0) {
			await pool.query(`DELETE FROM public."ResourceAcl" WHERE id = ANY($1)`, [createdAclIds]);
		}
		await pool.end();
		await app.close();
	});

	it("allows the seeded admin dashboard permission for Admin-role users", async () => {
		const adminId = await idFor(pool, `SELECT id FROM public."User" WHERE email = $1`, "admin@example.com");

		expect(await decide(() => kernel.can({ subject: { userId: adminId }, action: "READ", resource: "ADMIN_DASHBOARD" }))).toBe("ALLOW");
	});

	it("denies by default for permissions the subject does not hold", async () => {
		expect(await decide(() => kernel.can({ subject: { userId }, action: "DELETE", resource: "USER" }))).toBe("DENY");
	});

	it("honours implicit self grants but never extends them to other users", async () => {
		expect(await decide(() => kernel.can({ subject: { userId }, action: "UPDATE", resource: "USER", resourceId: userId }))).toBe("ALLOW");
		expect(await decide(() => kernel.can({ subject: { userId }, action: "UPDATE", resource: "USER", resourceId: managerId }))).toBe("DENY");
	});

	it("has no explicit DENY (ADR 067): a leftover DENY row neither takes a role's permission away nor grants anything", async () => {
		expect(await decide(() => kernel.can({ subject: { userId: managerId }, action: "READ", resource: "ADMIN_DASHBOARD" }))).toBe("ALLOW");

		await pool.query(`INSERT INTO public."UserPermission" (id, "userId", "permissionId", effect, "tenantId") VALUES (uuidv7(), $1, $2, 'DENY', NULL)`, [
			managerId,
			readDashboardPermissionId,
		]);

		const result = await decide(() => kernel.explain({ subject: { userId: managerId }, action: "READ", resource: "ADMIN_DASHBOARD" }));
		expect(result.decision).toBe("ALLOW");
		expect(result.evaluation.at(-1)?.source).toBe("role");
		expect(await decide(() => kernel.can({ subject: { userId }, action: "READ", resource: "ADMIN_DASHBOARD" }))).toBe("DENY");
	});

	it("lets a platform grant add a permission on top of the role, naming the grant as the path", async () => {
		await pool.query(`INSERT INTO public."UserPermission" (id, "userId", "permissionId", effect, "tenantId") VALUES (uuidv7(), $1, $2, 'ALLOW', NULL)`, [
			userId,
			readReportPermissionId,
		]);

		const result = await decide(() => kernel.explain({ subject: { userId }, action: "READ", resource: "REPORT" }));
		await pool.query(`DELETE FROM public."UserPermission" WHERE "userId" = $1 AND "permissionId" = $2`, [userId, readReportPermissionId]);

		expect(result.decision).toBe("ALLOW");
		expect(result.evaluation.at(-1)?.source).toBe("grant");
	});

	it("ignores a leftover ACL DENY row: the owner still updates their own record, and only their own", async () => {
		const created = await pool.query<{ id: string }>(
			`INSERT INTO public."ResourceAcl" (id, "subjectType", "subjectId", action, "resourceType", "resourceId", effect)
       VALUES (uuidv7(), 'USER', $1, 'UPDATE', 'USER', $1, 'DENY') RETURNING id`,
			[userId],
		);
		const aclId = created.rows.at(0)?.id;
		if (aclId !== undefined) {
			createdAclIds.push(aclId);
		}

		expect(await decide(() => kernel.can({ subject: { userId }, action: "UPDATE", resource: "USER", resourceId: userId }))).toBe("ALLOW");
		expect(await decide(() => kernel.can({ subject: { userId }, action: "UPDATE", resource: "USER", resourceId: managerId }))).toBe("DENY");
	});

	it("rejects a forged tenant and accepts a verified membership", async () => {
		const forged = await decide(() => kernel.explain({ subject: { userId, tenantId: TENANT_SEED_IDS.mlkTenant }, action: "READ", resource: "USER", resourceId: userId }));
		expect(forged.decision).toBe("DENY");
		expect(forged.evaluation.at(-1)?.source).toBe("tenant");

		const member = await decide(() =>
			kernel.explain({ subject: { userId: mlkOwnerId, tenantId: TENANT_SEED_IDS.mlkTenant }, action: "READ", resource: "USER", resourceId: mlkOwnerId }),
		);
		expect(member.decision).toBe("ALLOW");
		expect(member.request.subject.tenantId).toBe(TENANT_SEED_IDS.mlkTenant);
	});

	it("never grants permissions from tenant membership alone", async () => {
		expect(await decide(() => kernel.can({ subject: { userId: mlkOwnerId, tenantId: TENANT_SEED_IDS.mlkTenant }, action: "DELETE", resource: "TENANT" }))).toBe("DENY");
	});
});

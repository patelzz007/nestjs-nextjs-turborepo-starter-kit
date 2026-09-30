import { Pool } from "pg";
import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { AuthorizationKernelService } from "../src/modules/authorization/kernel/authorization-kernel.service";
import { runWithSystemRlsContext } from "../src/prisma/rls-context";
import { ORGANIZATION_SEED_IDS } from "../prisma/seed/organizations";
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
 * Authorization Kernel against the seeded database: real role grants,
 * per-user overrides, ACL precedence, tenant verification, and filters.
 * Kernel reads run as an allowlisted system operation, exactly like the
 * guard's pre-handler phase.
 */
describe("Authorization Kernel (e2e, seeded database)", () => {
	let app: NestFastifyApplication;
	let pool: Pool;
	let kernel: AuthorizationKernelService;
	let userId: string;
	let managerId: string;
	let mlkOwnerId: string;
	let readReportPermissionId: string;
	const createdAclIds: string[] = [];

	const asSystem = <T>(work: () => Promise<T>): Promise<T> => runWithSystemRlsContext("request.pre_handler", work);

	beforeAll(async () => {
		app = await createE2eApp();
		kernel = app.get(AuthorizationKernelService);
		pool = new Pool({ connectionString: DATABASE_URL });
		userId = await idFor(pool, `SELECT id FROM public.users WHERE email = $1`, "user@example.com");
		managerId = await idFor(pool, `SELECT id FROM public.users WHERE email = $1`, "manager@example.com");
		mlkOwnerId = await idFor(pool, `SELECT id FROM public.users WHERE email = $1`, "jonker.owner@melaka-rewards.demo");
		readReportPermissionId = await idFor(pool, `SELECT id FROM public.permissions WHERE action = 'READ' AND resource = 'REPORT' AND scope = $1`, "GLOBAL");
	});

	afterAll(async () => {
		await pool.query(`DELETE FROM public.user_permissions WHERE "userId" = $1 AND "permissionId" = $2`, [managerId, readReportPermissionId]);
		if (createdAclIds.length > 0) {
			await pool.query(`DELETE FROM public.resource_acls WHERE id = ANY($1)`, [createdAclIds]);
		}
		await pool.end();
		await app.close();
	});

	it("allows the seeded admin dashboard permission for Admin-role users", async () => {
		const adminId = await idFor(pool, `SELECT id FROM public.users WHERE email = $1`, "admin@example.com");

		expect(await asSystem(() => kernel.can({ subject: { userId: adminId }, action: "READ", resource: "ADMIN_DASHBOARD" }))).toBe("ALLOW");
	});

	it("denies by default for permissions the subject does not hold", async () => {
		expect(await asSystem(() => kernel.can({ subject: { userId }, action: "DELETE", resource: "USER" }))).toBe("DENY");
	});

	it("honours implicit self grants but never extends them to other users", async () => {
		expect(await asSystem(() => kernel.can({ subject: { userId }, action: "UPDATE", resource: "USER", resourceId: userId }))).toBe("ALLOW");
		expect(await asSystem(() => kernel.can({ subject: { userId }, action: "UPDATE", resource: "USER", resourceId: managerId }))).toBe("DENY");
	});

	it("lets a per-user DENY override beat a role grant", async () => {
		expect(await asSystem(() => kernel.can({ subject: { userId: managerId }, action: "READ", resource: "REPORT" }))).toBe("ALLOW");

		await pool.query(
			`INSERT INTO public.user_permissions (id, "userId", "permissionId", effect) VALUES (gen_random_uuid(), $1, $2, 'DENY')
       ON CONFLICT ("userId", "permissionId") DO UPDATE SET is_deleted = false, deleted_at = NULL, effect = 'DENY'`,
			[managerId, readReportPermissionId],
		);

		const result = await asSystem(() => kernel.explain({ subject: { userId: managerId }, action: "READ", resource: "REPORT" }));
		expect(result.decision).toBe("DENY");
		expect(result.evaluation.at(-1)?.source).toBe("override");
	});

	it("applies explicit ACL DENY for one resource without affecting others", async () => {
		const created = await pool.query<{ id: string }>(
			`INSERT INTO public.resource_acls (id, subject_type, subject_id, action, resource_type, resource_id, effect)
       VALUES (gen_random_uuid(), 'USER', $1, 'UPDATE', 'USER', $1, 'DENY') RETURNING id`,
			[userId],
		);
		const aclId = created.rows.at(0)?.id;
		if (aclId !== undefined) {
			createdAclIds.push(aclId);
		}

		expect(await asSystem(() => kernel.can({ subject: { userId }, action: "UPDATE", resource: "USER", resourceId: userId }))).toBe("DENY");
		expect(await asSystem(() => kernel.can({ subject: { userId }, action: "READ", resource: "USER", resourceId: userId }))).toBe("ALLOW");
	});

	it("rejects a forged organization and accepts a verified membership", async () => {
		const forged = await asSystem(() =>
			kernel.explain({ subject: { userId, organizationId: ORGANIZATION_SEED_IDS.mlkOrganization }, action: "READ", resource: "USER", resourceId: userId }),
		);
		expect(forged.decision).toBe("DENY");
		expect(forged.evaluation.at(-1)?.source).toBe("tenant");

		const member = await asSystem(() =>
			kernel.explain({ subject: { userId: mlkOwnerId, organizationId: ORGANIZATION_SEED_IDS.mlkOrganization }, action: "READ", resource: "USER", resourceId: mlkOwnerId }),
		);
		expect(member.decision).toBe("ALLOW");
		expect(member.request.subject.organizationId).toBe(ORGANIZATION_SEED_IDS.mlkOrganization);
	});

	it("never grants permissions from organization membership alone", async () => {
		expect(
			await asSystem(() => kernel.can({ subject: { userId: mlkOwnerId, organizationId: ORGANIZATION_SEED_IDS.mlkOrganization }, action: "DELETE", resource: "ORGANIZATION" })),
		).toBe("DENY");
	});

	it("builds list filters from grants", async () => {
		expect(await asSystem(() => kernel.filter({ userId }, "READ", "USER"))).toEqual({ id: { in: [userId] } });
		expect(await asSystem(() => kernel.filter({ userId }, "DELETE", "ORDER"))).toEqual({ id: { in: [] } });
	});
});

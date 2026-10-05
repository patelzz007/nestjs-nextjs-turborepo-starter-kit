import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { getPermissionDefinitions } from "@workspace/shared";

import { RequestContextService } from "../src/common/context/request-context";
import type { TypedConfigService } from "../src/config/typed-config.service";
import { createSuperAdminBootstrapService } from "../src/modules/auth/bootstrap/superadmin-bootstrap.composition";
import { SuperAdminRoleMissingError } from "../src/modules/auth/bootstrap/superadmin-bootstrap.errors";
import { createReferenceDataSyncService, systemOperationRunner } from "../src/modules/authorization/reference-data/reference-data.composition";
import { REFERENCE_DATA_SYNC_OPERATION, type ReferenceDataSyncReport } from "../src/modules/authorization/reference-data/reference-data-sync.service";
import { MERCHANT_CAPABILITY_CATALOG } from "../src/modules/authorization/reference-data/merchant-capability-catalog";
import { SYSTEM_ROLE_CATALOG } from "../src/modules/authorization/reference-data/system-role-catalog";
import { PrismaService } from "../src/prisma/prisma.service";
import { TenantTransactionService } from "../src/prisma/tenant-transaction.service";
import { createScratchDatabase, SCRATCH_SETUP_TIMEOUT_MS, type ScratchDatabase } from "./support/scratch-database";
import { createTestTypedConfig } from "./support/test-api-env";

/**
 * `db:sync-reference-data` against a THROWAWAY, unseeded database (a real deployment's state): the
 * catalog is loaded, a second run writes nothing, drift is converged without touching operator-made rows,
 * and the SuperAdmin bootstrap works right after.
 */

const NumberRow = z.object({ n: z.number() });
const FingerprintRow = z.object({ fingerprint: z.string() });
const AuditRow = z.object({ action: z.string(), actor_kind: z.string(), actor_id: z.string(), detail: z.string() });
const PASSWORD = "Corr3ct-Horse-Battery!";

/** Every reference table's rows (all columns) as one digest: any write — even a no-op UPDATE of updated_at — changes it. */
const FINGERPRINT_SQL = `SELECT md5(concat_ws('|',
	(SELECT coalesce(string_agg(p::text, ',' ORDER BY p.id), '') FROM permissions p),
	(SELECT coalesce(string_agg(r::text, ',' ORDER BY r.id), '') FROM roles r),
	(SELECT coalesce(string_agg(rp::text, ',' ORDER BY rp.id), '') FROM role_permissions rp),
	(SELECT coalesce(string_agg(c::text, ',' ORDER BY c.id), '') FROM capability_definitions c),
	(SELECT count(*)::text FROM permission_audit_logs))) AS fingerprint`;

describe("Reference data sync (integration, scratch database)", () => {
	let database: ScratchDatabase;
	let pool: Pool;
	let config: TypedConfigService;
	let prisma: PrismaService;

	async function runSync(): Promise<ReferenceDataSyncReport> {
		const tenantTx = new TenantTransactionService(prisma, new RequestContextService());
		return createReferenceDataSyncService(systemOperationRunner(tenantTx)).sync();
	}

	async function count(sql: string): Promise<number> {
		return NumberRow.parse((await pool.query(sql)).rows[0]).n;
	}

	async function fingerprint(): Promise<string> {
		return FingerprintRow.parse((await pool.query(FINGERPRINT_SQL)).rows[0]).fingerprint;
	}

	beforeAll(async () => {
		database = await createScratchDatabase(process.env.DATABASE_URL ?? "", "refdata_e2e");
		pool = database.pool;
		config = createTestTypedConfig({ DATABASE_URL: database.url });
		prisma = new PrismaService(config);
		prisma.onModuleInit();
		await prisma.ensureConnected();
		database.track((): Promise<void> => prisma.onModuleDestroy());
	}, SCRATCH_SETUP_TIMEOUT_MS);

	afterAll(async () => {
		await database.drop();
	});

	it("cannot bootstrap a SuperAdmin on the unseeded database (the role catalog is missing)", async () => {
		await expect(
			createSuperAdminBootstrapService(config, prisma).bootstrap({ identity: { email: "root@acme.test", fullName: "Root Admin" }, password: PASSWORD }),
		).rejects.toBeInstanceOf(SuperAdminRoleMissingError);
	});

	it("loads the whole catalog under the system operation, with one audit row per section and no users or demo data", async () => {
		const report = await runSync();

		expect(report.totalChanges).toBeGreaterThan(0);
		expect(report.sections.map((entry) => entry.section)).toEqual(["permissions", "system-roles", "role-permissions", "platform-capabilities", "merchant-capabilities"]);
		expect(await count("SELECT count(*)::int AS n FROM permissions")).toBe(getPermissionDefinitions().length);
		expect(await count(`SELECT count(*)::int AS n FROM roles WHERE "isSystem" AND parent_id IS NULL AND NOT is_deleted`)).toBe(SYSTEM_ROLE_CATALOG.length);
		expect(await count(`SELECT count(*)::int AS n FROM capability_definitions WHERE scope = 'MERCHANT' AND permission_id IS NULL`)).toBe(MERCHANT_CAPABILITY_CATALOG.length);
		const platform = await count(`SELECT count(*)::int AS n FROM capability_definitions WHERE scope = 'PLATFORM' AND permission_id IS NOT NULL`);
		expect(platform).toBeGreaterThan(0);
		expect(await count(`SELECT count(*)::int AS n FROM capability_definitions WHERE scope = 'PLATFORM' AND permission_id IS NULL`)).toBe(0);
		expect(await count(`SELECT count(*)::int AS n FROM role_permissions rp JOIN roles r ON r.id = rp."roleId" WHERE r.name = 'SuperAdmin' AND NOT rp.is_deleted`)).toBe(
			getPermissionDefinitions().length,
		);
		for (const table of ["users", "organizations", "organization_memberships"]) {
			expect(await count(`SELECT count(*)::int AS n FROM ${table}`)).toBe(0);
		}

		const audits = (await pool.query("SELECT action, actor_kind, actor_id, detail FROM permission_audit_logs")).rows.map((row) => AuditRow.parse(row));
		expect(audits).toHaveLength(5);
		for (const audit of audits) {
			expect(audit).toMatchObject({ action: "REFERENCE_DATA_SYNCED", actor_kind: "SYSTEM_OPERATION", actor_id: REFERENCE_DATA_SYNC_OPERATION });
		}
	});

	it("is idempotent: a second run reports zero changes and writes nothing at all", async () => {
		const before = await fingerprint();

		const report = await runSync();

		expect(report.totalChanges).toBe(0);
		expect(await fingerprint()).toBe(before);
	});

	it("does not churn the grants of a soft-deleted permission", async () => {
		await pool.query(
			`UPDATE permissions SET is_deleted = true, deleted_at = 1 WHERE id = (SELECT permission_id FROM (SELECT rp."permissionId" AS permission_id FROM role_permissions rp JOIN roles r ON r.id = rp."roleId" WHERE r.name = 'SuperAdmin' LIMIT 1) g)`,
		);
		const before = await fingerprint();

		const report = await runSync();

		expect(report.totalChanges).toBe(0);
		expect(await fingerprint()).toBe(before);
		await pool.query("UPDATE permissions SET is_deleted = false, deleted_at = NULL WHERE is_deleted");
	});

	it("leaves an operator-made permission alone: no grant to SuperAdmin, no capability", async () => {
		await pool.query(
			`INSERT INTO permissions (id, action, resource, scope, description, "group") VALUES (gen_random_uuid(), 'DELETE', 'REPORT', 'GLOBAL', 'operator-made', 'Reports')`,
		);
		const before = await fingerprint();

		const report = await runSync();

		expect(report.totalChanges).toBe(0);
		expect(await fingerprint()).toBe(before);
		await pool.query(`DELETE FROM permissions WHERE description = 'operator-made'`);
	});

	it("converges drift in system rows and leaves operator-created roles, permissions and grants alone", async () => {
		await pool.query(`INSERT INTO roles (id, name, description) VALUES (gen_random_uuid(), 'Support Lead', 'operator-made')`);
		await pool.query(`UPDATE roles SET description = 'tampered', parent_id = (SELECT id FROM roles WHERE name = 'SuperAdmin') WHERE name = 'Manager'`);
		await pool.query(
			`UPDATE role_permissions SET is_deleted = true, deleted_at = 1 WHERE id = (SELECT rp.id FROM role_permissions rp JOIN roles r ON r.id = rp."roleId" WHERE r.name = 'User' LIMIT 1)`,
		);
		await pool.query(`UPDATE capability_definitions SET label = 'tampered' WHERE slug = (SELECT slug FROM capability_definitions WHERE scope = 'MERCHANT' LIMIT 1)`);
		await pool.query(`DELETE FROM permissions WHERE action = 'READ' AND resource = 'USER' AND scope = 'GLOBAL'`);

		const report = await runSync();

		expect(
			report.sections
				.map((entry) => ({ section: entry.section, changes: entry.change.created + entry.change.updated + entry.change.restored + entry.change.retired }))
				.filter((entry) => entry.changes > 0)
				.map((entry) => entry.section),
		).toEqual(["permissions", "system-roles", "role-permissions", "platform-capabilities", "merchant-capabilities"]);
		expect(await count(`SELECT count(*)::int AS n FROM roles WHERE name = 'Manager' AND description <> 'tampered' AND parent_id IS NULL`)).toBe(1);
		expect(await count("SELECT count(*)::int AS n FROM role_permissions WHERE is_deleted")).toBe(0);
		expect(await count("SELECT count(*)::int AS n FROM capability_definitions WHERE label = 'tampered'")).toBe(0);
		expect(await count("SELECT count(*)::int AS n FROM permissions")).toBe(getPermissionDefinitions().length);
		expect(await count(`SELECT count(*)::int AS n FROM roles WHERE name = 'Support Lead' AND description = 'operator-made' AND NOT "isSystem"`)).toBe(1);
		expect((await runSync()).totalChanges).toBe(0);
	});

	it("makes the SuperAdmin bootstrap succeed right after the sync", async () => {
		const outcome = await createSuperAdminBootstrapService(config, prisma).bootstrap({ identity: { email: "root@acme.test", fullName: "Root Admin" }, password: PASSWORD });

		expect(outcome.email).toBe("root@acme.test");
		expect(await count(`SELECT count(*)::int AS n FROM user_roles ur JOIN roles r ON r.id = ur."roleId" WHERE r.name = 'SuperAdmin'`)).toBe(1);
	});
});

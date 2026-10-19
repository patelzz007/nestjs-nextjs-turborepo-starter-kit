import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { LIST_SLOT_INDEX, getPermissionDefinitions } from "@workspace/shared";

import { RequestContextService } from "../src/platform/infrastructure/context/request-context";
import type { TypedConfigService } from "../src/config/typed-config.service";
import { createSuperAdminBootstrap } from "../src/contexts/identity/superadmin-bootstrap.composition";
import { SuperAdminRoleMissingError } from "../src/contexts/identity/domain/errors/identity.errors";
import { createReferenceDataSyncService, systemOperationRunner } from "../src/contexts/authorization/infrastructure/reference-data/reference-data.composition";
import { REFERENCE_DATA_SYNC_OPERATION, type ReferenceDataSyncReport } from "../src/contexts/authorization/infrastructure/reference-data/reference-data-sync.service";
import { MERCHANT_CAPABILITY_CATALOG } from "../src/contexts/authorization/infrastructure/reference-data/merchant-capability-catalog";
import { SYSTEM_ROLE_CATALOG } from "../src/contexts/authorization/infrastructure/reference-data/system-role-catalog";
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
const AuditRow = z.object({ action: z.string(), actorKind: z.string(), actorId: z.string(), detail: z.string() });
const PASSWORD = "Corr3ct-Horse-Battery!";

/** Every reference table's rows (all columns) as one digest: any write — even a no-op UPDATE of updated_at — changes it. */
const FINGERPRINT_SQL = `SELECT md5(concat_ws('|',
	(SELECT coalesce(string_agg(p::text, ',' ORDER BY p.id), '') FROM "Permission" p),
	(SELECT coalesce(string_agg(r::text, ',' ORDER BY r.id), '') FROM "Role" r),
	(SELECT coalesce(string_agg(rp::text, ',' ORDER BY rp.id), '') FROM "RolePermission" rp),
	(SELECT coalesce(string_agg(c::text, ',' ORDER BY c.id), '') FROM "CapabilityDefinition" c),
	(SELECT count(*)::text FROM "PermissionAuditLog"))) AS fingerprint`;

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
		return NumberRow.parse((await pool.query(sql)).rows[LIST_SLOT_INDEX.first]).n;
	}

	async function fingerprint(): Promise<string> {
		return FingerprintRow.parse((await pool.query(FINGERPRINT_SQL)).rows[LIST_SLOT_INDEX.first]).fingerprint;
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
			createSuperAdminBootstrap(config, prisma).bootstrap({ identity: { email: "root@acme.test", fullName: "Root Admin" }, password: PASSWORD }),
		).rejects.toBeInstanceOf(SuperAdminRoleMissingError);
	});

	it("loads the whole catalog under the system operation, with one audit row per section and no users or demo data", async () => {
		const report = await runSync();

		expect(report.totalChanges).toBeGreaterThan(0);
		expect(report.sections.map((entry) => entry.section)).toEqual(["permissions", "system-roles", "role-permissions", "platform-capabilities", "merchant-capabilities"]);
		expect(await count('SELECT count(*)::int AS n FROM "Permission"')).toBe(getPermissionDefinitions().length);
		expect(await count(`SELECT count(*)::int AS n FROM "Role" WHERE "isSystem" AND "parentId" IS NULL AND NOT "isDeleted"`)).toBe(SYSTEM_ROLE_CATALOG.length);
		expect(await count(`SELECT count(*)::int AS n FROM "CapabilityDefinition" WHERE scope = 'MERCHANT' AND "permissionId" IS NULL`)).toBe(MERCHANT_CAPABILITY_CATALOG.length);
		const platform = await count(`SELECT count(*)::int AS n FROM "CapabilityDefinition" WHERE scope = 'PLATFORM' AND "permissionId" IS NOT NULL`);
		expect(platform).toBeGreaterThan(0);
		expect(await count(`SELECT count(*)::int AS n FROM "CapabilityDefinition" WHERE scope = 'PLATFORM' AND "permissionId" IS NULL`)).toBe(0);
		expect(await count(`SELECT count(*)::int AS n FROM "RolePermission" rp JOIN "Role" r ON r.id = rp."roleId" WHERE r.name = 'SuperAdmin' AND NOT rp."isDeleted"`)).toBe(
			getPermissionDefinitions().length,
		);
		for (const table of ["User", "Organization", "OrganizationMembership"]) {
			expect(await count(`SELECT count(*)::int AS n FROM "${table}"`)).toBe(0);
		}

		const audits = (await pool.query('SELECT action, "actorKind", "actorId", detail FROM "PermissionAuditLog"')).rows.map((row) => AuditRow.parse(row));
		expect(audits).toHaveLength(5);
		for (const audit of audits) {
			expect(audit).toMatchObject({ action: "REFERENCE_DATA_SYNCED", actorKind: "SYSTEM_OPERATION", actorId: REFERENCE_DATA_SYNC_OPERATION });
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
			`UPDATE "Permission" SET "isDeleted" = true, "deletedAt" = 1 WHERE id = (SELECT "permissionId" FROM (SELECT rp."permissionId" AS "permissionId" FROM "RolePermission" rp JOIN "Role" r ON r.id = rp."roleId" WHERE r.name = 'SuperAdmin' LIMIT 1) g)`,
		);
		const before = await fingerprint();

		const report = await runSync();

		expect(report.totalChanges).toBe(0);
		expect(await fingerprint()).toBe(before);
		await pool.query('UPDATE "Permission" SET "isDeleted" = false, "deletedAt" = NULL WHERE "isDeleted"');
	});

	it("leaves an operator-made permission alone: no grant to SuperAdmin, no capability", async () => {
		await pool.query(
			`INSERT INTO "Permission" (id, action, resource, scope, description, "group") VALUES (uuidv7(), 'DELETE', 'REPORT', 'GLOBAL', 'operator-made', 'Reports')`,
		);
		const before = await fingerprint();

		const report = await runSync();

		expect(report.totalChanges).toBe(0);
		expect(await fingerprint()).toBe(before);
		await pool.query(`DELETE FROM "Permission" WHERE description = 'operator-made'`);
	});

	it("converges drift in system rows and leaves operator-created roles, permissions and grants alone", async () => {
		await pool.query(`INSERT INTO "Role" (id, name, description) VALUES (uuidv7(), 'Support Lead', 'operator-made')`);
		await pool.query(`UPDATE "Role" SET description = 'tampered', "parentId" = (SELECT id FROM "Role" WHERE name = 'SuperAdmin') WHERE name = 'Manager'`);
		await pool.query(
			`UPDATE "RolePermission" SET "isDeleted" = true, "deletedAt" = 1 WHERE id = (SELECT rp.id FROM "RolePermission" rp JOIN "Role" r ON r.id = rp."roleId" WHERE r.name = 'User' LIMIT 1)`,
		);
		await pool.query(`UPDATE "CapabilityDefinition" SET label = 'tampered' WHERE slug = (SELECT slug FROM "CapabilityDefinition" WHERE scope = 'MERCHANT' LIMIT 1)`);
		await pool.query(`DELETE FROM "Permission" WHERE action = 'READ' AND resource = 'USER' AND scope = 'GLOBAL'`);

		const report = await runSync();

		expect(
			report.sections
				.map((entry) => ({ section: entry.section, changes: entry.change.created + entry.change.updated + entry.change.restored + entry.change.retired }))
				.filter((entry) => entry.changes > 0)
				.map((entry) => entry.section),
		).toEqual(["permissions", "system-roles", "role-permissions", "platform-capabilities", "merchant-capabilities"]);
		expect(await count(`SELECT count(*)::int AS n FROM "Role" WHERE name = 'Manager' AND description <> 'tampered' AND "parentId" IS NULL`)).toBe(1);
		expect(await count('SELECT count(*)::int AS n FROM "RolePermission" WHERE "isDeleted"')).toBe(0);
		expect(await count("SELECT count(*)::int AS n FROM \"CapabilityDefinition\" WHERE label = 'tampered'")).toBe(0);
		expect(await count('SELECT count(*)::int AS n FROM "Permission"')).toBe(getPermissionDefinitions().length);
		expect(await count(`SELECT count(*)::int AS n FROM "Role" WHERE name = 'Support Lead' AND description = 'operator-made' AND NOT "isSystem"`)).toBe(1);
		expect((await runSync()).totalChanges).toBe(0);
	});

	it("makes the SuperAdmin bootstrap succeed right after the sync", async () => {
		const outcome = await createSuperAdminBootstrap(config, prisma).bootstrap({ identity: { email: "root@acme.test", fullName: "Root Admin" }, password: PASSWORD });

		expect(outcome.email).toBe("root@acme.test");
		expect(await count(`SELECT count(*)::int AS n FROM "UserRole" ur JOIN "Role" r ON r.id = ur."roleId" WHERE r.name = 'SuperAdmin'`)).toBe(1);
	});
});

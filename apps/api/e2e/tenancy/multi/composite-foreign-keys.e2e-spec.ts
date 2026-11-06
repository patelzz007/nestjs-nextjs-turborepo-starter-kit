import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { TENANT_INTEGRITY_RELATIONS, type TenantIntegrityRelation } from "../../../src/platform/infrastructure/tenancy/tenant-integrity";
import { getApiConfig } from "../../../src/config/api-config";
import { TypedConfigService } from "../../../src/config/typed-config.service";
import { PrismaService } from "../../../src/prisma/prisma.service";
import { seedTwoTenantFixture } from "../../support/two-tenant-fixture";

/**
 * MT-006 (database half) and MT-62: every child row can reference a parent only of its own tenant.
 * For each composite foreign key of the multi-tenancy plan §7, a real child row of one tenant is
 * pointed at a parent row of another tenant; PostgreSQL refuses with a foreign-key violation even
 * though RLS is not consulted (foreign keys bind every role, the table owner included). Each attempt
 * runs in a transaction that is rolled back, so the shared e2e database is left unchanged.
 */

/** SQLSTATE `foreign_key_violation`. */
const FOREIGN_KEY_VIOLATION = "23503";

const ChildRowSchema = z.object({ id: z.string(), tenantId: z.string() });
const ParentRowSchema = z.object({ id: z.string() });
const PgErrorSchema = z.object({ code: z.string() });

/** Table and column names come from the typed relation list; they are quoted, never user input. */
function q(identifier: string): string {
	return `"${identifier}"`;
}

describe("composite tenant foreign keys", () => {
	const prisma = new PrismaService(new TypedConfigService(getApiConfig()));
	const pool = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });

	beforeAll(async () => {
		await prisma.ensureConnected();
		await seedTwoTenantFixture(prisma);
	});

	afterAll(async () => {
		await pool.end();
		await prisma.$disconnect();
	});

	/** The SQLSTATE of pointing a child row at another tenant's parent, or null when PostgreSQL accepted it. */
	async function crossTenantUpdate(relation: TenantIntegrityRelation): Promise<string | null> {
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			const [child] = z.array(ChildRowSchema).parse((await client.query(`SELECT id, "tenantId" AS "tenantId" FROM public.${q(relation.child)} ORDER BY id LIMIT 1`)).rows);
			if (child === undefined) {
				throw new Error(`No ${relation.child} row to test — the fixture or demo seed must provide one`);
			}
			const [parent] = z
				.array(ParentRowSchema)
				// An unreferenced parent first, so a unique key on the foreign key cannot refuse before it does.
				.parse(
					(
						await client.query(
							`SELECT p.id FROM public.${q(relation.parent)} p WHERE p."tenantId" <> $1 ORDER BY EXISTS (SELECT 1 FROM public.${q(relation.child)} c WHERE c.${q(relation.foreignKey)} = p.id), p.id LIMIT 1`,
							[child.tenantId],
						)
					).rows,
				);
			if (parent === undefined) {
				throw new Error(`No ${relation.parent} row of another tenant — the two-tenant fixture must provide one`);
			}
			try {
				await client.query(`UPDATE public.${q(relation.child)} SET ${q(relation.foreignKey)} = $1 WHERE id = $2`, [parent.id, child.id]);
				return null;
			} catch (error) {
				const parsed = PgErrorSchema.safeParse(error);
				return parsed.success ? parsed.data.code : "unknown";
			}
		} finally {
			await client.query("ROLLBACK");
			client.release();
		}
	}

	it("covers the fourteen §7 relations", () => {
		expect(TENANT_INTEGRITY_RELATIONS).toHaveLength(14);
	});

	for (const relation of TENANT_INTEGRITY_RELATIONS) {
		it(`MT-006: ${relation.child}(tenantId, ${relation.foreignKey}) cannot reference another tenant's ${relation.parent}`, async () => {
			expect(await crossTenantUpdate(relation)).toBe(FOREIGN_KEY_VIOLATION);
		});
	}
});

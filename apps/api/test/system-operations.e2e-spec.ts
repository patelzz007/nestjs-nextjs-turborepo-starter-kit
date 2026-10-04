import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { RequestContextService } from "../src/common/context/request-context";
import { getApiConfig } from "../src/config/api-config";
import { TypedConfigService } from "../src/config/typed-config.service";
import { TenantEnumeratorService } from "../src/infrastructure/jobs/tenant-enumerator.service";
import { TenantJobContextService } from "../src/infrastructure/jobs/tenant-job-context.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { TenantTransactionService } from "../src/prisma/tenant-transaction.service";
import { ORGANIZATION_SEED_IDS } from "../prisma/seed/organizations";

/**
 * The system-operation allowlist is enforced by PostgreSQL, not only by the
 * TypeScript registry (ADR 012):
 * - `app.rls_bypass = true` WITHOUT a named operation is no bypass at all;
 * - an operation runs as its registry role (`SET ROLE`): `tenant.enumerate`
 *   is the read-only `app_enumerator`, which can list organizations and
 *   nothing else.
 */

const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";

describe("System operations are enforced by the database (integration)", () => {
	let pool: Pool;
	let prisma: PrismaService;

	async function inSession(role: string, settings: Readonly<Record<string, string>>, run: (client: PoolClient) => Promise<void>): Promise<void> {
		const client = await pool.connect();
		try {
			await client.query("BEGIN");
			await client.query("SELECT set_config('role', $1, true)", [role]);
			for (const [name, value] of Object.entries(settings)) {
				await client.query("SELECT set_config($1, $2, true)", [name, value]);
			}
			await run(client);
		} finally {
			await client.query("ROLLBACK");
			client.release();
		}
	}

	beforeAll(async () => {
		pool = new Pool({ connectionString: DATABASE_URL });
		prisma = new PrismaService(new TypedConfigService(getApiConfig()));
		prisma.onModuleInit();
		await prisma.ensureConnected();
	});

	afterAll(async () => {
		await prisma.onModuleDestroy();
		await pool.end();
	});

	it("treats a bypass flag without a named system operation as NO bypass", async () => {
		await inSession("app_runtime", { "app.rls_bypass": "true", "app.system_operation": "" }, async (client) => {
			const outbox = await client.query<{ count: number }>("SELECT count(*)::int AS count FROM public.outbox_events");
			const bypass = await client.query<{ bypass: boolean }>("SELECT app_rls_bypass() AS bypass");
			expect(bypass.rows[0]?.bypass).toBe(false);
			expect(outbox.rows[0]?.count).toBe(0);
		});
	});

	it("honours a bypass that names its operation", async () => {
		await inSession("app_runtime", { "app.rls_bypass": "true", "app.system_operation": "outbox.publish" }, async (client) => {
			const bypass = await client.query<{ bypass: boolean }>("SELECT app_rls_bypass() AS bypass");
			expect(bypass.rows[0]?.bypass).toBe(true);
		});
	});

	it("gives the enumerator role organizations, and nothing else", async () => {
		await inSession("app_enumerator", { "app.rls_bypass": "true", "app.system_operation": "tenant.enumerate" }, async (client) => {
			const orgs = await client.query<{ count: number }>("SELECT count(*)::int AS count FROM public.organizations");
			expect(orgs.rows[0]?.count).toBeGreaterThan(0);
			await expect(client.query("SELECT id FROM public.users LIMIT 1")).rejects.toThrow(/permission denied/);
		});
		await inSession("app_enumerator", { "app.rls_bypass": "true", "app.system_operation": "tenant.enumerate" }, async (client) => {
			await expect(client.query("UPDATE public.organizations SET is_deleted = is_deleted")).rejects.toThrow(/permission denied/);
		});
	});

	it("runs TenantEnumeratorService under the enumerator role end to end", async () => {
		const enumerator = new TenantEnumeratorService(
			new TenantTransactionService(prisma, new RequestContextService()),
			new TenantJobContextService(new TypedConfigService(getApiConfig())),
		);

		const ids: string[] = await enumerator.listActiveOrganizationIds();

		expect(ids).toEqual(expect.arrayContaining([ORGANIZATION_SEED_IDS.klOrganization]));
	});
});

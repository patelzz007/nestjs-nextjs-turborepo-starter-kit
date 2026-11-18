// The policies ask "may the caller do resource.action at this row's tenant (and store)?" once per statement, through
// app_permitted_tenants / app_permitted_stores (generator/permission-check.ts), instead of app_has_permission once per
// row. This proves the two answer the same, for every fixture user, bound or unbound tenant, store (none, live,
// another tenant's, unknown) and permission — with store-limited, tenant-wide, expired and deleted-store grants added.
import { randomUUID } from "node:crypto";

import { LIST_SLOT_INDEX } from "@workspace/shared";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getApiConfig } from "../../src/config/api-config";
import { TypedConfigService } from "../../src/config/typed-config.service";
import { PrismaService } from "../../src/prisma/prisma.service";
import { seedTwoTenantFixture, TWO_TENANT_FIXTURE } from "../support/two-tenant-fixture";

const ids = TWO_TENANT_FIXTURE;
/** The validated `DATABASE_URL` from the API's own config: this worker's database copy (e2e/setup-env.ts). */
const DATABASE_URL: string = getApiConfig().database.url;

const USERS: readonly string[] = [ids.userAOwner, ids.userAKlManager, ids.userACashier, ids.userASuspended, ids.userBOwner, ids.userCustomerC];
const TENANTS: readonly string[] = [ids.tenantA, ids.tenantB, ids.tenantS];
/** The bound tenant of the session: none (a tenantless request) or each tenant. */
const BINDINGS: readonly string[] = ["", ids.tenantA, ids.tenantB];
const UNKNOWN_STORE = "019b76da-a810-7000-8000-00000000ffff";
const STORES: readonly (string | null)[] = [null, ids.locationAKl, ids.locationAMalacca, ids.locationBJb, UNKNOWN_STORE];
const PERMISSIONS: readonly (readonly [string, string])[] = [
	["REWARD", "READ"],
	["REWARD", "UPDATE"],
	["ANALYTICS", "READ"],
	["REDEMPTION", "READ"],
	["TERMINAL", "CREATE"],
	["MEMBER", "UPDATE"],
	["KYB", "UPDATE"],
	["WEBHOOK", "READ"],
];

/** A grant of `resource.action` to `userId` in tenant A, optionally at one store and with an expiry. */
async function grant(client: PoolClient, userId: string, resource: string, action: string, locationId: string | null, expiresAt: number | null): Promise<void> {
	const inserted = await client.query(
		`INSERT INTO public."UserPermission" (id, "userId", "permissionId", "tenantId", "locationId", effect, "expiresAt")
		 SELECT $1, $2, p.id, $3, $4, 'ALLOW', $5 FROM public."Permission" p WHERE p.resource = $6 AND p.action = $7 AND p.scope = 'GLOBAL' AND p."isDeleted" = false`,
		[randomUUID(), userId, ids.tenantA, locationId, expiresAt, resource, action],
	);
	expect(inserted.rowCount).toBe(1);
}

describe("app_permitted_tenants / app_permitted_stores answer exactly as app_has_permission", () => {
	const prisma = new PrismaService(new TypedConfigService(getApiConfig()));
	let pool: Pool;

	beforeAll(async () => {
		await prisma.ensureConnected();
		await seedTwoTenantFixture(prisma);
		pool = new Pool({ connectionString: DATABASE_URL });
	});

	afterAll(async () => {
		await pool.end();
		await prisma.$disconnect();
	});

	it("for every user, binding, tenant, store and permission (grants of every kind included)", async () => {
		const client = await pool.connect();
		let compared = 0;
		try {
			await client.query("BEGIN");
			// Grants the roles do not give: store-limited, tenant-wide, expired, and at a deleted store.
			await grant(client, ids.userACashier, "ANALYTICS", "READ", ids.locationAKl, null);
			await grant(client, ids.userACashier, "WEBHOOK", "READ", null, null);
			await grant(client, ids.userAKlManager, "KYB", "UPDATE", null, 1);
			await grant(client, ids.userAKlManager, "TERMINAL", "CREATE", ids.locationAMalacca, null);
			await client.query(`UPDATE public."Location" SET "isDeleted" = true WHERE id = $1`, [ids.locationAMalacca]);
			await client.query("SET LOCAL ROLE app_runtime");
			for (const userId of USERS) {
				for (const binding of BINDINGS) {
					await client.query(
						"SELECT set_config('app.rls_bypass', 'false', true), set_config('app.current_user_id', $1, true), set_config('app.current_tenant_id', $2, true)",
						[userId, binding],
					);
					for (const [resource, action] of PERMISSIONS) {
						for (const tenantId of TENANTS) {
							for (const storeId of STORES) {
								const result = await client.query<{ readonly reference: boolean; readonly fast: boolean }>(
									`SELECT app_has_permission($1, $2, $3, $4) AS reference,
									        CASE WHEN $4::text IS NULL THEN $3 = ANY (app_permitted_tenants($1, $2))
									             ELSE ($3 || '|*') = ANY (app_permitted_stores($1, $2)) OR ($3 || '|' || $4) = ANY (app_permitted_stores($1, $2)) END AS fast`,
									[resource, action, tenantId, storeId],
								);
								const row = result.rows[LIST_SLOT_INDEX.first];
								expect(row?.fast, `${userId} bound=${binding || "none"} ${resource}.${action} tenant=${tenantId} store=${storeId ?? "none"}`).toBe(row?.reference);
								compared += 1;
							}
						}
					}
				}
			}
		} finally {
			await client.query("ROLLBACK");
			client.release();
		}
		expect(compared).toBe(USERS.length * BINDINGS.length * PERMISSIONS.length * TENANTS.length * STORES.length);
	});
});

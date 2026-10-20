import { Pool, type PoolClient } from "pg";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getApiConfig } from "../../../src/config/api-config";
import { TenancyConfigService } from "../../../src/config/tenancy.config";
import { TypedConfigService } from "../../../src/config/typed-config.service";
import { NotFoundError } from "../../../src/platform/application/errors/app-error";
import { RequestContextService } from "../../../src/platform/infrastructure/context/request-context";
import { DefaultTenantMissingError, DefaultTenantService } from "../../../src/platform/infrastructure/tenancy/default-tenant.service";
import { FixedTenantSource } from "../../../src/platform/infrastructure/tenancy/fixed-tenant.source";
import { PrismaTenantRouteLookup } from "../../../src/platform/infrastructure/tenancy/prisma-tenant-route.lookup";
import { PrismaService } from "../../../src/prisma/prisma.service";
import { TenantTransactionService } from "../../../src/prisma/tenant-transaction.service";
import { SEED_TEST_FIXTURE_OPERATION } from "../../../src/prisma/seed-test-fixture.operation";
import { seedTwoTenantFixture, TWO_TENANT_FIXTURE } from "../../support/two-tenant-fixture";
import { decideTenantLifecycle } from "../../../src/contexts/tenancy/domain/policies/tenant-lifecycle.policy";

const CREATED_LOCATION_ID = "019b76da-a810-7000-8000-0000000000af";

async function withTenant(pool: Pool, tenantId: string, userId: string, run: (client: PoolClient) => Promise<void>): Promise<void> {
	const client = await pool.connect();
	try {
		await client.query("SET ROLE app_runtime");
		await client.query("SELECT set_config('app.rls_bypass', 'false', false)");
		await client.query("SELECT set_config('app.current_tenant_id', $1, false)", [tenantId]);
		await client.query("SELECT set_config('app.current_user_id', $1, false)", [userId]);
		await run(client);
	} finally {
		await client.query("DISCARD ALL");
		client.release();
	}
}

describe("tenancy single mode", () => {
	const config = new TypedConfigService(getApiConfig());
	const prisma = new PrismaService(config);
	const transactions = new TenantTransactionService(prisma, new RequestContextService());
	const source = new FixedTenantSource(new TenancyConfigService(config), new PrismaTenantRouteLookup(transactions));
	const pool = new Pool({ connectionString: process.env.DATABASE_URL });

	beforeAll(async () => {
		await prisma.ensureConnected();
		await seedTwoTenantFixture(prisma);
	});

	afterAll(async () => {
		await pool.end();
		await prisma.$disconnect();
	});

	it("ST-001: a location created for the resolved default tenant belongs to it", async () => {
		const ids = TWO_TENANT_FIXTURE;
		// A tenant route names the default tenant by its slug; a route without one has no tenant (as in multi mode).
		const resolved = await source.resolve({ tenantSlug: "fixture-tenant-a" });
		expect(resolved).toEqual({ kind: "tenant", tenantId: ids.tenantA, lifecycleState: "ACTIVE" });
		expect(await source.resolve({})).toEqual({ kind: "none" });
		if (resolved.kind !== "tenant") {
			return;
		}

		await withTenant(pool, resolved.tenantId, ids.userAOwner, async (client) => {
			await client.query(
				`INSERT INTO public."Location" (id, "tenantId", name, code, status, "isPrimary", "createdAt", "updatedAt", "isDeleted") VALUES ($1, $2, 'A created', 'a-created', 'ACTIVE', false, $3, $3, false)`,
				[CREATED_LOCATION_ID, resolved.tenantId, ids.epochMs],
			);
			const row = await client.query<{ tenantId: string }>(`SELECT "tenantId" FROM public."Location" WHERE id = $1`, [CREATED_LOCATION_ID]);
			expect(row.rows[LIST_SLOT_INDEX.first]?.tenantId).toBe(ids.tenantA);
		});
	});

	it("ST-002: a slug of tenant B is not found and tenant B's location is not returned", async () => {
		const ids = TWO_TENANT_FIXTURE;
		await expect(source.resolve({ tenantSlug: "fixture-tenant-b" })).rejects.toBeInstanceOf(NotFoundError);
		await withTenant(pool, ids.tenantA, ids.userAOwner, async (client) => {
			const other = await client.query<{ id: string }>(`SELECT id FROM public."Location" WHERE id = $1`, [ids.locationBJb]);
			expect(other.rows).toEqual([]);
		});
	});

	it("ST-003: boot fails when the default tenant has been deleted", async () => {
		const ids = TWO_TENANT_FIXTURE;
		await transactions.withSystemOperation({ operation: SEED_TEST_FIXTURE_OPERATION, reason: "Soft-delete the default tenant for ST-003", actorUserId: null }, async (tx) => {
			await tx.tenant.update({ where: { id: ids.tenantA }, data: { isDeleted: true } });
		});

		const boot = new DefaultTenantService(new TenancyConfigService(config), new PrismaTenantRouteLookup(transactions));
		await expect(boot.onModuleInit()).rejects.toBeInstanceOf(DefaultTenantMissingError);

		await transactions.withSystemOperation({ operation: SEED_TEST_FIXTURE_OPERATION, reason: "Restore the default tenant after ST-003", actorUserId: null }, async (tx) => {
			await tx.tenant.update({ where: { id: ids.tenantA }, data: { isDeleted: false } });
		});
	});

	it("ST-003: boot fails when the default tenant's lifecycle is DELETED, though its row is not soft-deleted", async () => {
		const ids = TWO_TENANT_FIXTURE;
		await transactions.withSystemOperation({ operation: SEED_TEST_FIXTURE_OPERATION, reason: "Mark the default tenant DELETED for ST-003", actorUserId: null }, async (tx) => {
			await tx.tenant.update({ where: { id: ids.tenantA }, data: { lifecycleState: "DELETED" } });
		});

		const boot = new DefaultTenantService(new TenancyConfigService(config), new PrismaTenantRouteLookup(transactions));
		await expect(boot.onModuleInit()).rejects.toBeInstanceOf(DefaultTenantMissingError);

		await transactions.withSystemOperation({ operation: SEED_TEST_FIXTURE_OPERATION, reason: "Restore the default tenant after ST-003", actorUserId: null }, async (tx) => {
			await tx.tenant.update({ where: { id: ids.tenantA }, data: { lifecycleState: "ACTIVE" } });
		});
	});

	it("ST-004: a default tenant suspended after boot rejects ordinary routes and allows lifecycle routes", async () => {
		const ids = TWO_TENANT_FIXTURE;
		await transactions.withSystemOperation({ operation: SEED_TEST_FIXTURE_OPERATION, reason: "Suspend the default tenant for ST-004", actorUserId: null }, async (tx) => {
			await tx.tenant.update({ where: { id: ids.tenantA }, data: { lifecycleState: "SUSPENDED" } });
		});

		try {
			const resolved = await source.resolve({ tenantSlug: "fixture-tenant-a" });
			expect(resolved).toEqual({ kind: "tenant", tenantId: ids.tenantA, lifecycleState: "SUSPENDED" });
			if (resolved.kind !== "tenant") {
				return;
			}
			expect(decideTenantLifecycle({ lifecycleState: resolved.lifecycleState, isDeleted: false, route: "ordinary", membershipStatus: "ACTIVE" })).toEqual({
				kind: "tenant_suspended",
			});
			expect(decideTenantLifecycle({ lifecycleState: resolved.lifecycleState, isDeleted: false, route: "lifecycle", membershipStatus: "ACTIVE" })).toEqual({
				kind: "allow",
			});
		} finally {
			await transactions.withSystemOperation({ operation: SEED_TEST_FIXTURE_OPERATION, reason: "Restore the default tenant after ST-004", actorUserId: null }, async (tx) => {
				await tx.tenant.update({ where: { id: ids.tenantA }, data: { lifecycleState: "ACTIVE" } });
			});
		}
	});
});

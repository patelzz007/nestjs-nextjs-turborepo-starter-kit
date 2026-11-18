// The tenant tables' permission-level row-level security (ADR 090), proved as the runtime role on the two-tenant e2e
// fixture (tenant A's Owner, KL Manager and Cashier; tenant B), never on the development seed. Every test builds what
// it needs (custom roles, shares, files) inside ONE transaction that is rolled back: arranged as the superuser, then
// checked as `app_runtime` for one member, so nothing it does survives or leaks into another test.
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

/** A transaction arranged as the superuser and checked as one member; rolled back at the end, whatever happens. */
async function inRolledBackTransaction(pool: Pool, run: (client: PoolClient) => Promise<void>): Promise<void> {
	const client = await pool.connect();
	try {
		await client.query("BEGIN");
		await run(client);
	} finally {
		await client.query("ROLLBACK");
		client.release();
	}
}

/** Switches the transaction to `app_runtime` acting as `userId` in `tenantId` (row-level security applies from here on). */
async function actAs(client: PoolClient, userId: string, tenantId: string = ids.tenantA): Promise<void> {
	await client.query("RESET ROLE");
	await client.query("SET LOCAL ROLE app_runtime");
	await client.query("SELECT set_config('app.rls_bypass', 'false', true), set_config('app.current_tenant_id', $1, true), set_config('app.current_user_id', $2, true)", [
		tenantId,
		userId,
	]);
}

/** Back to the superuser, to arrange more rows. */
async function arrange(client: PoolClient): Promise<void> {
	await client.query("RESET ROLE");
}

async function count(client: PoolClient, table: string, tenantId: string = ids.tenantA): Promise<number> {
	const result = await client.query<{ count: number }>(`SELECT count(*)::int AS count FROM public."${table}" WHERE "tenantId" = $1`, [tenantId]);
	return result.rows[LIST_SLOT_INDEX.first]?.count ?? 0;
}

/** Rows a statement changed, or 0 when row-level security refused it (the savepoint undoes the failure). */
async function changed(client: PoolClient, statement: string, params: readonly (string | number)[]): Promise<number> {
	await client.query("SAVEPOINT attempt");
	try {
		const result = await client.query(statement, [...params]);
		await client.query("RELEASE SAVEPOINT attempt");
		return result.rowCount ?? 0;
	} catch {
		await client.query("ROLLBACK TO SAVEPOINT attempt");
		return 0;
	}
}

/**
 * Gives the Cashier a custom role of tenant A holding exactly `permissions` (`RESOURCE.ACTION`): a new role, its
 * permissions, and the Cashier's membership moved onto it — arranged as the superuser.
 */
async function giveCashierRole(client: PoolClient, permissions: readonly string[]): Promise<void> {
	await arrange(client);
	const roleId = randomUUID();
	await client.query(`INSERT INTO public."Role" (id, name, kind, "tenantId") VALUES ($1, $2, 'TENANT', $3)`, [roleId, `custom-${roleId}`, ids.tenantA]);
	for (const permission of permissions) {
		const [resource, action] = permission.split(".");
		const inserted = await client.query(
			`INSERT INTO public."RolePermission" (id, "roleId", "permissionId")
			 SELECT $1, $2, p.id FROM public."Permission" p WHERE p.resource = $3 AND p.action = $4 AND p.scope = 'GLOBAL' AND p."isDeleted" = false`,
			[randomUUID(), roleId, resource ?? "", action ?? ""],
		);
		expect(inserted.rowCount, permission).toBe(1);
	}
	await client.query(`UPDATE public."Membership" SET "roleId" = $1 WHERE id = $2`, [roleId, ids.membershipACashier]);
}

/** A file of tenant A, uploaded by the Owner, in `category` — arranged as the superuser. */
async function tenantFile(client: PoolClient, category: string): Promise<string> {
	await arrange(client);
	const id = randomUUID();
	await client.query(
		`INSERT INTO public."StoredFile" (id, category, visibility, "originalName", "mimeType", "sizeBytes", "expectedChecksum", "storageBucket", "storagePath", "uploadedById", "tenantId", status)
		 VALUES ($1, $2, 'PRIVATE', 'f.png', 'image/png', 1, 'x', 'bucket', $5, $3, $4, 'READY')`,
		[id, category, ids.userAOwner, ids.tenantA, `tightening/${id}`],
	);
	return id;
}

async function visibleFile(client: PoolClient, fileId: string): Promise<boolean> {
	const result = await client.query(`SELECT 1 FROM public."StoredFile" WHERE id = $1`, [fileId]);
	return result.rowCount === 1;
}

describe("Tenant permission tightening (RLS as app_runtime, ADR 090)", () => {
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

	it("keeps system-only tenant tables out of every member's reach, the Owner's included", async () => {
		await inRolledBackTransaction(pool, async (client) => {
			await actAs(client, ids.userAOwner);
			for (const table of ["TenantEncryptionKey", "TenantLifecycleEvent", "TenantPlacement", "TenantSlugHistory", "SupportAccessGrant", "PaymentEvent"]) {
				expect(await count(client, table), table).toBe(0);
			}
		});
	});

	it("lets every member read the tenant's stores (the merchant shell), and only location.update change them", async () => {
		await inRolledBackTransaction(pool, async (client) => {
			await actAs(client, ids.userACashier);
			expect(await count(client, "Location")).toBeGreaterThan(0);
			expect(await changed(client, `UPDATE public."Location" SET name = name WHERE "tenantId" = $1`, [ids.tenantA])).toBe(0);
			await actAs(client, ids.userAOwner);
			expect(await changed(client, `UPDATE public."Location" SET name = name WHERE "tenantId" = $1`, [ids.tenantA])).toBeGreaterThan(0);
		});
	});

	it("shows the Owner the team and a Cashier only their own membership, and lets nobody write a membership (all system operations)", async () => {
		await inRolledBackTransaction(pool, async (client) => {
			await actAs(client, ids.userAOwner);
			expect(await count(client, "Membership")).toBeGreaterThan(1);
			expect(await changed(client, `UPDATE public."Membership" SET "displayName" = 'x' WHERE id = $1`, [ids.membershipAOwner])).toBe(0);
			await actAs(client, ids.userACashier);
			expect(await count(client, "Membership")).toBe(1);
			// Renaming oneself runs as `tenant.membership.rename_own`: the member holds no UPDATE, so cannot change their own role.
			expect(await changed(client, `UPDATE public."Membership" SET "displayName" = 'me' WHERE id = $1`, [ids.membershipACashier])).toBe(0);
		});
	});

	it("never shows tenant B's rows to tenant A's Owner (its published rewards are the public marketplace's)", async () => {
		await inRolledBackTransaction(pool, async (client) => {
			await actAs(client, ids.userAOwner);
			for (const table of ["Location", "Membership", "RewardSale", "RewardRedemption", "TenantApiKey"]) {
				expect(await count(client, table, ids.tenantB), table).toBe(0);
			}
		});
	});

	it("checks each verb on its own: terminal.read sees the tills but registers none; terminal.create registers one", async () => {
		await inRolledBackTransaction(pool, async (client) => {
			const register = `INSERT INTO public."TenantTerminal" (id, "tenantId", "locationId", "terminalId", label, "createdByUserId") VALUES ($1, $2, $3, $4, 'T', $5) RETURNING id`;
			await giveCashierRole(client, ["TERMINAL.READ"]);
			await actAs(client, ids.userACashier);
			expect(await count(client, "TenantTerminal")).toBeGreaterThan(0);
			// A till's view shows its key's state: terminal.read reads the bound key too.
			expect(await count(client, "TenantApiKey")).toBeGreaterThan(0);
			expect(await changed(client, register, [randomUUID(), ids.tenantA, ids.locationAKl, "T-READ-ONLY", ids.userACashier])).toBe(0);

			await giveCashierRole(client, ["TERMINAL.CREATE"]);
			await actAs(client, ids.userACashier);
			expect(await changed(client, register, [randomUUID(), ids.tenantA, ids.locationAKl, "T-CREATE", ids.userACashier])).toBe(1);
		});
	});

	it("lets api_key.delete revoke a key but not issue one, and api_key.create issue one but not revoke", async () => {
		await inRolledBackTransaction(pool, async (client) => {
			const issue = `INSERT INTO public."TenantApiKey" (id, "tenantId", "locationId", name, "keyHash", "keyPrefix", scope, "createdByUserId") VALUES ($1, $2, $3, 'K', $4, $5, 'POS', $6) RETURNING id`;
			const revoke = `UPDATE public."TenantApiKey" SET "revokedAt" = 1 WHERE id = $1`;
			await giveCashierRole(client, ["API_KEY.DELETE"]);
			await actAs(client, ids.userACashier);
			expect(await changed(client, issue, [randomUUID(), ids.tenantA, ids.locationAKl, randomUUID(), "kp-delete", ids.userACashier])).toBe(0);
			expect(await changed(client, revoke, [ids.apiKeyA])).toBe(1);

			await giveCashierRole(client, ["API_KEY.CREATE"]);
			await actAs(client, ids.userACashier);
			expect(await changed(client, issue, [randomUUID(), ids.tenantA, ids.locationAKl, randomUUID(), "kp-create", ids.userACashier])).toBe(1);
			expect(await changed(client, revoke, [ids.apiKeyA])).toBe(0);
		});
	});

	it("lets reward.create add a reward and read it back, and refuses reward.update the insert (the create route checks reward.create)", async () => {
		await inRolledBackTransaction(pool, async (client) => {
			const insert = `INSERT INTO public."Reward" (id, "tenantId", title, description, "rewardType", category, "quantityTotal", "quantityRemaining", "expiryDate")
				VALUES ($1, $2, 'Tightening test', 'Rolled back', 'DISCOUNT', 'food', 1, 1, 4102444800000) RETURNING id`;
			await giveCashierRole(client, ["REWARD.UPDATE"]);
			await actAs(client, ids.userACashier);
			expect(await changed(client, insert, [randomUUID(), ids.tenantA])).toBe(0);

			await giveCashierRole(client, ["REWARD.CREATE"]);
			await actAs(client, ids.userACashier);
			expect(await changed(client, insert, [randomUUID(), ids.tenantA])).toBe(1);
		});
	});

	it("honours a share of one reward (ADR 067): an EDIT share edits that reward and reads its stores, and nothing else", async () => {
		await inRolledBackTransaction(pool, async (client) => {
			const edit = `UPDATE public."Reward" SET title = title WHERE id = $1`;
			await giveCashierRole(client, []);
			await actAs(client, ids.userACashier);
			expect(await changed(client, edit, [ids.rewardA])).toBe(0);

			await arrange(client);
			await client.query(
				`INSERT INTO public."ResourceAcl" (id, "subjectType", "subjectId", action, "resourceType", "resourceId", effect, "tenantId", "membershipId", level)
				 VALUES ($1, 'MEMBERSHIP', $2, 'EDIT', 'REWARD', $3, 'ALLOW', $4, $2, 'EDIT')`,
				[randomUUID(), ids.membershipACashier, ids.rewardA, ids.tenantA],
			);
			await actAs(client, ids.userACashier);
			expect(await changed(client, edit, [ids.rewardA])).toBe(1);
			expect(await changed(client, edit, [ids.rewardADraft])).toBe(0);
			const scopes = await client.query(`SELECT 1 FROM public."RewardLocationScope" WHERE "rewardId" = $1`, [ids.rewardA]);
			expect(scopes.rowCount).toBeGreaterThan(0);
		});
	});

	it("protects a tenant's files by the feature using them: branding for every member, verification documents for kyb.read", async () => {
		await inRolledBackTransaction(pool, async (client) => {
			const kyb = await tenantFile(client, "MERCHANT_KYB");
			const logo = await tenantFile(client, "STORE_LOGO");
			const rewardImage = await tenantFile(client, "REWARD_IMAGE");

			await actAs(client, ids.userACashier);
			expect(await visibleFile(client, logo)).toBe(true);
			expect(await visibleFile(client, kyb)).toBe(false);
			// The Cashier template holds reward.read: reward images are theirs to see, not to change.
			expect(await visibleFile(client, rewardImage)).toBe(true);
			expect(await changed(client, `UPDATE public."StoredFile" SET "originalName" = 'x' WHERE id = $1`, [rewardImage])).toBe(0);
			expect(await changed(client, `UPDATE public."StoredFile" SET "originalName" = 'x' WHERE id = $1`, [logo])).toBe(0);

			await actAs(client, ids.userAOwner);
			expect(await visibleFile(client, kyb)).toBe(true);
			expect(await changed(client, `UPDATE public."StoredFile" SET "originalName" = 'x' WHERE id = $1`, [logo])).toBe(1);

			await giveCashierRole(client, ["KYB.READ"]);
			await actAs(client, ids.userACashier);
			expect(await visibleFile(client, kyb)).toBe(true);
			expect(await changed(client, `UPDATE public."StoredFile" SET "originalName" = 'x' WHERE id = $1`, [kyb])).toBe(0);
		});
	});

	it("lets a member append a tenant audit row only in their own name, and never change or delete one", async () => {
		await inRolledBackTransaction(pool, async (client) => {
			const append = `INSERT INTO public."TenantAuditLog" (id, "tenantId", "actorUserId", action, "resourceType", "resourceId") VALUES ($1, $2, $3, 'TEST', 'TEST', 'x') RETURNING id`;
			await actAs(client, ids.userACashier);
			expect(await changed(client, append, [randomUUID(), ids.tenantA, ids.userACashier])).toBe(1);
			expect(await changed(client, append, [randomUUID(), ids.tenantA, ids.userAOwner])).toBe(0);
			expect(await changed(client, `UPDATE public."TenantAuditLog" SET action = 'EDITED' WHERE "tenantId" = $1`, [ids.tenantA])).toBe(0);
			expect(await changed(client, `DELETE FROM public."TenantAuditLog" WHERE "tenantId" = $1`, [ids.tenantA])).toBe(0);
		});
	});

	it("shows the merchant another customer's sales only through analytics.read (a customer always sees their own bill)", async () => {
		await inRolledBackTransaction(pool, async (client) => {
			const saleId = randomUUID();
			await arrange(client);
			await client.query(
				`INSERT INTO public."RewardSale" (id, "tenantId", "locationId", "userId", "terminalId", "billTotalMinor", currency, "idempotencyKey", "requestHash", "paidAt")
				 VALUES ($1, $2, $3, $4, 'FIXTURE-A-KL', 1000, 'MYR', $5, 'tightening', 1)`,
				[saleId, ids.tenantA, ids.locationAKl, ids.userCustomerC, `tightening-${saleId}`],
			);
			const seesSale = async (): Promise<boolean> => (await client.query(`SELECT 1 FROM public."RewardSale" WHERE id = $1`, [saleId])).rowCount === 1;

			await actAs(client, ids.userAOwner);
			expect(await seesSale()).toBe(true);
			await giveCashierRole(client, []);
			await actAs(client, ids.userACashier);
			expect(await seesSale()).toBe(false);
			await giveCashierRole(client, ["ANALYTICS.READ"]);
			await actAs(client, ids.userACashier);
			expect(await seesSale()).toBe(true);
		});
	});
});

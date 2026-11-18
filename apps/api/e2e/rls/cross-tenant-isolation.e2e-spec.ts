// Nobody reads or changes another tenant's or another person's rows (ADRs 090, 092, 093), proved as the runtime role
// over EVERY table, not a hand-picked list: the tables are read from the database's own catalogue, so a table added
// tomorrow is covered the day it lands.
//
// The yardstick is a stranger: a signed-in user with no membership, no claim and no share. Whatever a stranger can
// read (the public marketplace, reference data) is public. Everything any other actor sees of rows that are not
// theirs must be no more than that — whatever their role, and even when the tenant context names a tenant they do not
// belong to (a forged or stale `app.current_tenant_id`). Every test runs in one transaction that is rolled back.
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

/** The tables the fixture always gives tenant B rows in: the sweep must have compared these, or it proved nothing. */
const TABLES_TENANT_B_ALWAYS_HAS: readonly string[] = ["Location", "Membership", "MembershipLocationScope", "Reward", "RewardSale", "RewardRedemption"];

/** Someone reading the database as the runtime role, acting as `userId` with `tenantContext` as the request's tenant. */
interface Actor {
	readonly label: string;
	readonly userId: string;
	readonly tenantContext: string;
	/** The tenant whose rows are the actor's own; `null` for an actor who owns no tenant's rows. */
	readonly homeTenant: string | null;
}

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

async function actAs(client: PoolClient, userId: string, tenantContext: string): Promise<void> {
	await client.query("RESET ROLE");
	await client.query("SET LOCAL ROLE app_runtime");
	await client.query("SELECT set_config('app.rls_bypass', 'false', true), set_config('app.current_tenant_id', $1, true), set_config('app.current_user_id', $2, true)", [
		tenantContext,
		userId,
	]);
}

async function arrange(client: PoolClient): Promise<void> {
	await client.query("RESET ROLE");
}

/** Rows a statement changed, or 0 when it was refused (the savepoint undoes the failure). */
async function changed(client: PoolClient, statement: string, params: readonly (string | number | null)[]): Promise<number> {
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

/** The base tables of `public` that have `column`, from the catalogue (as the superuser). */
async function tablesWithColumn(client: PoolClient, column: string): Promise<readonly string[]> {
	const result = await client.query<{ table: string }>(
		`SELECT c.table_name AS table FROM information_schema.columns c
		 JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
		 WHERE c.table_schema = 'public' AND c.column_name = $1 ORDER BY c.table_name`,
		[column],
	);
	return result.rows.map((row) => row.table);
}

/** The physical row ids (`ctid`, stable inside the transaction: these tests change nothing they read) `filter` selects. */
async function visibleRows(client: PoolClient, table: string, filter: string, params: readonly string[]): Promise<ReadonlySet<string>> {
	const result = await client.query<{ row: string }>(`SELECT ctid::text AS row FROM public."${table}" WHERE ${filter}`, [...params]);
	return new Set(result.rows.map((row) => row.row));
}

/** A signed-in user with no membership, claim or share: the yardstick for "public". Arranged as the superuser. */
async function createStranger(client: PoolClient): Promise<string> {
	await arrange(client);
	const id = randomUUID();
	await client.query(`INSERT INTO public."User" (id, "fullName", email, "passwordHash", "emailVerifiedAt") VALUES ($1, 'Stranger', $2, 'not-a-real-hash', 0)`, [
		id,
		`stranger-${id}@example.com`,
	]);
	return id;
}

/** A tenant context naming no tenant at all. */
function noTenantContext(): string {
	return randomUUID();
}

/**
 * For each table, the rows `actor` sees through `filter` that a stranger (with no tenant context) does not.
 * Returns one line per table with any such row; empty means the actor sees nothing beyond the public.
 */
async function rowsBeyondStranger(
	client: PoolClient,
	actor: Actor,
	stranger: string,
	tables: readonly string[],
	filter: string,
	params: readonly string[],
): Promise<readonly string[]> {
	const leaks: string[] = [];
	for (const table of tables) {
		await actAs(client, stranger, noTenantContext());
		const publicRows = await visibleRows(client, table, filter, params);
		await actAs(client, actor.userId, actor.tenantContext);
		const actorRows = await visibleRows(client, table, filter, params);
		const extra = [...actorRows].filter((row) => !publicRows.has(row));
		if (extra.length > 0) {
			leaks.push(`${actor.label} → ${table}: ${String(extra.length)} row(s) a stranger cannot see`);
		}
	}
	return leaks;
}

/** Every member of the fixture, in their own tenant's context and in one they do not belong to. */
function membersInOwnAndForgedContexts(): readonly Actor[] {
	const members: readonly { label: string; userId: string; homeTenant: string; foreignTenant: string }[] = [
		{ label: "A's Owner", userId: ids.userAOwner, homeTenant: ids.tenantA, foreignTenant: ids.tenantB },
		{ label: "A's KL Manager", userId: ids.userAKlManager, homeTenant: ids.tenantA, foreignTenant: ids.tenantB },
		{ label: "A's Cashier", userId: ids.userACashier, homeTenant: ids.tenantA, foreignTenant: ids.tenantB },
		{ label: "B's Owner", userId: ids.userBOwner, homeTenant: ids.tenantB, foreignTenant: ids.tenantA },
	];
	return members.flatMap((member) => [
		{ label: `${member.label} (own context)`, userId: member.userId, tenantContext: member.homeTenant, homeTenant: member.homeTenant },
		{ label: `${member.label} (forged context)`, userId: member.userId, tenantContext: member.foreignTenant, homeTenant: member.homeTenant },
	]);
}

describe("Cross-tenant and cross-user isolation over every table (RLS as app_runtime)", () => {
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

	it("compares real rows: tenant B has rows in the core tables and A's Owner sees A's own", async () => {
		await inRolledBackTransaction(pool, async (client) => {
			for (const table of TABLES_TENANT_B_ALWAYS_HAS) {
				const rows = await visibleRows(client, table, `"tenantId" = $1`, [ids.tenantB]);
				expect(rows.size, table).toBeGreaterThan(0);
			}
			await actAs(client, ids.userAOwner, ids.tenantA);
			expect((await visibleRows(client, "RewardSale", `"tenantId" = $1`, [ids.tenantA])).size).toBeGreaterThan(0);
		});
	});

	it("shows no member any other tenant's row beyond what a stranger sees, in their own context or a forged one", async () => {
		await inRolledBackTransaction(pool, async (client) => {
			const tenantTables = await tablesWithColumn(client, "tenantId");
			expect(tenantTables).toEqual(expect.arrayContaining([...TABLES_TENANT_B_ALWAYS_HAS]));
			const stranger = await createStranger(client);

			const leaks: string[] = [];
			for (const actor of membersInOwnAndForgedContexts()) {
				leaks.push(...(await rowsBeyondStranger(client, actor, stranger, tenantTables, `"tenantId" IS DISTINCT FROM $1`, [actor.homeTenant ?? noTenantContext()])));
			}
			expect(leaks).toStrictEqual([]);
		});
	});

	it("shows a suspended member and a customer nothing of any tenant beyond what a stranger sees", async () => {
		await inRolledBackTransaction(pool, async (client) => {
			const tenantTables = await tablesWithColumn(client, "tenantId");
			const stranger = await createStranger(client);
			const outsiders: readonly Actor[] = [
				{ label: "A's suspended member", userId: ids.userASuspended, tenantContext: ids.tenantA, homeTenant: null },
				{ label: "Customer C (in A's context)", userId: ids.userCustomerC, tenantContext: ids.tenantA, homeTenant: null },
			];
			// A customer's own rows (their claims, sales and redemptions) are theirs to see: compared without them.
			const notTheirs = (table: string, userTables: ReadonlySet<string>): string => (userTables.has(table) ? `"userId" IS DISTINCT FROM $1` : `$1::text IS NOT NULL`);
			const userTables = new Set(await tablesWithColumn(client, "userId"));

			const leaks: string[] = [];
			for (const outsider of outsiders) {
				for (const table of tenantTables) {
					leaks.push(...(await rowsBeyondStranger(client, outsider, stranger, [table], notTheirs(table, userTables), [outsider.userId])));
				}
			}
			expect(leaks).toStrictEqual([]);
		});
	});

	it("shows nobody another person's private rows (tables keyed by userId) beyond what a stranger sees", async () => {
		await inRolledBackTransaction(pool, async (client) => {
			const userTables = await tablesWithColumn(client, "userId");
			const tenantTables = new Set(await tablesWithColumn(client, "tenantId"));
			// Tenant-owned tables are the previous tests' (a merchant reads its own customers' sales); these are the person's own.
			const personalTables = userTables.filter((table) => !tenantTables.has(table));
			expect(personalTables.length).toBeGreaterThan(0);
			const stranger = await createStranger(client);
			const people: readonly Actor[] = [
				{ label: "Customer C", userId: ids.userCustomerC, tenantContext: noTenantContext(), homeTenant: null },
				{ label: "A's Owner", userId: ids.userAOwner, tenantContext: ids.tenantA, homeTenant: ids.tenantA },
				{ label: "A's Cashier", userId: ids.userACashier, tenantContext: ids.tenantA, homeTenant: ids.tenantA },
				{ label: "B's Owner", userId: ids.userBOwner, tenantContext: ids.tenantB, homeTenant: ids.tenantB },
			];

			// A merchant handles the claims on its own rewards (it redeems them at the till): those are compared apart, below.
			const ownRewardIds = async (tenantId: string | null): Promise<readonly string[]> => {
				await arrange(client);
				return tenantId === null ? [] : (await client.query<{ id: string }>(`SELECT id FROM public."Reward" WHERE "tenantId" = $1`, [tenantId])).rows.map((row) => row.id);
			};
			const notTheirs = (table: string): string =>
				table === "RewardClaim" ? `"userId" IS DISTINCT FROM $1 AND NOT ("rewardId" = ANY ($2::text[]))` : `"userId" IS DISTINCT FROM $1 AND $2::text[] IS NOT NULL`;

			const leaks: string[] = [];
			for (const person of people) {
				const rewards = await ownRewardIds(person.homeTenant);
				for (const table of personalTables) {
					leaks.push(...(await rowsBeyondStranger(client, person, stranger, [table], notTheirs(table), [person.userId, `{${rewards.join(",")}}`])));
				}
				leaks.push(...(await rowsBeyondStranger(client, person, stranger, ["User"], `id IS DISTINCT FROM $1`, [person.userId])));
			}
			expect(leaks).toStrictEqual([]);
		});
	});

	it("lets no member change or delete another tenant's row, or move their own rows into another tenant", async () => {
		await inRolledBackTransaction(pool, async (client) => {
			const tenantTables = await tablesWithColumn(client, "tenantId");
			const writes: string[] = [];
			for (const context of [ids.tenantA, ids.tenantB]) {
				await actAs(client, ids.userAOwner, context);
				for (const table of tenantTables) {
					const touch = await changed(client, `UPDATE public."${table}" SET "tenantId" = "tenantId" WHERE "tenantId" IS DISTINCT FROM $1`, [ids.tenantA]);
					const remove = await changed(client, `DELETE FROM public."${table}" WHERE "tenantId" IS DISTINCT FROM $1`, [ids.tenantA]);
					const move = await changed(client, `UPDATE public."${table}" SET "tenantId" = $2 WHERE "tenantId" = $1`, [ids.tenantA, ids.tenantB]);
					if (touch + remove + move > 0) {
						writes.push(`${table} (context ${context}): updated ${String(touch)}, deleted ${String(remove)}, moved ${String(move)}`);
					}
				}
			}
			expect(writes).toStrictEqual([]);
		});
	});

	it("lets nobody delete or rewrite a share or a referral — their own included — while they still read their own", async () => {
		await inRolledBackTransaction(pool, async (client) => {
			await arrange(client);
			const platformDeny = randomUUID();
			const shareToCashier = randomUUID();
			const code = randomUUID();
			const signup = randomUUID();
			const referral = randomUUID();
			// A platform-level DENY (no tenant): deleting it would widen someone's access.
			await client.query(
				`INSERT INTO public."ResourceAcl" (id, "subjectType", "subjectId", action, "resourceType", effect) VALUES ($1, 'USER', $2, 'READ', 'REWARD', 'DENY')`,
				[platformDeny, ids.userACashier],
			);
			await client.query(
				`INSERT INTO public."ResourceAcl" (id, "subjectType", "subjectId", action, "resourceType", "resourceId", effect, "tenantId", "membershipId", level)
				 VALUES ($1, 'MEMBERSHIP', $2, 'EDIT', 'REWARD', $3, 'ALLOW', $4, $2, 'EDIT')`,
				[shareToCashier, ids.membershipACashier, ids.rewardA, ids.tenantA],
			);
			await client.query(`INSERT INTO public."SignupReferralCode" (id, "userId", code, "expiresAt") VALUES ($1, $2, $3, 4102444800000)`, [
				code,
				ids.userCustomerC,
				code.slice(0, 8),
			]);
			await client.query(`INSERT INTO public."SignupReferral" (id, "referrerUserId", "refereeUserId", "referralCodeId") VALUES ($1, $2, $3, $4)`, [
				signup,
				ids.userCustomerC,
				ids.userBOwner,
				code,
			]);
			await client.query(`INSERT INTO public."RewardReferral" (id, "referrerUserId", "rewardId", "attributionToken") VALUES ($1, $2, $3, $4)`, [
				referral,
				ids.userCustomerC,
				ids.rewardA,
				`isolation-${referral}`,
			]);

			const rows: readonly { readonly table: string; readonly id: string; readonly owner: string; readonly context: string }[] = [
				{ table: "ResourceAcl", id: platformDeny, owner: ids.userACashier, context: ids.tenantA },
				{ table: "ResourceAcl", id: shareToCashier, owner: ids.userACashier, context: ids.tenantA },
				{ table: "SignupReferralCode", id: code, owner: ids.userCustomerC, context: noTenantContext() },
				{ table: "SignupReferral", id: signup, owner: ids.userCustomerC, context: noTenantContext() },
				{ table: "RewardReferral", id: referral, owner: ids.userCustomerC, context: noTenantContext() },
			];
			const stranger = await createStranger(client);
			for (const row of rows) {
				for (const [who, userId] of [
					["its owner", row.owner],
					["A's Owner", ids.userAOwner],
					["a stranger", stranger],
				] satisfies [string, string][]) {
					await actAs(client, userId, row.context);
					const label = `${row.table} ${row.id} by ${who}`;
					expect(await changed(client, `DELETE FROM public."${row.table}" WHERE id = $1`, [row.id]), `delete ${label}`).toBe(0);
					expect(await changed(client, `UPDATE public."${row.table}" SET "updatedAt" = "updatedAt" WHERE id = $1`, [row.id]), `update ${label}`).toBe(0);
				}
				// Reading stays as it was: the owner still sees the row (it was refused, not lost).
				await actAs(client, row.owner, row.context);
				expect((await client.query(`SELECT 1 FROM public."${row.table}" WHERE id = $1`, [row.id])).rowCount, `${row.table} still readable by its owner`).toBe(1);
			}
		});
	});

	it("refuses a member's insert into another tenant, while the same statement into their own tenant succeeds", async () => {
		await inRolledBackTransaction(pool, async (client) => {
			const inserts: readonly {
				readonly table: string;
				readonly statement: string;
				readonly own: readonly (string | null)[];
				readonly foreign: readonly (string | null)[];
			}[] = [
				{
					table: "Reward",
					statement: `INSERT INTO public."Reward" (id, "tenantId", title, description, "rewardType", category, "quantityTotal", "quantityRemaining", "expiryDate")
						VALUES ($1, $2, 'Isolation test', 'Rolled back', 'DISCOUNT', 'food', 1, 1, 4102444800000)`,
					own: [randomUUID(), ids.tenantA],
					foreign: [randomUUID(), ids.tenantB],
				},
				{
					table: "RewardLocationScope",
					statement: `INSERT INTO public."RewardLocationScope" (id, "tenantId", "rewardId", "locationId") VALUES ($1, $2, $3, $4)`,
					own: [randomUUID(), ids.tenantA, ids.rewardADraft, ids.locationAMalacca],
					foreign: [randomUUID(), ids.tenantB, ids.rewardBDraft, ids.locationBJb],
				},
				{
					table: "RewardAudienceMember",
					statement: `INSERT INTO public."RewardAudienceMember" (id, "tenantId", "rewardId", "userId") VALUES ($1, $2, $3, $4)`,
					own: [randomUUID(), ids.tenantA, ids.rewardADraft, ids.userCustomerC],
					foreign: [randomUUID(), ids.tenantB, ids.rewardBDraft, ids.userCustomerC],
				},
				{
					table: "TenantApiKey",
					statement: `INSERT INTO public."TenantApiKey" (id, "tenantId", "locationId", name, "keyHash", "keyPrefix", scope, "createdByUserId") VALUES ($1, $2, $3, 'K', $4, $5, 'POS', $6)`,
					own: [randomUUID(), ids.tenantA, ids.locationAKl, randomUUID(), "kp-iso-own", ids.userAOwner],
					foreign: [randomUUID(), ids.tenantB, ids.locationBJb, randomUUID(), "kp-iso-foreign", ids.userAOwner],
				},
				{
					table: "TenantTerminal",
					statement: `INSERT INTO public."TenantTerminal" (id, "tenantId", "locationId", "terminalId", label, "createdByUserId") VALUES ($1, $2, $3, $4, 'T', $5)`,
					own: [randomUUID(), ids.tenantA, ids.locationAKl, "T-ISO-OWN", ids.userAOwner],
					foreign: [randomUUID(), ids.tenantB, ids.locationBJb, "T-ISO-FOREIGN", ids.userAOwner],
				},
				{
					table: "WebhookEndpoint",
					statement: `INSERT INTO public."WebhookEndpoint" (id, "tenantId", url, "eventTypes", "secretCiphertext", "secretHint", "createdByUserId")
						VALUES ($1, $2, 'https://example.com/hook', ARRAY['reward.redeemed']::varchar[], 'ciphertext', 'abcd', $3)`,
					own: [randomUUID(), ids.tenantA, ids.userAOwner],
					foreign: [randomUUID(), ids.tenantB, ids.userAOwner],
				},
				{
					table: "TenantAuditLog",
					statement: `INSERT INTO public."TenantAuditLog" (id, "tenantId", "actorUserId", action, "resourceType", "resourceId") VALUES ($1, $2, $3, 'TEST', 'TEST', 'x')`,
					own: [randomUUID(), ids.tenantA, ids.userAOwner],
					foreign: [randomUUID(), ids.tenantB, ids.userAOwner],
				},
			];
			for (const context of [ids.tenantA, ids.tenantB]) {
				for (const insert of inserts) {
					await actAs(client, ids.userAOwner, context);
					expect(await changed(client, insert.statement, [...insert.foreign]), `${insert.table} into tenant B (context ${context})`).toBe(0);
				}
			}
			for (const insert of inserts) {
				await actAs(client, ids.userAOwner, ids.tenantA);
				expect(await changed(client, insert.statement, [...insert.own]), `${insert.table} into tenant A (the control)`).toBe(1);
			}
		});
	});

	it("keeps a store-scoped member to their own store's rows (app_permitted_stores in a policy)", async () => {
		await inRolledBackTransaction(pool, async (client) => {
			const sale = async (locationId: string, terminalId: string): Promise<string> => {
				const id = randomUUID();
				await client.query(
					`INSERT INTO public."RewardSale" (id, "tenantId", "locationId", "userId", "terminalId", "billTotalMinor", currency, "idempotencyKey", "requestHash", "paidAt")
					 VALUES ($1, $2, $3, $4, $5, 1000, 'MYR', $6, 'isolation', 1)`,
					[id, ids.tenantA, locationId, ids.userCustomerC, terminalId, `isolation-${id}`],
				);
				return id;
			};
			await arrange(client);
			const klSale = await sale(ids.locationAKl, "ISO-KL");
			const malaccaSale = await sale(ids.locationAMalacca, "ISO-MLK");
			const sees = async (saleId: string): Promise<boolean> => (await client.query(`SELECT 1 FROM public."RewardSale" WHERE id = $1`, [saleId])).rowCount === 1;

			await actAs(client, ids.userAOwner, ids.tenantA);
			expect(await sees(klSale)).toBe(true);
			expect(await sees(malaccaSale)).toBe(true);

			await actAs(client, ids.userAKlManager, ids.tenantA);
			expect(await sees(klSale)).toBe(true);
			expect(await sees(malaccaSale)).toBe(false);
		});
	});
});

describe("app_permitted_tenants / app_permitted_stores answer only for the actor's own active memberships", () => {
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

	/** Every tenant and store key the functions return for `actor`, over every permission in the catalogue. */
	async function permittedKeys(client: PoolClient, actor: Actor): Promise<{ readonly tenants: ReadonlySet<string>; readonly stores: ReadonlySet<string> }> {
		await arrange(client);
		const pairs = await client.query<{ resource: string; action: string }>(
			`SELECT DISTINCT resource::text AS resource, action::text AS action FROM public."Permission" WHERE "isDeleted" = false`,
		);
		const resources = pairs.rows.map((pair) => pair.resource);
		const actions = pairs.rows.map((pair) => pair.action);
		expect(resources.length).toBeGreaterThan(0);
		await actAs(client, actor.userId, actor.tenantContext);
		const result = await client.query<{ tenants: string[] | null; stores: string[] | null }>(
			`SELECT app_permitted_tenants(r, a) AS tenants, app_permitted_stores(r, a) AS stores FROM unnest($1::text[], $2::text[]) AS pair(r, a)`,
			[resources, actions],
		);
		return {
			tenants: new Set(result.rows.flatMap((row) => row.tenants ?? [])),
			stores: new Set(result.rows.flatMap((row) => row.stores ?? [])),
		};
	}

	it("gives an all-stores owner exactly their tenant and its every-store key in its context, and nothing in another's", async () => {
		await inRolledBackTransaction(pool, async (client) => {
			const own = await permittedKeys(client, { label: "A's Owner", userId: ids.userAOwner, tenantContext: ids.tenantA, homeTenant: ids.tenantA });
			expect([...own.tenants]).toStrictEqual([ids.tenantA]);
			expect([...own.stores]).toStrictEqual([`${ids.tenantA}|*`]);
			// A tenant route bound to a tenant they are not a member of (forged, stale) or to none that exists: fail closed.
			for (const context of [ids.tenantB, noTenantContext()]) {
				const forged = await permittedKeys(client, { label: "A's Owner", userId: ids.userAOwner, tenantContext: context, homeTenant: ids.tenantA });
				expect(forged.tenants.size, context).toBe(0);
				expect(forged.stores.size, context).toBe(0);
			}
		});
	});

	it("gives a store-scoped member only their own store's key, never every store's or another tenant's", async () => {
		await inRolledBackTransaction(pool, async (client) => {
			for (const userId of [ids.userAKlManager, ids.userACashier]) {
				const keys = await permittedKeys(client, { label: "store-scoped", userId, tenantContext: ids.tenantA, homeTenant: ids.tenantA });
				expect([...keys.stores], userId).toStrictEqual([`${ids.tenantA}|${ids.locationAKl}`]);
				expect(
					[...keys.tenants].every((tenant) => tenant === ids.tenantA),
					userId,
				).toBe(true);
			}
		});
	});

	it("gives a stranger, a customer and a suspended member nothing at all", async () => {
		await inRolledBackTransaction(pool, async (client) => {
			const stranger = await createStranger(client);
			for (const userId of [stranger, ids.userCustomerC, ids.userASuspended]) {
				const keys = await permittedKeys(client, { label: "outsider", userId, tenantContext: ids.tenantA, homeTenant: null });
				expect(keys.tenants.size, userId).toBe(0);
				expect(keys.stores.size, userId).toBe(0);
			}
		});
	});

	it("stops answering for a membership the moment it is soft-deleted", async () => {
		await inRolledBackTransaction(pool, async (client) => {
			const before = await permittedKeys(client, { label: "Cashier", userId: ids.userACashier, tenantContext: ids.tenantA, homeTenant: ids.tenantA });
			expect(before.stores.size).toBeGreaterThan(0);
			await arrange(client);
			await client.query(`UPDATE public."Membership" SET "isDeleted" = true, "deletedAt" = 1 WHERE id = $1`, [ids.membershipACashier]);
			const after = await permittedKeys(client, { label: "Cashier", userId: ids.userACashier, tenantContext: ids.tenantA, homeTenant: ids.tenantA });
			expect(after.tenants.size).toBe(0);
			expect(after.stores.size).toBe(0);
		});
	});

	it("never reuses one actor's answer for the next on the same connection, even through a cached generic plan", async () => {
		await inRolledBackTransaction(pool, async (client) => {
			const stranger = await createStranger(client);
			// Force the generic plan a pooled connection reuses for a prepared statement: the InitPlan must be re-run per execution.
			await client.query("SET LOCAL plan_cache_mode = force_generic_plan");
			const sales = async (): Promise<number> => {
				const result = await client.query<{ count: number }>({
					name: "isolation-tenant-a-sales",
					text: `SELECT count(*)::int AS count FROM public."RewardSale" WHERE "tenantId" = $1 AND "userId" IS DISTINCT FROM $2`,
					values: [ids.tenantA, stranger],
				});
				return result.rows[LIST_SLOT_INDEX.first]?.count ?? 0;
			};
			await actAs(client, ids.userAOwner, ids.tenantA);
			const ownerSees = await sales();
			expect(ownerSees).toBeGreaterThan(0);
			await actAs(client, stranger, ids.tenantA);
			expect(await sales()).toBe(0);
			await actAs(client, ids.userBOwner, ids.tenantA);
			expect(await sales()).toBe(0);
			await actAs(client, ids.userAOwner, ids.tenantA);
			expect(await sales()).toBe(ownerSees);
		});
	});
});

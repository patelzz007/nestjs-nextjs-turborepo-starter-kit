import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	API_VERSION_PREFIX,
	ApiErrorResponseSchema,
	LIST_SLOT_INDEX,
	OkResponseSchema,
	TenantGrantResponseSchema,
	TenantMemberAccessResponseSchema,
	TenantRoleHoldersSchema,
	TenantRoleResponseSchema,
	TenantShareResponseSchema,
	type TenantRoleResponse,
} from "@workspace/shared";
import { z } from "zod";

import { REWARD_SEED_IDS } from "../prisma/seed/rewards";
import { TENANT_SEED_IDS, TENANT_SEED_SLUGS } from "../prisma/seed/tenants";
import { createE2eApp, login, mutationHeaders, parseSuccessEnvelope, type InjectResponse, type LoginResult } from "./e2e-helpers";

/**
 * ADR 067, end to end — the API routes a tenant administers its own access with, and the same rules
 * enforced again by Postgres (RLS as `app_runtime`). Seeded KL tenant: OWNER `brew.owner@…`, CASHIER
 * `brew.cashier@…`, whom the development seed gives a 48-hour analytics grant, a permanent
 * customer-ban grant at the KL store, a lapsed grant, and the pending reward shared to edit.
 */
const DATABASE_URL: string = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/monorepo";
const HOUR_MS = 3_600_000;

describe("Tenant access administration (e2e)", () => {
	let app: NestFastifyApplication;
	let owner: LoginResult;
	let cashier: LoginResult;

	beforeAll(async () => {
		app = await createE2eApp();
		owner = await login(app, "brew.owner@kl-rewards.demo", "BrewOwner@123", "merchant");
		cashier = await login(app, "brew.cashier@kl-rewards.demo", "BrewCashier@123", "merchant");
	});

	afterAll(async () => {
		await app.close();
	});

	function headers(session: LoginResult): Record<string, string> {
		return { cookie: `merchantAccessToken=${session.accessToken}; merchantRefreshToken=${session.refreshToken}`, "x-client-type": "merchant" };
	}

	const path = (route: string, slug: string = TENANT_SEED_SLUGS.kl): string => `${API_VERSION_PREFIX}/tenants/${slug}/access${route}`;

	function send(session: LoginResult, method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", route: string, payload?: object): Promise<InjectResponse> {
		const base = headers(session);
		return app.inject({ method, url: path(route), headers: method === "GET" ? base : mutationHeaders(base), ...(payload === undefined ? {} : { payload }) });
	}

	function errorOf(response: InjectResponse): z.output<typeof ApiErrorResponseSchema>["error"] {
		return ApiErrorResponseSchema.parse(response.json()).error;
	}

	async function roles(): Promise<readonly TenantRoleResponse[]> {
		return parseSuccessEnvelope(await send(owner, "GET", "/roles"), z.array(TenantRoleResponseSchema)).data;
	}

	async function templateRoleId(template: "OWNER" | "MANAGER" | "CASHIER"): Promise<string> {
		return (await roles()).find((role) => role.templateKey === template)?.id ?? "";
	}

	describe("roles: add and remove permissions (requirement 5)", () => {
		it("lists the tenant's own Owner, Manager and Cashier for the owner, and refuses the cashier", async () => {
			const listed = await roles();
			expect(listed.map((role) => role.templateKey)).toEqual(expect.arrayContaining(["OWNER", "MANAGER", "CASHIER"]));

			const refused = await send(cashier, "GET", "/roles");
			expect(refused.statusCode).toBe(403);
		});

		it("creates a role, adds and removes a permission, and never edits the Owner role", async () => {
			const created = await send(owner, "POST", "/roles", { name: `Floor lead ${String(Date.now())}`, permissions: [{ action: "READ", resource: "REWARD" }] });
			expect(created.statusCode, created.body).toBe(201);
			const role = parseSuccessEnvelope(created, TenantRoleResponseSchema).data;

			const added = await send(owner, "PATCH", `/roles/${role.id}`, { permissions: [...role.permissions, { action: "READ", resource: "ANALYTICS" }] });
			expect(parseSuccessEnvelope(added, TenantRoleResponseSchema).data.permissions).toHaveLength(2);
			const removed = await send(owner, "PATCH", `/roles/${role.id}`, { permissions: [{ action: "READ", resource: "ANALYTICS" }] });
			expect(parseSuccessEnvelope(removed, TenantRoleResponseSchema).data.permissions).toEqual([{ action: "READ", resource: "ANALYTICS" }]);

			const ownerEdit = await send(owner, "PATCH", `/roles/${await templateRoleId("OWNER")}`, { name: "Boss" });
			expect(ownerEdit.statusCode).toBe(409);
			expect(errorOf(ownerEdit).code).toBe("TENANT_OWNER_PROTECTED");

			const platformPermission = await send(owner, "POST", "/roles", { name: `Ops ${String(Date.now())}`, permissions: [{ action: "UPDATE", resource: "SYSTEM_SETTINGS" }] });
			expect(errorOf(platformPermission).code).toBe("TENANT_SCOPE_ESCALATION");

			expect((await send(owner, "DELETE", `/roles/${role.id}`)).statusCode).toBe(200);
		});

		it("refuses to delete a role members hold (409 with the holders), then reassigns them in one step", async () => {
			const role = parseSuccessEnvelope(await send(owner, "POST", "/roles", { name: `Temp ${String(Date.now())}`, permissions: [] }), TenantRoleResponseSchema).data;
			expect((await send(owner, "PUT", `/members/${TENANT_SEED_IDS.klCashierMembership}/role`, { roleId: role.id })).statusCode).toBe(200);

			const refused = await send(owner, "DELETE", `/roles/${role.id}`);
			expect(refused.statusCode).toBe(409);
			expect(errorOf(refused).details).toMatchObject({ holderCount: 1 });

			const { holdersVersion } = parseSuccessEnvelope(await send(owner, "GET", `/roles/${role.id}/holders`), TenantRoleHoldersSchema).data;
			const stale = await send(owner, "POST", `/roles/${role.id}/reassign`, {
				holdersVersion: "stale",
				assignments: [{ membershipId: TENANT_SEED_IDS.klCashierMembership, roleId: await templateRoleId("CASHIER") }],
			});
			expect(stale.statusCode).toBe(409);
			const reassigned = await send(owner, "POST", `/roles/${role.id}/reassign`, {
				holdersVersion,
				assignments: [{ membershipId: TENANT_SEED_IDS.klCashierMembership, roleId: await templateRoleId("CASHIER") }],
			});
			expect(parseSuccessEnvelope(reassigned, OkResponseSchema).data.ok).toBe(true);
			expect((await send(owner, "DELETE", `/roles/${role.id}`)).statusCode).toBe(200);
		});

		it("resets a changed role to its template (the tenant's copy, ADR 067)", async () => {
			const managerRoleId = await templateRoleId("MANAGER");
			const before = (await roles()).find((role) => role.id === managerRoleId)?.permissions.length ?? 0;

			const narrowed = await send(owner, "PATCH", `/roles/${managerRoleId}`, { permissions: [{ action: "READ", resource: "REWARD" }] });
			expect(parseSuccessEnvelope(narrowed, TenantRoleResponseSchema).data.permissions).toHaveLength(1);
			const reset = await send(owner, "POST", `/roles/${managerRoleId}/reset`);

			expect(reset.statusCode, reset.body).toBe(201);
			expect(parseSuccessEnvelope(reset, TenantRoleResponseSchema).data.permissions).toHaveLength(before);
		});

		it("shows one member's access with their name and role (the account is read for the tenant, users RLS is self-only)", async () => {
			const response = await send(owner, "GET", `/members/${TENANT_SEED_IDS.klCashierMembership}`);

			expect(parseSuccessEnvelope(response, TenantMemberAccessResponseSchema).data).toMatchObject({ email: "brew.cashier@kl-rewards.demo", templateKey: "CASHIER" });
		});

		it("keeps the last Owner on the Owner role", async () => {
			const demote = await send(owner, "PUT", `/members/${TENANT_SEED_IDS.klOwnerMembership}/role`, { roleId: await templateRoleId("MANAGER") });

			expect(demote.statusCode).toBe(403);
			expect(errorOf(demote).code).toBe("TENANT_OWNER_REQUIRED");
		});
	});

	describe("grants: temporary or permanent, on top of the role (requirement 4)", () => {
		it("grants the cashier a permission for 48 hours, lists it, and takes it back", async () => {
			const granted = await send(owner, "POST", `/members/${TENANT_SEED_IDS.klCashierMembership}/grants`, {
				permission: { action: "READ", resource: "CUSTOMER_BAN" },
				expiresAt: Date.now() + 48 * HOUR_MS,
			});
			expect(granted.statusCode, granted.body).toBe(201);
			const grant = parseSuccessEnvelope(granted, TenantGrantResponseSchema).data;
			expect(grant).toMatchObject({ grantedVia: "Owner", locationId: null });

			const listed = parseSuccessEnvelope(await send(owner, "GET", `/members/${TENANT_SEED_IDS.klCashierMembership}/grants`), z.array(TenantGrantResponseSchema)).data;
			expect(listed.map((row) => row.id)).toContain(grant.id);
			// Only grants in force: the seed's lapsed grant (member.read, ended 6 hours ago) is not listed.
			expect(listed.some((row) => row.permission.resource === "MEMBER")).toBe(false);

			expect((await send(owner, "DELETE", `/grants/${grant.id}`)).statusCode).toBe(200);
		});

		it("lets the cashier neither grant nor give what their role does not give", async () => {
			const byCashier = await send(cashier, "POST", `/members/${TENANT_SEED_IDS.klOwnerMembership}/grants`, { permission: { action: "READ", resource: "REWARD" } });
			expect(byCashier.statusCode).toBe(403);
		});
	});

	describe("shares: one record with one member", () => {
		it("shares a reward with the cashier to view and stops sharing it", async () => {
			const shared = await send(owner, "POST", "/shares", {
				resource: "REWARD",
				resourceId: REWARD_SEED_IDS.klRewardPublished,
				membershipId: TENANT_SEED_IDS.klCashierMembership,
				level: "VIEW",
			});
			expect(shared.statusCode, shared.body).toBe(201);
			const share = parseSuccessEnvelope(shared, TenantShareResponseSchema).data;

			expect((await send(owner, "DELETE", `/shares/${share.id}`)).statusCode).toBe(200);
		});

		it("never shares another tenant's record", async () => {
			const foreign = await send(owner, "POST", "/shares", {
				resource: "REWARD",
				resourceId: REWARD_SEED_IDS.mlkRewardDisabled,
				membershipId: TENANT_SEED_IDS.klCashierMembership,
				level: "VIEW",
			});

			expect(foreign.statusCode).toBe(404);
		});
	});

	describe("tenant isolation (requirement 1)", () => {
		it("denies the KL owner administering the MLK tenant", async () => {
			const response = await app.inject({ method: "GET", url: path("/roles", TENANT_SEED_SLUGS.mlk), headers: headers(owner) });

			expect(response.statusCode).toBe(403);
		});
	});
});

interface RlsSession {
	readonly userId: string;
	readonly tenantId: string;
}

/** Runs `run` as `app_runtime` for one user and tenant, with no system-operation bypass. */
async function asRuntime<TResult>(pool: Pool, session: RlsSession, run: (client: PoolClient) => Promise<TResult>): Promise<TResult> {
	const client = await pool.connect();
	try {
		await client.query("SET ROLE app_runtime");
		await client.query("SELECT set_config('app.current_user_id', $1, false)", [session.userId]);
		await client.query("SELECT set_config('app.rls_bypass', 'false', false)");
		await client.query("SELECT set_config('app.current_tenant_id', $1, false)", [session.tenantId]);
		return await run(client);
	} finally {
		await client.query("DISCARD ALL");
		client.release();
	}
}

async function one(client: PoolClient, sql: string, params: readonly (string | null)[]): Promise<boolean> {
	const result = await client.query<{ allowed: boolean }>(sql, [...params]);
	return result.rows[LIST_SLOT_INDEX.first]?.allowed === true;
}

describe("The access model in Postgres (RLS as app_runtime, ADR 067)", () => {
	let pool: Pool;
	let cashierUserId: string;

	beforeAll(async () => {
		pool = new Pool({ connectionString: DATABASE_URL });
		const result = await pool.query<{ userId: string }>(`SELECT "userId" FROM public."Membership" WHERE id = $1`, [TENANT_SEED_IDS.klCashierMembership]);
		cashierUserId = result.rows[LIST_SLOT_INDEX.first]?.userId ?? "";
	});

	afterAll(async () => {
		await pool.end();
	});

	const cashierInKl = (): RlsSession => ({ userId: cashierUserId, tenantId: TENANT_SEED_IDS.klTenant });
	const has =
		(resource: string, action: string, store: string | null): ((client: PoolClient) => Promise<boolean>) =>
		(client) =>
			one(client, "SELECT app_has_permission($1, $2, $3, $4) AS allowed", [resource, action, TENANT_SEED_IDS.klTenant, store]);

	it("gives the cashier their role's permissions, their live grants, and nothing else", async () => {
		await asRuntime(pool, cashierInKl(), async (client) => {
			expect(await has("REWARD", "READ", null)(client)).toBe(true);
			// The seeded 48-hour grant.
			expect(await has("ANALYTICS", "READ", null)(client)).toBe(true);
			// The seeded grant that already lapsed, and a permission nobody gave.
			expect(await has("MEMBER", "READ", null)(client)).toBe(false);
			expect(await has("KYB", "UPDATE", null)(client)).toBe(false);
		});
	});

	it("limits a store grant to that store, never a tenant-level record (grant ∩ membership)", async () => {
		await asRuntime(pool, cashierInKl(), async (client) => {
			expect(await has("CUSTOMER_BAN", "CREATE", TENANT_SEED_IDS.klLocation)(client)).toBe(true);
			expect(await has("CUSTOMER_BAN", "CREATE", null)(client)).toBe(false);
			expect(await has("CUSTOMER_BAN", "CREATE", TENANT_SEED_IDS.mlkLocationKatil)(client)).toBe(false);
		});
	});

	it("shares exactly one record, at its level (EDIT includes VIEW)", async () => {
		await asRuntime(pool, cashierInKl(), async (client) => {
			const shared = (id: string, level: string): Promise<boolean> => one(client, "SELECT app_shared('REWARD', $1, $2) AS allowed", [id, level]);
			expect(await shared(REWARD_SEED_IDS.klRewardPending, "EDIT")).toBe(true);
			expect(await shared(REWARD_SEED_IDS.klRewardPending, "VIEW")).toBe(true);
			expect(await shared(REWARD_SEED_IDS.klRewardPublished, "VIEW")).toBe(false);
		});
	});

	it("never carries a member's standing into another tenant (requirement 1)", async () => {
		await asRuntime(pool, { userId: cashierUserId, tenantId: TENANT_SEED_IDS.mlkTenant }, async (client) => {
			expect(await has("REWARD", "READ", null)(client)).toBe(false);
		});
	});

	it("shows a tenant's own roles to its members only, beside the platform catalogue", async () => {
		await asRuntime(pool, cashierInKl(), async (client) => {
			const tenants = await client.query<{ tenantId: string | null }>(`SELECT DISTINCT "tenantId" FROM public."Role"`);
			const visible = tenants.rows.map((row) => row.tenantId);
			expect(visible).toContain(TENANT_SEED_IDS.klTenant);
			expect(visible).toContain(null);
			expect(visible).not.toContain(TENANT_SEED_IDS.mlkTenant);
		});
	});

	it("shows the cashier the shares made to them, not everyone's (no member.read)", async () => {
		await asRuntime(pool, cashierInKl(), async (client) => {
			const rows = await client.query<{ membershipId: string | null }>(`SELECT "membershipId" FROM public."ResourceAcl" WHERE "tenantId" = $1`, [TENANT_SEED_IDS.klTenant]);
			expect(rows.rows.every((row) => row.membershipId === TENANT_SEED_IDS.klCashierMembership)).toBe(true);
		});
	});

	it("keeps each customer's claims their own (requirement 3)", async () => {
		// A customer: holds claims, belongs to no tenant (so no merchant claim.read applies).
		const customer = await pool.query<{ userId: string }>(
			`SELECT c."userId" FROM public."RewardClaim" c WHERE NOT EXISTS (SELECT 1 FROM public."Membership" m WHERE m."userId" = c."userId") LIMIT 1`,
		);
		const customerId = customer.rows[LIST_SLOT_INDEX.first]?.userId ?? "";

		await asRuntime(pool, { userId: customerId, tenantId: "" }, async (client) => {
			const counts = await client.query<{ own: number; others: number }>(
				`SELECT COUNT(*) FILTER (WHERE "userId" = $1)::int AS own, COUNT(*) FILTER (WHERE "userId" <> $1)::int AS others FROM public."RewardClaim"`,
				[customerId],
			);
			expect(counts.rows[LIST_SLOT_INDEX.first]).toMatchObject({ others: 0 });
			expect(counts.rows[LIST_SLOT_INDEX.first]?.own).toBeGreaterThan(0);
		});
	});
});

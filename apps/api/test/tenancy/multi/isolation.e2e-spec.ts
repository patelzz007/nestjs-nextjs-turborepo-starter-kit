import { ForbiddenException } from "@nestjs/common";
import { Pool, type PoolClient } from "pg";
import { LIST_SLOT_INDEX, RewardListQuerySchema } from "@workspace/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { NotFoundError } from "../../../src/platform/application/errors/app-error";
import type { ActorContext } from "../../../src/platform/application/actor-context";
import type { MerchantAccessGrant } from "../../../src/platform/application/ports/authorization.port";
import { RequestContextService } from "../../../src/platform/infrastructure/context/request-context";
import { RouteTenantSource } from "../../../src/platform/infrastructure/tenancy/route-tenant.source";
import { PrismaTenantRouteLookup } from "../../../src/platform/infrastructure/tenancy/prisma-tenant-route.lookup";
import { PrismaService } from "../../../src/prisma/prisma.service";
import { TenantTransactionService } from "../../../src/prisma/tenant-transaction.service";
import { getApiConfig } from "../../../src/config/api-config";
import { TypedConfigService } from "../../../src/config/typed-config.service";
import { RewardNotFoundError } from "../../../src/contexts/rewards/domain/errors/reward.errors";
import { GetTenantRewardHandler } from "../../../src/contexts/rewards/application/queries/get-tenant-reward/get-tenant-reward.handler";
import { GetTenantRewardQuery } from "../../../src/contexts/rewards/application/queries/get-tenant-reward/get-tenant-reward.query";
import { PrismaRewardReadRepository } from "../../../src/contexts/rewards/infrastructure/persistence/prisma-reward.read-repository";
import { buildMarketplaceWhere, MARKETPLACE_REWARD_SELECT } from "../../../src/contexts/rewards/infrastructure/persistence/reward-list-queries";
import { RewardsReadSession } from "../../../src/contexts/rewards/infrastructure/persistence/rewards-read-session";
import { TenantDisplayAdapter } from "../../../src/contexts/rewards/infrastructure/adapters/tenant-display.adapter";
import type { TenantDisplayData } from "../../../src/contexts/tenancy/application/ports/tenant-read.port";
import type { CedarAuthorizationDecision } from "@workspace/shared";
import { TenantContextService } from "../../../src/contexts/tenancy/infrastructure/adapters/tenant-context.service";
import { TenantAuditService } from "../../../src/contexts/tenancy/infrastructure/audit/tenant-audit.adapter";
import { createTestPublicUrls } from "../../support/public-urls";
import { decideTenantLifecycle } from "../../../src/contexts/tenancy/domain/policies/tenant-lifecycle.policy";
import { seedTwoTenantFixture, TWO_TENANT_FIXTURE } from "../../support/two-tenant-fixture";

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

async function withApiKey(pool: Pool, tenantId: string, apiKeyId: string, locationId: string, run: (client: PoolClient) => Promise<void>): Promise<void> {
	const client = await pool.connect();
	try {
		await client.query("SET ROLE app_runtime");
		await client.query("SELECT set_config('app.rls_bypass', 'false', false)");
		await client.query("SELECT set_config('app.current_tenant_id', $1, false)", [tenantId]);
		await client.query("SELECT set_config('app.current_user_id', '', false)");
		await client.query("SELECT set_config('app.current_api_key_id', $1, false)", [apiKeyId]);
		await client.query("SELECT set_config('app.current_api_key_location_id', $1, false)", [locationId]);
		await run(client);
	} finally {
		await client.query("DISCARD ALL");
		client.release();
	}
}

describe("tenancy multi isolation", () => {
	const prisma = new PrismaService(new TypedConfigService(getApiConfig()));
	const transactions = new TenantTransactionService(prisma, new RequestContextService());
	const routes = new RouteTenantSource(new PrismaTenantRouteLookup(transactions));
	const pool = new Pool({ connectionString: process.env.DATABASE_URL });

	beforeAll(async () => {
		await prisma.ensureConnected();
		await seedTwoTenantFixture(prisma);
	});

	afterAll(async () => {
		await pool.end();
		await prisma.$disconnect();
	});

	it("MT-001: a member reads their own tenant and not the other", async () => {
		const ids = TWO_TENANT_FIXTURE;
		await withTenant(pool, ids.tenantA, ids.userAOwner, async (client) => {
			const own = await client.query<{ id: string }>(`SELECT id FROM public."Tenant" WHERE id = $1`, [ids.tenantA]);
			const other = await client.query<{ id: string }>(`SELECT id FROM public."Tenant" WHERE id = $1`, [ids.tenantB]);
			expect(own.rows[LIST_SLOT_INDEX.first]?.id).toBe(ids.tenantA);
			expect(other.rows).toEqual([]);
		});
	});

	it("MT-007: a direct update that changes tenantId is denied by row-level security", async () => {
		const ids = TWO_TENANT_FIXTURE;
		await withTenant(pool, ids.tenantA, ids.userAOwner, async (client) => {
			await expect(client.query(`UPDATE public."Location" SET "tenantId" = $1 WHERE id = $2`, [ids.tenantB, ids.locationAKl])).rejects.toThrow(/row-level security policy/);
			const kept = await client.query<{ tenantId: string }>(`SELECT "tenantId" FROM public."Location" WHERE id = $1`, [ids.locationAKl]);
			expect(kept.rows[LIST_SLOT_INDEX.first]?.tenantId).toBe(ids.tenantA);
		});
	});

	it("MT-002: A-Owner reading reward B by id is not found", async () => {
		const ids = TWO_TENANT_FIXTURE;
		const actor: ActorContext = {
			kind: "user",
			userId: ids.userAOwner,
			sessionId: "fixture-session",
			tenantId: ids.tenantA,
			isSuperAdmin: false,
			accessScope: "tenant",
			impersonatorUserId: null,
			request: { requestId: "mt-002", ip: null, userAgent: null, deviceLabel: null, endpoint: null },
		};
		const reads = new PrismaRewardReadRepository(
			new RewardsReadSession(transactions),
			new TenantDisplayAdapter({
				getDisplayData: (): Promise<ReadonlyMap<string, TenantDisplayData>> => Promise.resolve(new Map<string, TenantDisplayData>()),
				listOwnerUserIds: (): Promise<readonly string[]> => Promise.resolve([]),
			}),
			(stored) => stored,
		);
		const handler = new GetTenantRewardHandler(
			{ assertCapability: (): Promise<MerchantAccessGrant> => Promise.resolve({ tenantId: ids.tenantA, locationScope: "ALL_LOCATIONS", locationIds: [] }) },
			reads,
		);
		await expect(handler.execute(new GetTenantRewardQuery(actor, { tenantId: ids.tenantA, rewardId: ids.rewardB }))).rejects.toBeInstanceOf(RewardNotFoundError);
	});

	it("MT-46: unpublished rewards of A and B stay out of the marketplace read, and moderation columns are not selected", async () => {
		const ids = TWO_TENANT_FIXTURE;
		const actor: ActorContext = {
			kind: "user",
			userId: ids.userCustomerC,
			sessionId: "fixture-session",
			tenantId: null,
			isSuperAdmin: false,
			accessScope: "tenant",
			impersonatorUserId: null,
			request: { requestId: "mt-046", ip: null, userAgent: null, deviceLabel: null, endpoint: null },
		};
		const session = new RewardsReadSession(transactions);
		const rows = await session.readPublished(actor, (db) =>
			db.reward.findMany({
				where: buildMarketplaceWhere(RewardListQuerySchema.parse({})),
				select: MARKETPLACE_REWARD_SELECT,
			}),
		);
		const returned = rows.map((row) => row.id);
		expect(returned).toContain(ids.rewardAMarketplace);
		expect(returned).toContain(ids.rewardBMarketplace);
		expect(returned).not.toContain(ids.rewardADraft);
		expect(returned).not.toContain(ids.rewardBDraft);
		for (const row of rows) {
			const columns = Object.keys(row);
			expect(columns).not.toContain("rejectionReason");
			expect(columns).not.toContain("reviewedByUserId");
			expect(columns).not.toContain("metadata");
			expect(columns).not.toContain("submittedForReviewAt");
		}
	});

	it("MT-003: no slug and an unknown slug do not fall back to a default tenant", async () => {
		const ids = TWO_TENANT_FIXTURE;
		await expect(routes.resolve({})).resolves.toEqual({ kind: "none" });
		await expect(routes.resolve({ tenantSlug: "fixture-tenant-a" })).resolves.toEqual({ kind: "tenant", tenantId: ids.tenantA, lifecycleState: "ACTIVE" });
		await expect(routes.resolve({ tenantSlug: "missing-tenant" })).rejects.toBeInstanceOf(NotFoundError);
	});

	it("LIFE-001: tenant S is suspended, so an ordinary route is rejected and a lifecycle route is allowed", async () => {
		const ids = TWO_TENANT_FIXTURE;
		const resolved = await routes.resolve({ tenantSlug: "fixture-tenant-s" });
		expect(resolved).toEqual({ kind: "tenant", tenantId: ids.tenantS, lifecycleState: "SUSPENDED" });
		if (resolved.kind !== "tenant") {
			return;
		}
		expect(decideTenantLifecycle({ lifecycleState: resolved.lifecycleState, isDeleted: false, route: "ordinary", membershipStatus: "ACTIVE" })).toEqual({
			kind: "tenant_suspended",
		});
		expect(decideTenantLifecycle({ lifecycleState: resolved.lifecycleState, isDeleted: false, route: "lifecycle", membershipStatus: "ACTIVE" })).toEqual({
			kind: "allow",
		});
	});

	it("LOC-002: the KL manager is rejected for the Malacca location", async () => {
		const ids = TWO_TENANT_FIXTURE;
		const context = new TenantContextService(
			transactions,
			{
				getActivePolicyVersion: (): Promise<number> => Promise.resolve(1),
				evaluate: (): Promise<CedarAuthorizationDecision> => Promise.reject(new Error("cedar evaluate is not used by location access")),
			},
			new TenantAuditService(),
			createTestPublicUrls(),
		);
		await expect(context.assertAccessibleLocation(ids.userAKlManager, "fixture-tenant-a", ids.locationAKl)).resolves.toBeUndefined();
		await expect(context.assertAccessibleLocation(ids.userAKlManager, "fixture-tenant-a", ids.locationAMalacca)).rejects.toBeInstanceOf(ForbiddenException);
	});

	it("LOC-001: the KL manager can read the KL location", async () => {
		const ids = TWO_TENANT_FIXTURE;
		await withTenant(pool, ids.tenantA, ids.userAKlManager, async (client) => {
			const kl = await client.query<{ id: string }>(`SELECT id FROM public."Location" WHERE id = $1`, [ids.locationAKl]);
			expect(kl.rows[LIST_SLOT_INDEX.first]?.id).toBe(ids.locationAKl);
		});
	});

	it("LOC-003: A-Owner cannot read tenant B's location", async () => {
		const ids = TWO_TENANT_FIXTURE;
		await withTenant(pool, ids.tenantA, ids.userAOwner, async (client) => {
			const own = await client.query<{ id: string }>(`SELECT id FROM public."Location" WHERE id = $1`, [ids.locationAKl]);
			const other = await client.query<{ id: string }>(`SELECT id FROM public."Location" WHERE id = $1`, [ids.locationBJb]);
			expect(own.rows[LIST_SLOT_INDEX.first]?.id).toBe(ids.locationAKl);
			expect(other.rows).toEqual([]);
		});
	});

	it("LOC-004: A-Owner's locations are only tenant A", async () => {
		const ids = TWO_TENANT_FIXTURE;
		await withTenant(pool, ids.tenantA, ids.userAOwner, async (client) => {
			const rows = await client.query<{ id: string }>(`SELECT id FROM public."Location" ORDER BY id`);
			expect(rows.rows.map((row) => row.id).sort()).toEqual([ids.locationAKl, ids.locationAMalacca].sort());
		});
	});

	it("CU-001: customer C reads their own claim", async () => {
		const ids = TWO_TENANT_FIXTURE;
		await withTenant(pool, "", ids.userCustomerC, async (client) => {
			const own = await client.query<{ id: string }>(`SELECT id FROM public."RewardClaim" WHERE id = $1`, [ids.claimC]);
			expect(own.rows[LIST_SLOT_INDEX.first]?.id).toBe(ids.claimC);
		});
	});

	it("MT-004: a user with no membership sees no tenant locations", async () => {
		const ids = TWO_TENANT_FIXTURE;
		await withTenant(pool, ids.tenantA, ids.userCustomerC, async (client) => {
			const rows = await client.query<{ id: string }>(`SELECT id FROM public."Location" WHERE id = $1`, [ids.locationAKl]);
			expect(rows.rows).toEqual([]);
		});
	});

	it("MT-005: a suspended membership sees no tenant locations", async () => {
		const ids = TWO_TENANT_FIXTURE;
		await withTenant(pool, ids.tenantA, ids.userASuspended, async (client) => {
			const rows = await client.query<{ id: string }>(`SELECT id FROM public."Location" WHERE id = $1`, [ids.locationAKl]);
			expect(rows.rows).toEqual([]);
		});
	});

	it("CU-002: customer C cannot read another customer's claim", async () => {
		const ids = TWO_TENANT_FIXTURE;
		await withTenant(pool, "", ids.userCustomerC, async (client) => {
			const other = await client.query<{ id: string }>(`SELECT id FROM public."RewardClaim" WHERE id = $1`, [ids.claimB]);
			expect(other.rows).toEqual([]);
		});
	});

	it("MACH-001: tenant A's terminal resolves to tenant A and the KL location", async () => {
		const ids = TWO_TENANT_FIXTURE;
		await withApiKey(pool, ids.tenantA, ids.apiKeyA, ids.locationAKl, async (client) => {
			const terminal = await client.query<{ tenantId: string; locationId: string; terminalId: string }>(
				`SELECT "tenantId", "locationId", "terminalId" FROM public."TenantTerminal" WHERE id = $1`,
				[ids.terminalA],
			);
			expect(terminal.rows[LIST_SLOT_INDEX.first]).toEqual({ tenantId: ids.tenantA, locationId: ids.locationAKl, terminalId: "FIXTURE-A-KL" });
		});
	});

	it("MACH-003: tenant A's key cannot read or write tenant B's redemption", async () => {
		const ids = TWO_TENANT_FIXTURE;
		await withApiKey(pool, ids.tenantA, ids.apiKeyA, ids.locationAKl, async (client) => {
			const other = await client.query<{ id: string }>(`SELECT id FROM public."RewardRedemption" WHERE id = $1`, [ids.redemptionB]);
			expect(other.rows).toEqual([]);
			await expect(
				client.query(
					`INSERT INTO public."RewardRedemption" (id, "claimId", "tenantId", "locationId", "userId", "terminalId", "redemptionMethod", "saleId", "redeemedAt", "createdAt", "updatedAt", "isDeleted") VALUES ($1, $2, $3, $4, $5, 'FIXTURE-A-KL', 'SCAN', $6, $7, $7, $7, false)`,
					["019b76da-a810-7000-8000-0000000000f1", ids.claimB, ids.tenantB, ids.locationBJb, ids.userBOwner, ids.saleB, ids.epochMs],
				),
			).rejects.toThrow(/row-level security policy/);
		});
	});
});

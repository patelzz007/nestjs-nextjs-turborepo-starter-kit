import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { API_VERSION_PREFIX } from "@workspace/shared";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { TENANT_SEED_SLUGS } from "../prisma/seed/tenants";
import { PrismaService } from "../src/prisma/prisma.service";
import { createE2eApp, login, markSeedUserEmailVerified, uniqueClientIp, type LoginResult } from "./e2e-helpers";
import { recordStatements, type RecordedStatement } from "./support/sql-statement-recorder";

/**
 * Tables that grow without bound in production (one row per request, change, claim, sale, delivery…). A list
 * query that must scan one of them whole is a missing index waiting for real traffic.
 */
const GROWING_TABLES: ReadonlySet<string> = new Set([
	"AuditLog",
	"DataChangeLog",
	"DataChangeGroup",
	"User",
	"RewardClaim",
	"RewardRedemption",
	"RewardSale",
	"InAppNotification",
	"Notification",
	"NotificationDelivery",
	"EmailLog",
	"RefreshToken",
	"PaymentIntent",
	"PaymentEvent",
	"TenantCustomer",
	"PermissionAuditLog",
	"AuthorizationAudit",
]);
const STATEMENT = /^\s*(SELECT|WITH)\b/iu;

/** One plan node of `EXPLAIN (FORMAT JSON)` with Postgres's own keys; its children are parsed in turn. */
const RawPlanNodeSchema = z.looseObject({ "Node Type": z.string(), "Relation Name": z.string().optional(), Plans: z.array(z.looseObject({})).optional() });
const ExplainRowSchema = z.object({ "QUERY PLAN": z.array(z.looseObject({ Plan: z.looseObject({}) })) });

/** A plan node as this test reads it. */
interface PlanNode {
	readonly nodeType: string;
	readonly relationName: string | null;
	readonly children: readonly PlanNode[];
}

function toPlanNode(raw: object): PlanNode {
	const node = RawPlanNodeSchema.parse(raw);
	return { nodeType: node["Node Type"], relationName: node["Relation Name"] ?? null, children: (node.Plans ?? []).map(toPlanNode) };
}

function seqScansIn(node: PlanNode): string[] {
	const own = node.nodeType === "Seq Scan" && node.relationName !== null ? [node.relationName] : [];
	return [...own, ...node.children.flatMap(seqScansIn)];
}

/**
 * Enhancement 2.7: the real list queries the apps issue, EXPLAINed with sequential scans discouraged
 * (`enable_seqscan = off`): a table that is still scanned whole has no index the query can use. On the small
 * seeded database the planner would scan anyway; with scans discouraged, only a real gap remains.
 */
describe("Query plans of the busiest list endpoints (e2e)", () => {
	let app: NestFastifyApplication;
	let explain: Pool;
	let superAdmin: LoginResult;
	let alice: LoginResult;
	let owner: LoginResult;

	async function seqScansOf(statement: RecordedStatement): Promise<readonly string[]> {
		const client = await explain.connect();
		try {
			await client.query("BEGIN");
			await client.query("SET LOCAL enable_seqscan = off");
			const result = await client.query(`EXPLAIN (FORMAT JSON) ${statement.sql}`, [...statement.values]);
			await client.query("ROLLBACK");
			const [row] = z.array(ExplainRowSchema).parse(result.rows);
			return (row?.["QUERY PLAN"] ?? []).flatMap((entry) => seqScansIn(toPlanNode(entry.Plan))).filter((table) => GROWING_TABLES.has(table));
		} catch (error) {
			await client.query("ROLLBACK");
			throw new Error(`Could not EXPLAIN a recorded statement: ${statement.sql.slice(0, 200)}`, { cause: error });
		} finally {
			client.release();
		}
	}

	async function get(path: string, cookie: string, client: "web" | "admin" | "merchant"): Promise<void> {
		const response = await app.inject({
			method: "GET",
			url: `${API_VERSION_PREFIX}${path}`,
			headers: { cookie, "x-client-type": client, "x-forwarded-for": uniqueClientIp() },
		});
		expect(response.statusCode, path).toBe(200);
	}

	beforeAll(async () => {
		app = await createE2eApp();
		explain = new Pool({ connectionString: z.string().min(1).parse(process.env.DATABASE_URL) });
		await markSeedUserEmailVerified(explain, "alice.johnson@example.com");
		superAdmin = await login(app, "superadmin@example.com", "SuperAdmin@123", "admin");
		alice = await login(app, "alice.johnson@example.com", "Alice@123");
		owner = await login(app, "brew.owner@kl-rewards.demo", "BrewOwner@123", "merchant");
	});

	afterAll(async () => {
		await explain.end();
		await app.close();
	});

	it("leaves no growing table scanned whole by a list query", async () => {
		const admin = `adminAccessToken=${superAdmin.accessToken}; adminRefreshToken=${superAdmin.refreshToken}`;
		const web = `accessToken=${alice.accessToken}; refreshToken=${alice.refreshToken}`;
		const merchant = `merchantAccessToken=${owner.accessToken}; merchantRefreshToken=${owner.refreshToken}`;
		const kl = TENANT_SEED_SLUGS.kl;
		const statements = await recordStatements(app.get(PrismaService).connectionPool(), async () => {
			await get("/admin/audit-trail?limit=25", admin, "admin");
			await get("/admin/audit-logs?limit=25", admin, "admin");
			await get("/admin/data-changes?limit=25", admin, "admin");
			await get("/auth/admin/users?limit=25", admin, "admin");
			await get("/notifications?surface=CUSTOMER&limit=20", web, "web");
			await get("/claims?limit=20", web, "web");
			await get(`/tenants/${kl}/payments?limit=20`, merchant, "merchant");
			await get(`/tenants/${kl}/broadcasts?limit=20`, merchant, "merchant");
		});
		const reads = statements.filter((statement) => STATEMENT.test(statement.sql));
		expect(reads.length).toBeGreaterThan(0);
		const findings: string[] = [];
		for (const statement of reads) {
			const scans = await seqScansOf(statement);
			if (scans.length > 0) {
				findings.push(`${[...new Set(scans)].join(", ")} ← ${statement.sql.replace(/\s+/gu, " ").slice(0, 220)}`);
			}
		}
		expect([...new Set(findings)]).toStrictEqual([]);
	});
});
